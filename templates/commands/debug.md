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

## Step 1: Collect the Error
If a description was passed, use it.
Otherwise check for recent failure context:
- Last test run output
- Browser console errors
- Terminal error logs
- `.buildflow/epics/[epic]/PLAN.md` for what was expected

## Step 2: Reproduce the Failure
- Run the failing test or trigger the failing flow
- Confirm the error is reproducible before investigating
- Note: exact error message, file, line number, stack trace

## Step 3: Trace to Root Cause
Work backwards from the symptom:
1. What line threw the error?
2. What called that line?
3. What data was passed in?
4. Where does that data come from?
5. What assumption is violated?

Distinguish:
- **Symptom** — where the error surfaces
- **Root cause** — where the actual problem is

## Step 4: Impact Check
Before fixing:
- How many places does this root cause affect?
- Is this a one-off bug or a systemic pattern?
- Will fixing this break anything else?

## Step 5: Create Restore Point

Before any git command, read `.buildflow/PREFERENCES.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Use file snapshots, even if `.git/` exists or `MEMORY.md` says `git_available: true`.
- If `PREFERENCES.md` is missing or `git.permission` is absent: ask the user before running any git command.

If `git.permission: approved`:
```bash
git stash  # safe fallback before making changes
```

If `git.permission` is not `approved`, copy files likely to be changed into `.buildflow/snapshots/pre-debug-[timestamp]/`.

## Step 6: Apply Fix
- Fix only the root cause, not the symptom
- Minimum footprint — do not refactor surrounding code
- Match existing code style (PATTERNS.md)

## Step 6b: Locale Catalog Sync (runs after fix — only if label/i18n keys changed)

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

## Step 8: Prevent Recurrence
- Add a test that would have caught this bug
- Note the fix in `.buildflow/epics/[epic]/CONTEXT.md` if it reveals a systemic issue

## Step 9: Save Debug Record

Use the **Write tool** to create the debug record at the path resolved by the Epic Resolution step above:
- Active epic: `.buildflow/epics/[current_epic]/debug/DEBUG-[sequence].md`
- No active epic: `.buildflow/debug/DEBUG-[sequence].md`

Increment sequence from existing files in that folder, starting at 001. Do not output as text — write to disk.

```markdown
# Debug Session — [short description]
Date: [ISO datetime]
Epic: [current_epic or "none"]
Status: RESOLVED / UNRESOLVED

## Problem
[symptom reported — exact error message or test failure]

## Root Cause
[the underlying reason, not just the symptom]

## Hypothesis Chain
- H1: [hypothesis] → [result: CONFIRMED / ELIMINATED]
- H2: [hypothesis] → [result: ...]

## Fix Applied
[what changed and why — file:line references]

## Files Changed
- [path] — [what changed]

## Test Evidence
[commands run and pass/fail results]

## Remaining Risk
[any lingering concerns or NONE]
```

## Token cost report (print at end of debug)

Measure actual cost before printing:
1. Estimate input tokens per file: `Math.ceil((chars / (baseDivisor − densityPenalty)) × 1.05)` — prose/md=4.0, standard code=3.5, Go/Rust/C=3.2, JSON/YAML=3.2, minified=2.7; densityPenalty: symbol-dense=0.3, normal=0.1, sparse=0.0. Sum all files = input tokens.
2. Estimate output tokens (mixed command): `Math.ceil((outputChars / 3.7) × 1.05)` = output tokens
3. Update `STATE.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Debug complete — root cause: [description] · fix applied: [yes/no]
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in PREFERENCES.md):
```
Token Cost — /buildflow-debug
──────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-test
   Why:  Fix applied — re-run tests to confirm the root cause is resolved
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If root cause could not be isolated: `→ Next: /buildflow-debug` (re-run with a narrower hypothesis).
If the bug traced to a spec gap: `→ Next: /buildflow-spec --review` (amend the AC before proceeding).

## Token Budget: ~20K
