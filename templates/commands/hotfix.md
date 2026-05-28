---
name: buildflow-hotfix
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

## Step 1: Understand the Fix
Parse the description. Identify:
- What is broken?
- What file(s) are likely involved?
- What is the expected behavior after the fix?

If the description is ambiguous, ask ONE clarifying question only.

## Step 2: Scope Check
Count files that need to change.
- 1–5 files: proceed
- 6+ files: warn — "This looks larger than a hotfix. Consider /buildflow-spec instead."
  - Ask: "Proceed as hotfix anyway? (yes/no)"

## Step 3: Create Restore Point

Before any git command, read `.buildflow/PREFERENCES.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Use file snapshots, even if `.git/` exists or `MEMORY.md` says `git_available: true`.
- If `PREFERENCES.md` is missing or `git.permission` is absent: ask the user before running any git command.

**If `git.permission: approved`:**
```bash
git stash push -m "hotfix restore point: [description]"
# or if clean working tree:
git tag "pre-hotfix-[timestamp]"
```

**If `git.permission` is not `approved` (no-git mode):**
Copy every file that will be modified into `.buildflow/snapshots/pre-hotfix-[timestamp]/`:
```
.buildflow/snapshots/pre-hotfix-20240115-143200/
└── src/auth/service.ts   ← copy of file BEFORE the fix
```
Log in `STATE.md`:
```yaml
last_restore_point: .buildflow/snapshots/pre-hotfix-20240115-143200/
last_restore_reason: "hotfix: [description]"
```
To roll back: copy files from the snapshot back to their original paths.

## Step 4: Apply Fix
Make the minimal change:
- Fix only the root cause
- Do not refactor, rename, or clean up surrounding code
- Match existing code style

## Step 4c: Locale Catalog Sync (runs after fix — only if label/i18n keys changed)

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

## Step 4b: Write Regression Test (always — even in hotfix mode)

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

If tests fail: fix and re-run. Max 3 attempts, then stop and report what's unresolved.

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

## Step 6: Ship

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

## Step 7: Report
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

Use the **Write tool** to create the hotfix record at the path resolved by the Epic Resolution step above:
- Active epic: `.buildflow/epics/[current_epic]/hotfix/HOTFIX-[sequence].md`
- No active epic: `.buildflow/hotfix/HOTFIX-[sequence].md`

Increment sequence from existing files in that folder, starting at 001. Do not output as text — write to disk.

```markdown
# Hotfix — [short description]
Date: [ISO datetime]
Epic: [current_epic or "none"]
Triggered by: [bug description or incident reference]

## Problem
[what was broken and why it needed an immediate fix — not a planned wave]

## Fix
[what was changed and why this approach was chosen]

## Files Changed
- [path] — [what changed]

## Restore Point
[snapshot path if created, or "git restore point: [commit hash]", or NONE]

## Test Results
[focused test commands run and pass/fail results]

## Risk
[any risk this hotfix introduces or side-effects to watch, or NONE]
```

## Token cost report (print at end of hotfix)

Measure actual cost before printing:
1. Estimate input tokens per file: `Math.ceil((chars / (baseDivisor − densityPenalty)) × 1.05)` — prose/md=4.0, standard code=3.5, Go/Rust/C=3.2, JSON/YAML=3.2, minified=2.7; densityPenalty: symbol-dense=0.3, normal=0.1, sparse=0.0. Sum all files = input tokens.
2. Estimate output tokens (code-heavy command): `Math.ceil((outputChars / 3.4) × 1.05)` = output tokens
3. Update `STATE.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Hotfix complete — [description] · [N] files changed
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in PREFERENCES.md):
```
Token Cost — /buildflow-hotfix
────────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Hotfix applied — verify no regressions before resuming normal workflow
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If the hotfix was in a shipped phase: `→ Next: /buildflow-ship` (re-tag the fixed version).

## Token Budget: ~10K

## Token Budget: ~10K

