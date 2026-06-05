---
name: buildflow-hotfix
max_context_kb: 20
description: Fast-path fix for production incidents and small patches — no planning, no waves
allowed-tools: Read, Write, Bash, Grep, Glob
agent: surgeon
---

# /buildflow-hotfix

Emergency and small-patch path. Skips all planning, spec, and wave orchestration. Goes directly: understand → restore point → fix → test → ship.

Use this for:
- Production incidents
- One-liner bug fixes
- Small patches that don't justify a full plan
- Dependency version bumps
- Config changes

Do NOT use for: new features, refactors, or anything that touches more than ~5 files. Use `/buildflow-spec` + `/buildflow-build` for those.

## Usage
- `/buildflow-hotfix "fix login crash on empty password"`
- `/buildflow-hotfix "bump lodash to 4.17.21"`
- `/buildflow-hotfix src/api/auth.ts "rate limiting not applying to /refresh"`
- `/buildflow-hotfix --list` — show all active hotfix sessions
- `/buildflow-hotfix --continue` — resume the most recent active session
- `/buildflow-hotfix --continue HOTFIX-002` — resume a specific session by reference
- `/buildflow-hotfix --cleanup` — archive shipped sessions older than 30 days

## Context Packet (minimal — load only what's needed)
- `.buildflow/MEMORY.md` (app_name, framework fields only)
- Target file(s) if specified
- Do NOT load: specs, phases, codebase MAP, PATTERNS — keep it fast

## Folder Access Guard (mandatory before any file read/write outside .buildflow/)

Before reading or writing any source file, apply the installed **Folder Access Guard**:
- Check `path_permissions.[folder]` in `.buildflow/PREFERENCES.md`
- `approved` → proceed; `denied` → skip + warn; not listed → show [1]/[2]/[3] prompt once per folder
- Identify the fix's target folder(s) upfront — ask once, not per file

## Epic Resolution (resolve target folder before any file write)

Read `.buildflow/STATE.md`:
- If `current_epic` is absent, empty, or `none` → auto-assign to `.buildflow/hotfix/` (no prompt needed)
- If `current_epic` is set → ask once:

  ```
  ──────────────────────────────────────────────────
  Active epic: [current_epic] — "[epic name]"

  Is this hotfix part of the active epic?
    [E] Yes — file under epics/[current_epic]/hotfix/
    [I] No  — independent fix, file under hotfix/
  ──────────────────────────────────────────────────
  ```

  - **[E]:** store at `.buildflow/epics/[current_epic]/hotfix/HOTFIX-[seq].md`
  - **[I]:** store at `.buildflow/hotfix/HOTFIX-[seq].md` — note at the top of the record:
    ```yaml
    epic: none   # independent fix — not part of active epic [current_epic]
    ```

When recording outside any active epic, note at the top of the HOTFIX record:
```yaml
epic: none   # isolated — no active epic at time of hotfix
```

---

## Subcommand: --cleanup

When `--cleanup` is passed:

Scan all hotfix folders for stale sessions:
```bash
ls .buildflow/hotfix/HOTFIX-*.md .buildflow/epics/*/hotfix/HOTFIX-*.md 2>/dev/null
```

A session is **stale** when:
- `progress: shipped` AND
- `updated` date is more than 30 days ago

Display stale sessions found:
```
Stale Hotfix Sessions (shipped > 30 days ago)
─────────────────────────────────────────────
  HOTFIX-001  epics/1-auth/hotfix/  shipped  2026-04-01  (58 days ago)
              Fix: Login crash on empty password
  HOTFIX-002  hotfix/               shipped  2026-03-15  (75 days ago)
              Fix: Lodash bump to 4.17.21
─────────────────────────────────────────────
Archive these 2 sessions to .buildflow/hotfix/archive/ ? [Y/N]
```

If no stale sessions: print "No stale sessions found (all shipped sessions are < 30 days old)." and stop.

On `[Y]`: move each file to `.buildflow/hotfix/archive/` (create folder if needed). Print: `Archived 2 session(s) to .buildflow/hotfix/archive/`
On `[N]`: print "Cleanup cancelled." and stop.

STOP after cleanup.

---

## Subcommand: --list

When `--list` is passed:

Scan both global and epic hotfix folders:
```bash
ls .buildflow/hotfix/HOTFIX-*.md 2>/dev/null
ls .buildflow/epics/*/hotfix/HOTFIX-*.md 2>/dev/null
```

For each file, read `progress` from frontmatter. Group into two sections:

```
Active Hotfix Sessions
─────────────────────────────────────────────
  Ref          Location                       Progress       Date
  HOTFIX-003   epics/2-payments/hotfix/       tests-failed   2026-05-28
               Fix: Null check on req.body.user
               Next: re-apply with different approach (attempt 2/3)

  HOTFIX-002   hotfix/                        fix-applied    2026-05-27
               Fix: Rate limiter applied to /refresh route
               Next: run targeted tests

Shipped Sessions (resumable with explicit ref)
─────────────────────────────────────────────
  HOTFIX-001   epics/1-auth/hotfix/           shipped        2026-05-25
               Fix: Login crash on empty password
─────────────────────────────────────────────
Resume with: /buildflow-hotfix --continue HOTFIX-003
```

If no files found: print "No hotfix sessions found. Run `/buildflow-hotfix <description>` to start one."

STOP after displaying list.

---

## Subcommand: --continue

When `--continue` is passed:

**With a reference** (`--continue HOTFIX-002`):
- Validate ref matches `^HOTFIX-[0-9]+$`. If not, print "Invalid reference. Use format: HOTFIX-001. Run `/buildflow-hotfix --list` to see sessions." and stop.
- Search `.buildflow/hotfix/` and `.buildflow/epics/*/hotfix/`. If not found, print "No session found: {ref}. Run `/buildflow-hotfix --list`." and stop.
- Shipped sessions ARE resumable when ref is explicitly provided. Re-open by setting `progress: fix-applied` and print: `Note: resuming a shipped hotfix — prior fix was: {fix summary}`

**Without a reference** (`--continue` only):
- Find the most recently modified active (non-shipped) session:
  ```bash
  ls -t .buildflow/hotfix/HOTFIX-*.md .buildflow/epics/*/hotfix/HOTFIX-*.md 2>/dev/null | xargs grep -l "^progress: investigating\|^progress: fix-applied\|^progress: tests-failed" 2>/dev/null | head -1
  ```
- If none found: print "No active hotfix sessions. Run `/buildflow-hotfix --list` to see all sessions, or use `/buildflow-hotfix --continue HOTFIX-N` to reopen a shipped one." and stop.

Read the session file. Print resume context:

```
Resuming: {ref}  [{file path}]
─────────────────────────────────────────────
Triggered by: {trigger}
Progress:     {progress}
Fix applied:  {fix summary or "not yet"}
Next step:    {next_step}
Attempts:     {attempts}
Files:        {files_changed or "none yet"}
─────────────────────────────────────────────
```

Resume from the step matching `progress`:
- `investigating` → Step 1 (re-parse, files already noted)
- `fix-applied` → Step 5 (run targeted tests)
- `tests-failed` → Step 4 (re-apply with new approach, log previous as eliminated)
- `tests-passing` → Step 6 (ship)

Update `progress` and `updated` in session file before continuing.

---

## Step 1: Assess & Preserve — Understand, Scope & Restore Point

Parse `$ARGUMENTS` (--list, --continue). Identify: what's broken, files involved, expected behavior after fix. Ask ONE clarifying question if ambiguous.

### Scope Check
Count files that need to change.
- 1–5 files: proceed
- 6+ files: warn — "This looks larger than a hotfix. Consider /buildflow-spec instead."
  - Ask: "Proceed as hotfix anyway? (yes/no)"

### Create Restore Point

Apply Git Permission Guard: read `git.permission` from `PREFERENCES.md`. If not `approved`: no git commands this session.


## Step 2: Fix, Sync & Test — Apply Fix, Locale Sync & Regression Test

**File reading rule:** When reading files to apply the fix, load the full relevant function or module block — not just the affected line. Use `offset` and `limit` to get at least 50 lines of surrounding context.

Make the minimal change:
- Fix only the root cause
- Do not refactor, rename, or clean up surrounding code
- Match existing code style

If this is a `--continue` resuming from `tests-failed`: log the previous failed approach under `## Eliminated Approaches` in the session file before applying the new fix.

### Locale Catalog Sync (only if i18n keys changed)

**Triggered when the fix:**
- Adds a new label/i18n key in source code (`t('new.key')`, `getString(R.string.newKey)`, `__('new_key')`, `NSLocalizedString("key", ...)`, `I18n.t("key")`)
- Renames or removes an existing key
- Directly edits a label/copy catalog file (`.json`, `.properties`, `strings.xml`, `.arb`)

**If NOT triggered:** skip this step entirely and go to Step 4b.

**Action — sync ALL catalog files, not just the one edited:**

1. Read `intel.json → locale_support` (if onboarded):
   - `catalog_files[]` — all locale catalog paths
   - `label_catalogs[]` — static label/copy JSON paths
   - `supported_locales[]` — all locale codes
   - `catalog_type` — json / properties / xml / arb / strings / po

   If intel.json is absent: grep for catalog files now:
   ```bash
   find . -type f \( -path "*/locales/*" -o -path "*/i18n/*" -o -path "*/lang/*" -o -name "*labels*.json" -o -name "*strings*.json" -o -name "messages*.properties" -o -name "strings.xml" -o -name "*.arb" \) 2>/dev/null | grep -v node_modules | head -30
   ```

2. For each key change from the fix:

   **Adding a key:**
   - Primary locale catalog: add with the real value from the fix description
   - All other locale catalogs: add with `[TRANSLATE: <primary-value>]` placeholder
   - Static label/copy catalogs: add with real value (no locale variants)

   **Renaming a key:**
   - Grep ALL source files for the old key name first — update every reference
   - Then rename in ALL catalog files, preserving existing values

   **Removing a key:**
   - Grep ALL source files — if still referenced, block removal and flag the references
   - If unreferenced: remove from ALL catalog files

3. Write format per catalog type:

   | Type | Format |
   |------|--------|
   | JSON | `"key": "value"` — match existing nesting structure |
   | Properties | `key=value` — match existing line style |
   | XML (`strings.xml`) | `<string name="key">value</string>` inside `<resources>` |
   | ARB (Flutter) | `"key": "value"` + `"@key": {}` if others have it |
   | PO | `msgid "key"\nmsgstr "value"` block |
   | `.strings` (iOS) | `"key" = "value";` |

4. Use the **Write tool** to update each catalog file — do not output content as text, write to disk.

5. Report:
   ```
   Locale Catalog Sync
   ───────────────────
   Keys added/renamed/removed: [N]
   Catalogs updated: [list of paths]
   [TRANSLATE] placeholders: [N] — require human translation
   ```

### Write Regression Test (always — even in hotfix mode)

**Catalog-only fast path:** If ALL files changed by the fix are pure data files — locale catalogs, label/copy JSON, `.properties`, `strings.xml`, `.arb`, `.po` — skip Steps 4b and 5 entirely. Static data files have no logic to regression test. Go directly to Step 6.

### First: check if a test framework exists
```bash
cat package.json | grep -E "jest|vitest|mocha" 2>/dev/null
find . -name "*.test.ts" -o -name "*.test.js" -o -name "test_*.py" | head -3
```

- **Framework found:** write the regression test using it
- **No framework found:** warn — "No test framework detected. Regression test skipped. This bug may recur." Log to the active epic's `DEBT.md` (or `.buildflow/debug/DEBT.md` if no active epic): "Hotfix [description] shipped without regression test — no framework available."
- Do not block the hotfix for a missing framework, but always log the gap.

For the specific behavior being fixed:
1. Apply the fix first (Step 4)
2. Write or update a regression test that covers the fixed behavior
3. Run **only that specific test file** — confirm it passes:
   ```bash
   npx jest [specific-test-file] --no-coverage   # JS/TS
   npx vitest run [specific-test-file]
   pytest [specific-test-file] -v                # Python
   go test ./[package]/... -run TestFunctionName # Go
   cargo test specific_test_name                 # Rust
   ./mvnw test -Dtest=SpecificTest -q            # Java/Maven
   ./gradlew test --tests "*.SpecificTest"       # Java/Gradle
   dotnet test --filter "FullyQualifiedName~X"   # C#
   bundle exec rspec [specific_spec]             # Ruby
   ```

Do NOT run the full suite while adding the regression test. Run only the single new or updated test file.

Name it after the exact bug:
```
it('should not crash when user has no profile photo')
it('should return 401 when session token is expired')
```

If a test file already exists for the changed file: add the case there.
If not: create a minimal test file covering this function only. Do not skip — a hotfix without a regression test will regress again.

## Step 5: Targeted Test

Run tests for **changed files and their direct dependents only** — not the full suite. The full suite runs at `/buildflow-check` and `/buildflow-ship`.

**Catalog-only fast path (label/copy/locale files only):**
If ALL changed files are catalog files (`.json` label catalogs, `.properties`, `strings.xml`, `.arb`, `.po`, `.strings`) — skip this step. Pure data changes carry no runnable logic. If i18n-specific snapshot tests exist (e.g., `locales.test.ts`, `i18n.test.ts`, `labels.test.ts`): run only those. Otherwise: skip and go to Step 6.

**Build the targeted test set (for logic changes):**
1. Every source file changed by the fix (exclude pure catalog files from this list)
2. Direct test file for each changed source file (same name, `.test.` / `_test.` / `_spec.` / `Test` suffix)
3. Any test that imports or calls the changed file (callers)

Do NOT fall back to the nearest enclosing package/module test when no test file exists for a catalog file — that path runs the full suite. If no test exists for a changed source file, create one (Step 4b); if the changed file is a pure catalog, skip it.

```bash
# JS / TS
npx jest --testPathPattern="auth.service|auth.routes"
npx vitest run src/auth/auth.service.test.ts

# Python
pytest tests/auth/test_service.py tests/api/test_auth_routes.py

# Go
go test ./internal/auth/...

# Rust
cargo test auth::

# Java / Kotlin (Maven)
./mvnw test -Dtest=AuthServiceTest,AuthControllerTest -q

# Java / Kotlin (Gradle)
./gradlew test --tests "*.AuthServiceTest" --tests "*.AuthControllerTest"

# C# / .NET
dotnet test --filter "FullyQualifiedName~AuthService"

# Ruby
bundle exec rspec spec/services/auth_service_spec.rb spec/controllers/auth_controller_spec.rb

# PHP
./vendor/bin/phpunit tests/AuthServiceTest.php tests/AuthControllerTest.php

# Dart / Flutter
flutter test test/auth_service_test.dart

# Swift
xcodebuild test -scheme AppTests -only-testing "AppTests/AuthServiceTests"

# Scala
sbt "testOnly *.AuthServiceSpec"
```

If tests fail: fix and re-run. Max 3 attempts. On each failure, save/update the session file (create if not exists) using the Epic Resolution path and next available sequence number:

→ **Format:** Read `.buildflow/templates/tpl-shipped.md` for the hotfix SHIPPED.md structure.

Print: `Session saved: {path} — resume with /buildflow-hotfix --continue {ref}`

After 3 failed attempts: stop and ask the user. Suggest: `→ Next: /buildflow-debug --continue` to escalate to full root-cause analysis.

**After targeted tests pass — ask once:**
```
──────────────────────────────────────────────────
Targeted tests passed. Run full app-level test suite?
  [Y] Yes — run full suite now
  [N] No  — skip, proceed to Ship
──────────────────────────────────────────────────
```
- **[Y]:** Run the full test suite. On failure: report what broke — do not auto-fix regressions, they may be pre-existing.
- **[N]:** Skip. Full suite runs at `/buildflow-check` and `/buildflow-ship`.

## Step 4: Ship & Report

**If `git.permission: approved`:**
```bash
git add [changed files only]
git commit -m "hotfix: [description]"
```

**If `git.permission` is not `approved` (no-git mode):**
Take a post-fix snapshot of changed files into `.buildflow/snapshots/post-hotfix-[timestamp]/`.
Record in `STATE.md`:
```yaml
last_hotfix: [today]
last_hotfix_desc: [description]
last_hotfix_snapshot: .buildflow/snapshots/post-hotfix-[timestamp]/
```

Do not create a phase, do not update STATE.md phase number.
Update `MEMORY.md`:
```yaml
last_hotfix: [today]
last_hotfix_desc: [description]
```

### Report
```
Hotfix complete
───────────────
Fix: [what changed]
Files: [list]
Tests: passing
Commit: [hash]
Time: fast-path (no planning)
```

If no test coverage existed: "⚠ No test covers this area. Consider adding one."

## Final Step: Save Hotfix Record

**If a session file was already created** (partial save from Step 5 test failures): update it in place with the final record below. Do not create a new file or increment sequence.

**If no session file exists** (single-pass success): use the Write tool to create the record at the path resolved by the Epic Resolution step:
- Active epic: `.buildflow/epics/[current_epic]/hotfix/HOTFIX-[sequence].md`
- No active epic: `.buildflow/hotfix/HOTFIX-[sequence].md`

Increment sequence from existing files in that folder, starting at 001. Do not output as text — write to disk.

Single-pass hotfixes that complete without test failures skip file I/O entirely until this final step — zero overhead on the fast path.

→ **Format:** Read `.buildflow/templates/tpl-shipped.md` for the hotfix SHIPPED.md structure.

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Hotfix applied — verify no regressions before resuming normal workflow
──────────────────────────────────────────────────
```

If the hotfix was in a shipped phase: `→ Next: /buildflow-ship` (re-tag the fixed version).
If tests failed after 3 attempts: `→ Next: /buildflow-debug --continue {ref}` (escalate to full root-cause analysis).




