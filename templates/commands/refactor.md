---
name: buildflow-refactor
max_context_kb: 40
model_tier: heavy
description: Improve existing code quality without changing behavior
allowed-tools: Read, Write, Grep, Glob, Bash
agents: surgeon, reviewer
---

# /buildflow-refactor

Improve code quality, readability, or performance â€” without changing observable behavior.

## Usage
- `/buildflow-refactor src/components/Dashboard.tsx`
- `/buildflow-refactor "Extract auth logic into middleware"`
- `/buildflow-refactor --scope=module src/api/`

## Folder Access Guard (mandatory before any file read/write outside .buildflow/)

Before reading or writing any source file, apply the installed **Folder Access Guard**:
- Check `path_permissions.[folder]` in `.buildflow/PREFERENCES.md`
- `approved` â†’ proceed; `denied` â†’ skip + warn; not listed â†’ show [1]/[2]/[3] prompt once per folder

---

## Step 1: Load Context
Read `.buildflow/codebase/CODEBASE.md`, `PATTERNS.md`, `RISKS.md`.

## Step 2: Define Refactor Goal
Clarify what kind of improvement:
- Readability (rename, extract function, reduce nesting)
- Performance (memoization, lazy loading, caching)
- Maintainability (extract module, reduce coupling)
- Test coverage (add tests for existing logic)

## Step 3: Behavior Contract
Before refactoring:
- Document current behavior (inputs â†’ outputs)
- Identify existing tests
- Note any implicit side effects

The refactor must NOT change this contract.

## Step 4: Restore Point

Apply Git Permission Guard: read `git.permission` from `PREFERENCES.md`. If not `approved`: no git commands this session.


## Step 5: Incremental Refactor
Small, reviewable steps:
1. Rename in isolation
2. Extract without logic changes
3. Move with no modifications
4. Simplify one function at a time

After each step: verify behavior unchanged.

## Step 5b: Locale Catalog Sync (runs after each rename step â€” only if i18n keys affected)

**Triggered when Step 5 renames or moves:**
- A symbol that is also an i18n key reference (`t('old.key')` â†’ `t('new.key')`)
- A file that is a locale catalog or label/copy JSON
- A string constant used as a label key

**If NOT triggered:** skip this step.

**Action:**

1. Read `intel.json â†’ locale_support` to get `catalog_files[]`, `label_catalogs[]`, `supported_locales[]`, `catalog_type`.

   If intel.json absent: grep for catalog files:
   ```bash
   find . -type f \( -path "*/locales/*" -o -path "*/i18n/*" -o -path "*/lang/*" -o -name "*labels*.json" -o -name "*strings*.json" -o -name "messages*.properties" -o -name "strings.xml" -o -name "*.arb" \) 2>/dev/null | grep -v node_modules | head -30
   ```

2. For each renamed key:
   - Grep ALL source files for the old key name â€” update every reference to the new name
   - Then rename the key in ALL catalog files, preserving values exactly
   - Format per type: JSON `"new.key": "value"`, properties `new.key=value`, XML `<string name="new_key">`, ARB `"newKey": "value"`, PO `msgid "new.key"`, `.strings` `"new.key" = "value";`

3. For each moved file that is a catalog:
   - Update all import paths that reference the old catalog path
   - Update `intel.json locale_support.catalog_files[]` with the new path

4. Use the **Write tool** to update each affected catalog file â€” write to disk, not as text output.

5. Report:
   ```
   Locale Catalog Sync (refactor)
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Keys renamed: [old â†’ new] across [N] catalogs
   Files moved:  [old path â†’ new path]
   Source references updated: [N]
   ```

## Step 6: Quality Check (Reviewer agent)
- Is the refactored code simpler?
- Run targeted tests for **refactored files and their direct dependents only** â€” not the full suite:
  ```bash
  npx jest --testPathPattern="[refactored-file-name]" --no-coverage   # JS/TS
  npx vitest run [refactored-test-file] [caller-test-file]
  pytest tests/[module]/test_[file].py -v                             # Python
  go test ./[package]/... -run TestRefactoredFunction                 # Go
  cargo test [module]::                                               # Rust
  ./mvnw test -Dtest=RefactoredClassTest -q                           # Java/Maven
  ./gradlew test --tests "*.RefactoredClassTest"                      # Java/Gradle
  dotnet test --filter "FullyQualifiedName~RefactoredClass"           # C#
  bundle exec rspec [refactored_spec] [caller_spec]                   # Ruby
  ```
  **Pure style/config fast path:** if ONLY `.css`/`.scss`/`.less`/`.styl` or config files were touched â€” skip test run entirely.

**After targeted tests pass â€” ask once:**
```
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Targeted tests passed. Run full app-level test suite?
  [Y] Yes â€” run full suite now
  [N] No  â€” skip, proceed to Update Codebase Map
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```
- **[Y]:** Run the full test suite. On failure: report what broke â€” do not auto-fix regressions, they may be pre-existing.
- **[N]:** Skip. Full suite runs at `/buildflow-check`.
- Does it match PATTERNS.md conventions?
- Any new complexity introduced?

## Step 7: Update Codebase Map
If patterns changed significantly, update `.buildflow/codebase/PATTERNS.md`.



