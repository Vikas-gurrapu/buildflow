---
name: buildflow-debug
description: Systematic debugging when a test fails or something breaks
allowed-tools: Read, Write, Bash, Grep, Glob
agent: surgeon
---

# /buildflow-debug

Systematic root-cause analysis for failing tests, broken builds, or unexpected behavior. The Surgeon reads the error, traces it to the source, and fixes it with minimal footprint.

## Usage
- `/buildflow-debug` — debug the most recent failure
- `/buildflow-debug "error message or description"`
- `/buildflow-debug src/auth/login.ts` — debug a specific file
- `/buildflow-debug --trace` — full stack trace analysis
- `/buildflow-debug --list` — show all unresolved debug sessions
- `/buildflow-debug --continue` — resume the most recent unresolved session
- `/buildflow-debug --continue DEBUG-003` — resume a specific session by reference
- `/buildflow-debug --cleanup` — archive resolved sessions older than 30 days

## Folder Access Guard (mandatory before any file read/write outside .buildflow/)

Before reading or writing any source file, apply the installed **Folder Access Guard**:
- Check `path_permissions.[folder]` in `.buildflow/PREFERENCES.md`
- `approved` → proceed; `denied` → skip + warn; not listed → show [1]/[2]/[3] prompt once per folder

## Epic Resolution (resolve target folder before any file write)

Read `.buildflow/STATE.md`:
- If `current_epic` is absent, empty, or `none` → auto-assign to `.buildflow/debug/` (no prompt needed)
- If `current_epic` is set → ask once:

  ```
  ──────────────────────────────────────────────────
  Active epic: [current_epic] — "[epic name]"

  Is this debug session part of the active epic?
    [E] Yes — file under epics/[current_epic]/debug/
    [I] No  — independent fix, file under debug/
  ──────────────────────────────────────────────────
  ```

  - **[E]:** store at `.buildflow/epics/[current_epic]/debug/DEBUG-[seq].md`
  - **[I]:** store at `.buildflow/debug/DEBUG-[seq].md` — note at the top of the record:
    ```yaml
    epic: none   # independent fix — not part of active epic [current_epic]
    ```

When recording outside any active epic, note at the top of the DEBUG record:
```yaml
epic: none   # isolated — no active epic at time of debug session
```

---

## Subcommand: --cleanup

When `--cleanup` is passed:

Scan all debug folders for stale sessions:
```bash
ls .buildflow/debug/DEBUG-*.md .buildflow/epics/*/debug/DEBUG-*.md 2>/dev/null
```

A session is **stale** when:
- `progress: resolved` AND
- `updated` date is more than 30 days ago

Display stale sessions found:
```
Stale Debug Sessions (resolved > 30 days ago)
─────────────────────────────────────────────
  DEBUG-001  epics/1-auth/debug/    resolved  2026-04-01  (58 days ago)
             Problem: Login redirect loop
  DEBUG-002  debug/                 resolved  2026-03-15  (75 days ago)
             Problem: Form submit 500
─────────────────────────────────────────────
Archive these 2 sessions to .buildflow/debug/archive/ ? [Y/N]
```

If no stale sessions: print "No stale sessions found (all resolved sessions are < 30 days old)." and stop.

On `[Y]`: move each file to `.buildflow/debug/archive/` (create folder if needed). Print: `Archived 2 session(s) to .buildflow/debug/archive/`
On `[N]`: print "Cleanup cancelled." and stop.

STOP after cleanup.

---

## Subcommand: --list

When `--list` is passed:

Scan both global and epic debug folders:
```bash
ls .buildflow/debug/DEBUG-*.md 2>/dev/null
ls .buildflow/epics/*/debug/DEBUG-*.md 2>/dev/null
```

For each file, read `progress` from frontmatter and `Status:` line. Group into two sections:

```
Unresolved Debug Sessions
─────────────────────────────────────────────
  Ref        Location                         Progress       Date
  DEBUG-003  epics/2-payments/debug/          root-found     2026-05-28
             Problem: JWT decode fails on mobile
             Next: apply null check fix to token parser

  DEBUG-002  debug/                           investigating  2026-05-27
             Problem: 500 on form submit
             Next: check req.body.user null handling

Resolved Sessions (resumable with explicit ref)
─────────────────────────────────────────────
  DEBUG-001  epics/1-auth/debug/              resolved       2026-05-25
             Problem: Login redirect loop
─────────────────────────────────────────────
Resume with: /buildflow-debug --continue DEBUG-003
```

If no files found: print "No debug sessions found. Run `/buildflow-debug <description>` to start one."

STOP after displaying list.

---

## Subcommand: --continue

When `--continue` is passed:

**With a reference** (`--continue DEBUG-003`):
- Validate ref matches `^DEBUG-[0-9]+$`. If not, print "Invalid reference. Use format: DEBUG-001. Run `/buildflow-debug --list` to see sessions." and stop.
- Search for the file in `.buildflow/debug/` and `.buildflow/epics/*/debug/`. If not found, print "No session found: {ref}. Run `/buildflow-debug --list` to see sessions." and stop.
- Resolved sessions ARE resumable when ref is explicitly provided. Re-open by setting `progress: investigating` and print: `Note: resuming a resolved session — prior root cause was: {root_cause}`

**Without a reference** (`--continue` only):
- Find the most recently modified unresolved session:
  ```bash
  ls -t .buildflow/debug/DEBUG-*.md .buildflow/epics/*/debug/DEBUG-*.md 2>/dev/null | xargs grep -l "^progress: investigating\|^progress: root-found\|^progress: fix-applied\|^progress: tests-failed" 2>/dev/null | head -1
  ```
- If none found: print "No unresolved sessions. Run `/buildflow-debug --list` to see all sessions, or use `/buildflow-debug --continue DEBUG-N` to reopen a resolved one." and stop.

Read the session file. Print resume context:

```
Resuming: {ref}  [{file path}]
─────────────────────────────────────────────
Problem:    {problem description}
Progress:   {progress}
Root cause: {root_cause or "not yet identified"}
Next step:  {next_step}
Hypotheses eliminated: {count}
─────────────────────────────────────────────
```

Resume from the step matching `progress`:
- `investigating` → Step 3 (Trace to Root Cause) with prior hypotheses loaded
- `root-found` → Step 6 (Apply Fix)
- `fix-applied` → Step 7 (Verify Fix)
- `tests-failed` → Step 6 (re-apply with new approach, log previous attempt as eliminated)

Update `progress` and `updated` in the session file before continuing.

---

## Step 1: Diagnose — Collect, Reproduce & Trace Root Cause

Parse `$ARGUMENTS` for subcommands (--list, --continue, --trace). Use passed description or collect from last test output, console errors, terminal logs, or PLAN.md. Reproduce the failure and confirm it's repeatable before investigating.

**File reading rule:** Read the full function or module block around the error — never truncate to a few lines. Use `offset` and `limit` on the Read tool to load the complete relevant section (entire function, class, or module — not just the erroring line). For large files, read the error site plus 50 lines above and below.

Work backwards from the symptom:
1. What line threw the error?
2. What called that line?
3. What data was passed in?
4. Where does that data come from?
5. What assumption is violated?

Distinguish:
- **Symptom** — where the error surfaces
- **Root cause** — where the actual problem is

**If root cause is found quickly (within this pass):** continue to Step 4 — no session file needed yet.

**If root cause is NOT found after exhausting obvious candidates**, save a partial session record now so the session is resumable. Resolve the target path using the Epic Resolution step, then determine the next sequence number. Use the Write tool to create the file:

→ **Format:** Read `.buildflow/templates/tpl-debug-record.md` for the debug session record structure.

Print: `Session saved: {path} — resume with /buildflow-debug --continue {ref}`

## Step 2: Impact & Restore Point
Before fixing:
- How many places does this root cause affect?
- Is this a one-off bug or a systemic pattern?
- Will fixing this break anything else?

### Create Restore Point

Apply Git Permission Guard: read `git.permission` from `PREFERENCES.md`. If not `approved`: no git commands this session.


## Step 3: Apply Fix
- Fix only the root cause, not the symptom
- Minimum footprint — do not refactor surrounding code
- Match existing code style (PATTERNS.md)

If a session file was created in Step 3, update it now: set `progress: fix-applied`, `next_step: verify fix`, and populate `## Root Cause` with one sentence.

### Locale Catalog Sync (only if i18n keys changed)

**Triggered when the fix:**
- Adds a missing i18n key that was causing broken/undefined UI labels
- Renames or removes a label key
- Directly edits a catalog file (`.json`, `.properties`, `strings.xml`, `.arb`)

**If NOT triggered:** skip this step.

**Action — sync ALL catalog files:**

1. Read `intel.json → locale_support` to get `catalog_files[]`, `label_catalogs[]`, `supported_locales[]`, `catalog_type`.

   If intel.json absent: grep for catalog files:
   ```bash
   find . -type f \( -path "*/locales/*" -o -path "*/i18n/*" -o -path "*/lang/*" -o -name "*labels*.json" -o -name "*strings*.json" -o -name "messages*.properties" -o -name "strings.xml" -o -name "*.arb" \) 2>/dev/null | grep -v node_modules | head -30
   ```

2. For each key added/renamed/removed by the fix:

   **Adding a missing key** (common debug scenario — label was undefined):
   - Primary locale catalog: add with the correct value
   - All other locale catalogs: add with `[TRANSLATE: <primary-value>]` placeholder
   - Static label/copy catalogs: add with the correct value directly

   **Renaming a key:**
   - Grep ALL source files for old key name, update every reference
   - Rename in ALL catalog files, preserving values

   **Removing a key:**
   - Grep ALL source files — if still referenced, block and flag
   - If unreferenced: remove from ALL catalog files

3. Format per type: JSON `"key": "value"`, properties `key=value`, XML `<string name="key">value</string>`, ARB `"key": "value"` + `"@key": {}`, PO `msgid "key"\nmsgstr "value"`, `.strings` `"key" = "value";`

4. Use the **Write tool** to update each catalog file — write to disk, not as text output.

5. Report:
   ```
   Locale Catalog Sync (debug fix)
   ────────────────────────────────
   Keys added/fixed: [N]
   Catalogs updated: [list of paths]
   [TRANSLATE] placeholders: [N]
   ```

## Step 7: Verify Fix

**Pure style/config/data fast path:** If ALL changed files are pure style (`.css`, `.scss`, `.sass`, `.less`, `.styl`), config (`.json` non-catalog, `.env`, `.gitignore`, `tsconfig`, `.eslintrc`), or static assets — skip test run entirely. No logic changed, no tests to run.

- Re-run the failing test — run **only that specific test file**, not the suite:
  ```bash
  # JS/TS
  npx jest [specific-test-file] --no-coverage
  npx vitest run [specific-test-file]
  # Python
  pytest [specific-test-file] -v
  # Go
  go test ./[package]/... -run TestFunctionName
  # Java/Kotlin (Maven)
  ./mvnw test -Dtest=SpecificTest#methodName -q
  # Java/Kotlin (Gradle)
  ./gradlew test --tests "*.SpecificTest.methodName"
  # C#
  dotnet test --filter "FullyQualifiedName~SpecificTest"
  # Ruby
  bundle exec rspec [specific_spec_file]
  # Rust
  cargo test specific_test_name
  ```
- Confirm the previously failing test now passes
- Run direct dependent tests (files that import the changed file) — not the full suite:
  ```bash
  # JS/TS — only the touched file and its direct callers
  npx jest --testPathPattern="[changed-file-name]|[caller-file-name]" --no-coverage
  ```
- If UI bug: verify the specific broken flow works — do not run the full E2E suite

**After targeted tests pass — ask once:**
```
──────────────────────────────────────────────────
Targeted tests passed. Run full app-level test suite?
  [Y] Yes — run full suite now
  [N] No  — skip, proceed to Prevent Recurrence
──────────────────────────────────────────────────
```
- **[Y]:** Run the full test suite. On failure: report what broke — do not auto-fix regressions, they may be pre-existing.
- **[N]:** Skip. Full suite runs at `/buildflow-check` and `/buildflow-ship`.

## Step 5: Harden & Record
- Add a test that would have caught this bug
- Note the fix in `.buildflow/epics/[epic]/CONTEXT.md` if it reveals a systemic issue

### Save Debug Record

**If a session file was already created** (partial save from Step 3): update it in place — overwrite with the final record below. Do not create a new file or increment sequence.

**If no session file exists** (single-pass success): use the Write tool to create the record at the path resolved by the Epic Resolution step:
- Active epic: `.buildflow/epics/[current_epic]/debug/DEBUG-[sequence].md`
- No active epic: `.buildflow/debug/DEBUG-[sequence].md`

Increment sequence from existing files in that folder, starting at 001. Do not output as text — write to disk.

→ **Format:** Read `.buildflow/templates/tpl-debug-record.md` for the debug session record structure.

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-test
   Why:  Fix applied — re-run tests to confirm the root cause is resolved
──────────────────────────────────────────────────
```

If root cause could not be isolated: `→ Next: /buildflow-debug --continue {ref}` (resume with a narrower hypothesis).
If the bug traced to a spec gap: `→ Next: /buildflow-spec --review` (amend the AC before proceeding).


