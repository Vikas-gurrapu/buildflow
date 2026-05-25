---
name: buildflow-modify
description: Surgical code change with transitive impact analysis, risk scoring, and test coverage verification
allowed-tools: Read, Write, Grep, Glob, Bash
agent: surgeon
---

# /buildflow-modify

Precise, safe changes to existing code. The Surgeon runs a full transitive impact analysis — not just "what files change" but the full chain of consequences — scores risk per affected file, verifies test coverage, and applies the minimum effective change.

Works for features and bugfixes equally.

## Usage
- `/buildflow-modify "Add rate limiting to /api/auth/login"`
- `/buildflow-modify "Fix null pointer crash when user has no profile photo"`
- `/buildflow-modify src/auth/login.ts "Add input validation"`
- `/buildflow-modify --dry-run "Rename getUserById to fetchUserById"`

## Context Packet
- `.buildflow/codebase/MAP.md`
- `.buildflow/codebase/STACK.md`
- `.buildflow/codebase/STRUCTURE.md`
- `.buildflow/codebase/INTEGRATIONS.md`
- `.buildflow/codebase/TESTING.md`
- `.buildflow/codebase/CONCERNS.md`
- `.buildflow/codebase/GRAPH.md` (import dependency graph — essential for impact analysis)
- `.buildflow/codebase/HOTSPOTS.md`
- `.buildflow/codebase/PATTERNS.md`
- `.buildflow/codebase/FEATURES.md` (existing capabilities, local support, locale support, feature ownership)
- `.buildflow/codebase/intel.json` fields `features[]`, `local_support`, and `locale_support`
- Target file(s) if named in command

If not onboarded: "Run `/buildflow-onboard` first — impact analysis requires the dependency graph."

---

## Step 1: Understand the Change
Parse the description. Identify:
- **What** must change (behavior, data, interface)
- **Where** the change originates (file, function, module)
- **What must NOT change** (caller contracts, existing behavior outside scope)
- Is this a feature (new capability) or a bugfix (restoring expected behavior)?

If ambiguous: ask ONE clarifying question only.

---

## Step 2: Transitive Impact Analysis

### 2a: Check for Symbol-Level Data
Read `.buildflow/codebase/intel.json`.

Also read `features[]`, `local_support`, and `locale_support` if present:
- Identify whether the target file appears in any feature evidence or owned modules.
- Identify whether the target file is part of local support (scripts, config, env, mocks, fixtures, local services, docs).
- Identify whether the target file is part of locale support (translation JSON, message catalogs, label/copy catalogs, localized docs, i18n imports/loaders/providers, locale routing, fallback config).
- Add those capabilities to the impact summary so the change preserves them deliberately.

Also read focused map docs if present:
- `STRUCTURE.md`: confirm target path belongs to a known module or flag structural drift if adding a new directory/route/barrel.
- `STACK.md`: check dependency/runtime compatibility before adding imports or packages.
- `INTEGRATIONS.md`: detect env/webhook/external service contracts touched by the change.
- `TESTING.md`: choose the targeted test command and test file location.
- `CONCERNS.md`: flag known fragile areas before editing.

**If `symbol_callers` exists in intel.json** (onboarded with GAP-H symbol tracking):
- Identify the **specific functions/methods** being changed (from Step 1)
- Look up each changed symbol in `symbol_callers` to get the exact files AND LINE NUMBERS that call it
- This gives a precise caller list — not "all files that import this module" but "all lines that call this function"

**If intel.json predates symbol tracking** (no `symbol_callers` key): fall back to file-level impact using `GRAPH.md` fan-in/fan-out (2b).

### 2b: Trace Full Impact Chain

**Symbol-level impact (preferred — when available):**
```
Changing: AuthService.login(email, password) → login(email, password, options?)

Symbol callers from intel.json:
  src/routes/auth.routes.ts   line 45  ← call site — may need options param update
  src/routes/auth.routes.ts   line 89  ← second call site
  src/tests/auth.test.ts      line 8   ← test — will need new test case
  src/middleware/session.ts   line 12  ← call site — verify default options work

Total: 4 call sites across 3 files
```

**File-level impact fallback (when symbol data unavailable):**
```
Level 0 — Direct change:
  src/auth/login.ts  ← file being modified

Level 1 — Direct dependents (imports Level 0):
  src/routes/auth.routes.ts   fan-in to login.ts
  src/tests/auth.test.ts      fan-in to login.ts

Level 2 — Transitive dependents (imports Level 1):
  src/app.ts                  imports auth.routes.ts
  src/middleware/session.ts   imports auth.routes.ts

Level 3 — Entry point:
  main.ts                     imports app.ts
```

For each affected file, annotate:
- **Risk score** (from HOTSPOTS.md, or calculate: fan-in + size + test coverage)
- **Test coverage**: does a test file cover this file?
- **Contract sensitivity**: does this file export a public API? If yes, callers may break.
- **Module boundary**: does this change cross a module boundary?
- **Structural drift**: does this add a new directory, route, migration, barrel export, dependency, integration, test convention, or locale/copy asset not represented in codebase maps?
- **Feature ownership**: which `FEATURES.md` capability or `intel.json.features[]` entry this file supports, if any.
- **Local-support sensitivity**: whether this affects local run/dev workflows, local config, mocks, seed data, fixtures, compose/devcontainer files, or documented setup.
- **Locale-support sensitivity**: whether this affects locale JSON catalogs, static labels/copy, localized docs, message keys, i18n imports/loaders/providers, route prefixes, language switchers, or fallback/default locale behavior.

**Impact Summary:**
```
Impact Analysis: "Add rate limiting to /api/auth/login"
────────────────────────────────────────────────────────
Changed symbol: AuthService.login (src/auth/login.ts)
Analysis mode:  symbol-level (intel.json v4.1+) / file-level fallback

Direct call sites:
  src/routes/auth.routes.ts:45    risk: 3.1  tests: YES  contract: PUBLIC ← update call
  src/routes/auth.routes.ts:89    risk: 3.1  tests: YES  contract: PUBLIC ← update call
  src/tests/auth.test.ts:8        risk: 1.0  tests: N/A  contract: NONE   ← add test case
  src/middleware/session.ts:12    risk: 2.5  tests: YES  contract: INTERNAL ← verify default

Transitive (file level):
  src/app.ts                      risk: 3.8  tests: partial  contract: ENTRY — no call change needed

Blast radius: 3 files with call sites, 1 transitive
Highest risk file touched: src/auth/login.ts (4.2)
Feature impact: Auth login, Local development support (if env/config touched)
```

If any call site file has risk ≥ 4.0: flag as "Caution — high-risk transitive impact. Consider splitting this change."

If structural drift is introduced, add a non-blocking post-change note:
```
Codebase map drift: [category] at [path]
Suggested refresh: /buildflow-onboard --paths [affected path]
```

If local support is touched, add a preservation checklist before editing:
```
Local Support Preservation
- Existing local command still works: [npm run dev / docker compose ...]
- Required env docs still match code: [.env.example / README]
- Mocks/fixtures/seed data still align with changed behavior
- Local-only defaults did not leak into production config
```

If locale support is touched, add a preservation checklist before editing:
```
Locale Support Preservation
- Existing locale JSON imports still resolve
- Static label/copy catalogs still resolve and keep expected keys
- Message keys added/renamed/removed are updated across all supported catalogs
- Language-specific i18n dependencies/imports still resolve
- Localized docs or README language links are updated when public-facing copy changes
- Default/fallback locale behavior is unchanged unless explicitly requested
- Language switchers/routes still point to valid locale catalogs
- User-facing copy changes include locale test or snapshot updates when available
```

### Step 2c: Locale Catalog Sync (mandatory when keys change — not optional)

**Triggered when any of these is true:**
- Change adds a new label/i18n key in source code (`t('new.key')`, `getString(R.string.newKey)`, `__('new_key')`, `NSLocalizedString("key", ...)`, `I18n.t("key")`)
- Change renames an existing key
- Change removes a key
- Change directly edits a label/copy catalog file (`.json`, `.properties`, `.xml`, `.arb`)

**Action — sync ALL catalog files, not just the one being edited:**

1. Read `intel.json → locale_support`:
   - `catalog_files[]` — all locale catalog paths (en.json, fr.json, messages_en.properties, etc.)
   - `label_catalogs[]` — static label/copy JSON paths (labels.json, strings.json, etc.)
   - `supported_locales[]` — all locale codes
   - `catalog_type` — json / properties / xml / arb / strings / po

2. For each key being added, renamed, or removed:

   **Adding a new key:**
   - Primary locale catalog (from `default_locale`): add the key with the real value from the change description
   - Secondary locale catalogs: add the key with `[TRANSLATE: <primary-locale-value>]` as placeholder — never leave the key missing
   - Static label/copy catalogs (`label_catalogs[]`): add the key with the real value directly (no locale variants)

   **Renaming a key:**
   - ALL catalogs: rename the key, preserve the existing value exactly
   - Grep ALL source files for the old key name before renaming — update every reference
   - Only then rename in all catalog files

   **Removing a key:**
   - Grep ALL source files first — verify no code still references the key before deleting
   - If still referenced: block the removal, flag the remaining references
   - If unreferenced: remove from ALL catalog files

3. Write format per catalog type:

   | Type | Format |
   |------|--------|
   | JSON | `"key": "value"` — match existing nesting structure exactly |
   | Properties | `key=value` one per line — match existing whitespace/comment style |
   | XML (`strings.xml`) | `<string name="key">value</string>` inside `<resources>` |
   | ARB (Flutter) | `"key": "value"` — also add `"@key": {}` metadata if other keys have it |
   | PO | `msgid "key"\nmsgstr "value"` block |
   | `.strings` (iOS) | `"key" = "value";` |

4. Use the **Write tool** to update each catalog file. Do not output the updated content as text — write it to disk.

5. Report the sync before proceeding to Step 3:
   ```
   Locale Catalog Sync
   ───────────────────
   Keys added:   [key names]
   Keys renamed: [old → new]
   Keys removed: [key names]
   Catalogs updated ([N]):
     src/locales/en.json         — added [N] keys (primary values)
     src/locales/fr.json         — added [N] keys ([TRANSLATE] placeholders)
     src/locales/de.json         — added [N] keys ([TRANSLATE] placeholders)
     assets/labels.json          — added [N] keys (static catalog)
   Remaining [TRANSLATE] placeholders: [N] — require human translation
   ```

   If `catalog_files[]` is empty in intel.json but locale code was detected: grep for catalog files now using the same patterns from onboard Step 9c. If still not found: warn "⚠ Locale catalog files not found — update intel.json by running `/buildflow-onboard --update`."

---

## Step 3: API Contract Check
If the change modifies a function/method signature or REST endpoint:

**Before (current contract):**
```
loginUser(email: string, password: string): Promise<AuthToken>
POST /api/auth/login  →  { token: string, expiresAt: number }
```

**After (new contract):**
```
loginUser(email: string, password: string, options?: RateLimitOptions): Promise<AuthToken>
POST /api/auth/login  →  { token: string, expiresAt: number }  [+ 429 Too Many Requests]
```

List all callers that pass through this contract and verify they still compile/run with the new signature. If any caller will break: add fixing those callers to the task list.

---

## Step 4: Test Coverage Map
For each file in the impact chain, verify:
- Does a test file exist that imports or calls it?
- Do those tests cover the behavior being changed?
- After the change, which tests will need updating?

```
Test Coverage for this change:
  login.ts        → src/tests/auth.test.ts (covers: login flow, invalid password)
                    MISSING: rate limit behavior — must add
  auth.routes.ts  → src/tests/routes.test.ts (covers: route registration)
                    OK: no change needed
  session.ts      → NO TESTS FOUND ← flag: untested file in impact chain
```

Flag any untested file in the impact chain as a risk.

---

## Step 5: Confirmation
Show the impact summary, contract change, and test coverage map. Ask:

> "This change touches [N] files with blast radius [N]. Highest-risk: [file] ([score]).
> Proceed, narrow scope, or investigate further?"

Only proceed on explicit confirmation.

---

## Step 6: Restore Point

Before any git command, read `.buildflow/you/preferences.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Use file snapshots, even if `.git/` exists or `light.md` says `git_available: true`.
- If `preferences.md` is missing or `git.permission` is absent: ask the user before running any git command.

**If `git.permission: approved`:**
```bash
git stash push -m "pre-modify: [description]"
# or if nothing to stash:
git tag "pre-modify-$(date +%Y%m%d-%H%M)"
```

**If `git.permission` is not `approved` (no-git mode):**
Copy all files in the impact chain (from Step 2) into `.buildflow/snapshots/pre-modify-[timestamp]/` before writing any changes.
Log in `state.md`: `last_restore_point: .buildflow/snapshots/pre-modify-[timestamp]/`
To roll back: copy snapshot files back to their original paths.

---

## Step 7: Surgical Implementation
Make the minimum effective change:
- Change only what the impact analysis identified
- Follow existing code style (PATTERNS.md)
- Add `LEARN:` comment ONLY if introducing a pattern not present elsewhere
- Do NOT refactor, rename, or clean up surrounding code

For each file modified: confirm it matches the Before → After contract.

---

## Step 7b: Write / Update Tests (mandatory — part of the change, not optional)

### First: detect test framework (if not already known from onboarding)
```bash
# JS/TS
cat package.json | grep -E "jest|vitest|mocha|jasmine|supertest"
ls jest.config.* vitest.config.* 2>/dev/null
find . -name "*.test.ts" -o -name "*.spec.ts" | head -3

# Python
cat requirements.txt pyproject.toml 2>/dev/null | grep pytest

# Go: look for *_test.go files
# Rust: look for #[cfg(test)] blocks
```

| Framework status | Action |
|-----------------|--------|
| Found + test files exist | Follow existing conventions exactly |
| Found + no test files yet | Use framework, create first test file |
| Not found | Warn user: "No test framework detected. Tests skipped. Add [recommended framework] and re-run." Log gap to `security/DEBT.md`. |

For each source file touched in Step 7:

**If a test file already exists for this file:**
- Open it
- Add test cases for every function whose behavior changed
- If the function's signature changed: update the callers in the test
- If the bug was in a specific code path: add a regression test that names the exact scenario

**If no test file exists:**
- Create one following the project test convention (from PATTERNS.md):
  - Co-located: `auth.service.ts` → `auth.service.test.ts`
  - Or in test folder: match existing structure
- Cover: each function touched in this change + the specific behavior the change introduces

**For bugfixes specifically:**
1. Write the regression test BEFORE applying the fix
2. Run **only that specific test file** — confirm it fails (proves the bug exists):
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
3. Apply the fix
4. Run **only that same test file again** — confirm it passes (proves the fix works)
5. Name the test after the exact bug: `should not return null when profile photo is missing`

Do NOT run the full suite during TDD — run only the single new test file each time.

**Test coverage report after this step:**
```
Test changes for this modify
─────────────────────────────
auth.service.ts      → auth.service.test.ts   +3 cases (rate limit happy path, 429 response, reset after window)
auth.routes.ts       → auth.routes.test.ts    +1 case (rate limit header present)
session.ts           → session.test.ts        CREATED — 4 cases (was untested, now covered)
```

Do not proceed to Step 8 until every touched source file has corresponding test coverage.

---

## Step 8: Targeted Test + Verify

Run tests for **changed files and their dependents only** — not the full suite. The full suite runs at `/buildflow-check` and `/buildflow-ship`.

**Pure style/config/data fast path:** If ALL changed files are pure style (`.css`, `.scss`, `.sass`, `.less`, `.styl`), locale/label catalogs (`.json` label catalogs, `.properties`, `strings.xml`, `.arb`, `.po`, `.strings`), or static assets — skip this step entirely. No logic changed, no tests to run.

**Targeted test set:**
1. Direct test file(s) for every **source file** touched — exclude pure style/data/config files from this list
2. Tests for callers of any changed contract (from `symbol_callers` in intel.json, or Step 2 impact chain)
3. If no direct test file exists for a source file: **create one** (Step 7b). Do NOT fall back to the nearest enclosing package/module — that path runs the full suite.

```bash
# JS/TS
npx jest --testPathPattern="[touched-file-name]"
npx vitest run [test-file] [caller-test-file]

# Python
pytest tests/[module]/test_[file].py tests/[caller-module]/

# Go
go test ./[package]/...

# Rust
cargo test [module]::

# Java/Kotlin (Maven)
./mvnw test -Dtest=[TouchedClass]Test,[CallerClass]Test -q

# Java/Kotlin (Gradle)
./gradlew test --tests "*.TouchedClassTest" --tests "*.CallerClassTest"

# C# / .NET
dotnet test --filter "FullyQualifiedName~TouchedClass"

# Ruby
bundle exec rspec [touched_spec] [caller_spec]

# PHP
./vendor/bin/phpunit [TouchedTest] [CallerTest]

# Dart / Flutter
flutter test test/[touched_test].dart

# Swift
xcodebuild test -only-testing "[Target]/[TouchedClassTests]"

# Scala
sbt "testOnly *.[TouchedClassSpec]"
```

On failure: fix and re-run. Max 3 attempts.

Also verify:
- All files in the impact chain still compile
- Callers of changed contracts still function
- The regression test (for bugfixes) now passes

**After targeted tests pass — ask once:**
```
──────────────────────────────────────────────────
Targeted tests passed. Run full app-level test suite?
  [Y] Yes — run full suite now
  [N] No  — skip and proceed to Update Memory
──────────────────────────────────────────────────
```
- **[Y]:** Run the full test suite. On failure: report what broke — do not auto-fix regressions here, they may be pre-existing.
- **[N]:** Skip. Proceed to Step 9. Full suite runs at `/buildflow-check` and `/buildflow-ship`.

---

## Step 9: Update Memory
```yaml
last_modify: [today]
change: [description]
files_changed: [N]
impact_level: [direct/level1/level2]
```

---

## --dry-run Flag
Runs Steps 1–5 only. Shows full impact analysis and contract changes without modifying any file.
Use this before a risky change to understand blast radius first.

## Token cost report (print at end of modify)

Measure actual cost before printing:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output from text generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Modify complete — [description] · [N] files changed · impact: [direct/level1/level2]
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in preferences.md):
```
Token Cost — /buildflow-modify
────────────────────────────────
Analysis mode: [symbol-level / file-level fallback]
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Change applied — verify spec compliance and no regressions
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If this was a `--dry-run`: `→ Next: /buildflow-modify` (re-run without --dry-run to apply the change).
If impact level was high (level2 or deeper): `→ Next: /buildflow-test` (targeted test run before full check).

## Token Budget: ~30K (more if impact chain is deep)
