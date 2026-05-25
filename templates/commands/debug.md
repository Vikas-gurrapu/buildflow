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

## Step 1: Collect the Error
If a description was passed, use it.
Otherwise check for recent failure context:
- Last test run output
- Browser console errors
- Terminal error logs
- `.buildflow/phases/[N]/PLAN.md` for what was expected

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

Before any git command, read `.buildflow/you/preferences.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Use file snapshots, even if `.git/` exists or `light.md` says `git_available: true`.
- If `preferences.md` is missing or `git.permission` is absent: ask the user before running any git command.

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
- Re-run the failing test — confirm it passes
- Run full test suite — confirm no regressions
- If UI bug: verify the flow works end-to-end

## Step 8: Prevent Recurrence
- Add a test that would have caught this bug
- Note the fix in `.buildflow/learnings/decisions.md` if it reveals a systemic issue

## Token cost report (print at end of debug)

Measure actual cost before printing:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output from text generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Debug complete — root cause: [description] · fix applied: [yes/no]
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in preferences.md):
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
