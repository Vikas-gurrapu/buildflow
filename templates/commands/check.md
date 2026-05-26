---
name: buildflow-check
description: Verify quality and spec compliance with parallel Reviewer agents
allowed-tools: Read, Bash, Grep, Glob
agent: reviewer
---

# /buildflow-check

Quality and spec-compliance verification. Four parallel Reviewers check code correctness, quality, security, and — most importantly — whether every acceptance criterion is actually satisfied.

## Usage
- `/buildflow-check` — full check: spec + code + security
- `/buildflow-check <file>` — check a specific file
- `/buildflow-check acceptance` — spec compliance only
- `/buildflow-check tests` — test coverage only

## Context Packet (load only these)
- `.buildflow/specs/acceptance.md` — the source of truth for what must be true
- `.buildflow/phases/[N]/PLAN.md` — what was supposed to be built
- `.buildflow/phases/[N]/VERIFICATION.md` - AC verification ledger from plan/build
- Changed files — detected as follows:
  - **If `git.permission: approved`:** `git diff --name-only HEAD~[wave-count]..HEAD -- src/`
  - **If `git.permission` is not `approved`:** read the file list from wave completion records in `PLAN.md` (the `Files to create/modify` field per completed task) — this is the authoritative list of what changed
- `.buildflow/codebase/PATTERNS.md` (if exists)
- `.buildflow/codebase/STRUCTURE.md` (if exists — structural drift and expected paths)
- `.buildflow/codebase/TESTING.md` (if exists — expected test commands/layout)
- `.buildflow/codebase/CONCERNS.md` (if exists — known fragile areas)
- `.buildflow/codebase/INTEGRATIONS.md` (if exists — env/webhook/external service contracts)

Do NOT load: REQUIREMENTS.md, old phases, research files, retros.
Load TECHINICALDESIGN.md only when running `--strict`.

Also load `.buildflow/phases/[N]/STATE.md` if it exists. Use it to resume status, risks, and test strategy.

---

## Phase State Resume
Read `.buildflow/core/state.md`, `.buildflow/memory/light.md`, `.buildflow/phases/[N]/PLAN.md`, `.buildflow/phases/[N]/VERIFICATION.md`, and `.buildflow/phases/[N]/STATE.md` if it exists.

Use `STATE.md` to understand what build completed, what tests were already run, and which risks/skips need verification. If it says `Status: check_passed` and current inputs have not changed, continue to the guided next step instead of repeating checks unless the user asks.

Before exiting, update `.buildflow/phases/[N]/STATE.md` with:
- Current State: `Status: check_passed` or `Status: check_failed`
- Decisions: user choices for coverage/strict/schema issues
- Files That Matter: reports written, changed files checked, and blockers
- Next Command: `/buildflow-ship` when passing, otherwise the exact `/buildflow-build` or `/buildflow-check` retry
- Risks / Open Questions: failed ACs, schema drift, low coverage, strict violations, skipped checks
- Test Strategy: checks/tests run, coverage map status, and remaining ship regression gate

---

## Step 1: Load Acceptance Criteria
Read every AC from `.buildflow/specs/acceptance.md`.
This is the primary verification target — all other checks are secondary.
Read `.buildflow/phases/[N]/VERIFICATION.md` and compare its AC list/statuses against `acceptance.md`.

If `VERIFICATION.md` is missing or stale:
- Recreate or refresh it from `acceptance.md` before checking.
- Preserve existing test run evidence when AC IDs still match.
- Mark new/changed ACs as `NOT STARTED`.

## Step 2: Parallel Review (4 reviewers)

**Reviewer A — Spec Compliance (most important):**
For each acceptance criterion:
- AC-001: Given [context], when [action], then [outcome] — does the code make this true?
- AC-002: ... etc.

Score each:
```
AC-001 ✓  PASS  — [brief evidence]
AC-002 ✓  PASS  — [brief evidence]
AC-003 ✗  FAIL  — [what's missing or wrong]
AC-NF-001 ⚠ PARTIAL — [what works, what doesn't]
```

**Reviewer B — Correctness:**
- Does the code do what was specified?
- Are edge cases handled?
- Are there logical errors?

**Reviewer C — Code Quality:**
- Is the code readable?
- Are there unnecessary duplications?
- Does it match `.buildflow/codebase/PATTERNS.md`?
- Does it fit the paths/modules documented in `.buildflow/codebase/STRUCTURE.md`?
- Does it avoid known fragile areas or include guards from `.buildflow/codebase/CONCERNS.md`?
- Are functions appropriately sized?

**Reviewer D — Security:**
- No hardcoded secrets?
- No obvious injection risks?
- No sensitive data in logs?
- External service/env/webhook changes match `.buildflow/codebase/INTEGRATIONS.md` or include map-update notes.
- Relevant ACs for auth/security satisfied?

## Step 3: Schema Drift Detection

If the project has a database schema (SQL migrations, Prisma schema, TypeORM entities, SQLAlchemy models, Django models, Mongoose schemas), check for drift between the schema definition and its consumers.

### Detection:
```bash
# Find schema definition files
find . -name "schema.prisma" -o -name "*.migration.sql" -o -name "models.py" -o -name "*.entity.ts" | grep -v node_modules | head -10
# Find last migration timestamp
ls -lt migrations/ db/migrations/ prisma/migrations/ 2>/dev/null | head -5
# Find files that reference schema entities (potential consumers)
grep -rn "findUnique\|findMany\|select\|INSERT INTO\|UPDATE.*SET\|Model\." src/ --include="*.ts" --include="*.py" | head -20
```

### Drift checks:

**1. Unapplied migrations** — migrations exist but haven't been run:
```bash
# Prisma
npx prisma migrate status 2>/dev/null
# Django
python manage.py showmigrations 2>/dev/null | grep "\[ \]"
# Flyway / Liquibase
# Check if migration files are newer than last applied marker
```

**2. Schema-consumer mismatch** — code references a field or table that doesn't exist in the schema:
- Read schema definition files
- Grep consumers for field/column names
- Flag any consumer reference that doesn't appear in the schema

**3. Missing migration for schema change** — if schema file was modified in this phase but no new migration file was added:

Before any git command, read `.buildflow/you/preferences.md`.

**If `git.permission: approved`:**
```bash
git diff HEAD~1 -- "*.prisma" "schema.sql" "models.py" "*.entity.ts"
git diff HEAD~1 --name-only -- "migrations/" "db/migrations/"
```

**If `git.permission` is not `approved` (no-git mode):**
Compare current schema file hash against `drift_baseline.file_hashes` in `intel.json`.
If hash differs AND no new file exists in `migrations/` newer than the last wave snapshot: FLAG.

If schema file changed but no migration added: FLAG.

**Schema Drift Report:**
```
Schema Drift Check
──────────────────
Unapplied migrations: NONE / [N] pending — run before ship
Schema-consumer gaps: NONE / [field] in [file] not found in schema
Missing migration:    NONE / schema.prisma changed but no migration added
```

If any drift detected: **BLOCK ship readiness.** "Schema drift found — resolve before shipping."

---

## Step 3b: Codebase Map Drift Detection

If `.buildflow/codebase/STRUCTURE.md` exists, classify changed files against the last mapped structure:

| Category | Trigger |
|----------|---------|
| `new_dir` | new directory/path not represented in `STRUCTURE.md` |
| `route` | new route/API/page/screen file |
| `migration` | schema/migration file |
| `barrel` | new `index.ts/js` public export |
| `dependency` | package/lock/build config changed |
| `integration` | API client/webhook/auth/env contract changed |
| `test` | test framework/config/fixture layout changed |
| `copy_locale` | locale catalog, label/copy catalog, or localized docs changed |

This is non-blocking unless `--strict` is active.

Output:
```
Codebase map drift: NONE / [N elements]
Suggested refresh: /buildflow-onboard --paths [affected paths]
```

If `--strict` and drift affects files changed in this phase, mark check as FAIL until the map is refreshed or the user explicitly waives mapping freshness.

---

## Step 4: Spec Coverage Traceability

### 4a: Load Coverage Threshold
Read `.buildflow/you/preferences.md` for:
```yaml
spec_coverage:
  threshold: 80          # % of business-logic files that must have AC traceability
  strict_mode: false     # true = prompt on any drop; false = only prompt if below threshold
```
If not set, use default threshold of **70%**.

### 4b: Build Coverage Map
Get files changed this phase:

```bash
# If git.permission is approved:
git diff --name-only HEAD~[wave-count]..HEAD -- src/ 2>/dev/null
# If git.permission is not approved: read from PLAN.md task "Files to create/modify" fields (all completed tasks)
grep -A2 "Files to create/modify:" .buildflow/phases/[N]/PLAN.md 2>/dev/null

# For each changed file, check if any test file imports it
grep -rn "[filename without ext]" --include="*.test.*" --include="*.spec.*" src/ tests/ 2>/dev/null
```

For each changed source file, cross-reference against `acceptance.md`:
- Does any AC's "Given/When/Then" scenario directly test the behavior in this file?
- Does any test file cover this file AND is that test linked to an AC?

**Coverage traceability map:**
```
Spec Coverage Map  (Phase [N])
──────────────────────────────
src/auth/service.ts      → AC-001, AC-002  ✓ covered
src/auth/middleware.ts   → AC-001          ✓ covered
src/routes/auth.ts       → AC-001, AC-003  ✓ covered
src/utils/crypto.ts      → NONE            ✗ UNCOVERED
src/utils/format.ts      → NONE            ✗ UNCOVERED (utility — acceptable)

Coverage: 3/5 files have AC traceability (60%)
Uncovered: 2 files — 1 flagged, 1 marked acceptable
Threshold: 70%  →  ⚠ BELOW THRESHOLD
```

**Uncovered file classification:**
- **Utility / pure functions** (format, parse, transform with no business logic) → mark as `ACCEPTABLE — utility`
- **Business logic files with no AC** → flag as `⚠ UNCOVERED BUSINESS LOGIC`
- **Infra/config files** (db.config, app.module, main.ts) → mark as `ACCEPTABLE — infra`

### 4c: Smart Coverage Prompt
Coverage never hard-blocks. When coverage is below threshold, show the context-aware prompt:

```
Spec Coverage Below Threshold
──────────────────────────────
Coverage: [N]% of business-logic files have AC traceability
Required: [threshold]% (set in preferences.md → spec_coverage.threshold)

Uncovered business-logic files:
  src/utils/crypto.ts      — no AC, no test linkage
  src/services/payment.ts  — no AC, no test linkage

Context (answer to get the right guidance):

  [B] This is a bugfix phase — coverage tracking for this phase is less relevant
       (the fix targeted a specific bug, not new behavior)
  [N] We recently started adding test coverage for this flow
       (coverage is intentionally partial — we're building it up incrementally)
  [A] Add ACs now — I'll define missing ACs and re-run check
  [P] Proceed anyway — log gap to DEBT.md and continue to ship
```

**On [B] — bugfix exception:**
Log to DEBT.md: "Coverage below threshold [N]% — accepted: bugfix phase [date]. Review at next feature phase."
Proceed. No block.

**On [N] — new coverage exception:**
Ask: "Which files are part of the coverage build-up?" 
Mark those files as `ACCEPTABLE — coverage in progress` in COVERAGE-MAP.md.
Log: "Coverage below threshold [N]% — accepted: incremental coverage build-up for [files] [date]."
Proceed. No block.

**On [A] — add ACs:**
Pause check. User defines ACs, then re-run `/buildflow-check acceptance`.

**On [P] — proceed:**
Log to DEBT.md: "Coverage below threshold [N]% — accepted: developer decision [date]. Address in future phase."
Proceed. No block.

Write the coverage map to `.buildflow/phases/[N]/COVERAGE-MAP.md` for the ship gate to read.
Include the decision and reason taken in Step 4c.

---

## Step 5: Test Check
- Do all tests pass?
- Are new tests written for new code?
- Is each AC covered by at least one test?

---

## Step 5b: Manual UAT Confirmation

Treat UAT as a manual confirmation step. Do not mark subjective user flows, UX behavior, business workflow correctness, copy/label expectations, or external integration behavior as fully UAT-passed from code inspection alone.

Build a short use-case checklist from `acceptance.md`, `PLAN.md`, and changed files:
```
Manual UAT needed
─────────────────
I can verify code/tests, but these use cases need user confirmation:

1. [Use case name] — covers AC-[N], AC-[N]
   What to check: [specific user action and expected visible result]
2. [Use case name] — covers AC-[N]
   What to check: [specific user action and expected visible result]
3. [Use case name] — covers AC-[N]
   What to check: [specific user action and expected visible result]

Please test these and confirm:
1. All pass
2. Some fail — tell me which use case and what happened
3. Skip UAT for now — record as pending before ship
```

If the user confirms all pass:
- Mark the related rows in `VERIFICATION.md` as `PASS` only when automated evidence is also sufficient, otherwise `IN PROGRESS` with note `Manual UAT passed; automated evidence pending`.
- Add a `## Test Runs` row with `Scope: Manual UAT`, `Command: user-confirmed`, `Result: PASS`, and covered ACs.

If the user reports failures:
- Mark affected ACs as `FAIL` or `BLOCKED`.
- Add the failure details to `Notes`.
- Ship readiness is blocked until fixed.

If the user skips UAT:
- Mark affected ACs as `IN PROGRESS` or `DEFERRED`.
- Add `Manual UAT pending` to `Notes`.
- Do not claim full AC readiness. Ship can proceed only if `/buildflow-ship` explicitly accepts or resolves the pending UAT.

---

## Step 5c: Strict Mode (`/buildflow-check --strict` or `strict_mode: true` in preferences.md)

Strict mode enforces **structural spec-to-code mirroring**. Use for critical infrastructure phases (auth, payments, crypto, permissions, migrations) where divergence between spec structure and code structure is a defect, not a style choice.

Skip this step entirely if neither `--strict` flag nor `strict_mode: true` is set.

### Load Critical Module Patterns
Read `strict_critical_modules` from `.buildflow/you/preferences.md`:
```yaml
strict_critical_modules:
  - auth
  - payment
  - crypto
  - migration
  - permission
  - role
  - token
  - secret
  - key
  - sign
  - verify
```
If not set, use the default list above. Any file whose path matches one of these patterns is a **critical module**.

---

### S1: Technical Design API Contract Verification

Read the API Contracts table from `TECHINICALDESIGN.md`. For each contract row:

1. Locate the handler/function in the codebase:
   ```bash
   grep -rn "router\.\(post\|get\|put\|patch\|delete\)\|app\.\(post\|get\|put\|patch\|delete\)\|@\(Post\|Get\|Put\|Patch\|Delete\)\|def [a-z_]*:" src/ --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rb" | grep -i "[path-fragment]"
   ```
2. Verify **request shape field names** match exactly — not just "a body exists":
   - Extract field names from TECHINICALDESIGN.md contract row
   - Grep handler for each field name
   - Flag any field that is absent or renamed
3. Verify **response shape field names** match exactly:
   - Grep serializer, return statement, or response object for each field
   - Flag missing or renamed fields
4. Verify **all listed status codes** have explicit handling (not only a catch-all 500):
   - For each status code: grep for its literal value (`res.status(401)`, `return 401`, `raise HTTPException(status_code=401)`, etc.)
5. Verify **auth requirement** — if `Auth: yes`, check that an auth middleware or guard is applied to the route.

Report per contract:
```
S1: API Contract Verification
──────────────────────────────
POST /api/login  [TECHINICALDESIGN.md row 1]
  Request fields: { email, password }
    ✓ email    — found at src/auth/handler.ts:14
    ✓ password — found at src/auth/handler.ts:14
  Response fields: { token, user }
    ✗ token    — handler returns "accessToken" — NAME MISMATCH
    ✓ user     — found
  Status codes: 200, 400, 401, 500
    ✓ 200 — explicit success return
    ✓ 400 — validation branch at :28
    ✓ 401 — wrong credentials branch at :35
    ✗ 500 — only generic catch, no explicit 500 handling
  Auth: no — ✓ no auth guard on route

  → 2 contract divergences
```

**Contract divergences are STRICT FAILURES** — not warnings.

---

### S2: Component Map Verification

Read the Component Map table from `TECHINICALDESIGN.md`. For each row:

1. **Existence check** — verify the file/module the component maps to exists:
   ```bash
   # derive file path from component name using PATTERNS.md conventions
   ```
2. **Isolation check** — heuristic for single-responsibility: a component should not import from more than one other layer. Flag if a Repository imports a Service, or a Controller imports a Repository directly (bypassing service).
   ```bash
   grep -n "^import\|^from\|^require" [component_file] | head -20
   ```
3. **Requirements linkage** — every component must be linked to at least one feature (F-XX). If `Interface Type` column is populated, verify the interface type matches actual implementation (REST route vs gRPC stub vs event handler vs plain function).

Reverse check — for each file **created or modified this phase**, verify it appears in the TECHINICALDESIGN.md Component Map:
```bash
# git.permission approved:
git diff --name-only HEAD~[wave-count]..HEAD -- src/
# git.permission not approved: read from PLAN.md task "Files to create/modify" fields
```

Report:
```
S2: Component Map Verification
───────────────────────────────
AuthService      → src/auth/service.ts     ✓ exists  ✓ isolated  ✓ linked F-01
UserRepository   → src/users/repo.ts       ✓ exists  ✓ isolated  ✓ linked F-01
LoginRoute       → src/routes/auth.ts      ✓ exists  ⚠ imports AuthService + DB directly (verify: intentional?)

Ghost components  (in code this phase, not in TECHINICALDESIGN.md Component Map):
  src/utils/tokenHelper.ts  — ✗ not mapped
    → Add to TECHINICALDESIGN.md Component Map or mark ACCEPTABLE-UTILITY

Orphaned components  (in TECHINICALDESIGN.md, not found in code):
  NONE
```

Ghost components in non-critical paths → warn. Ghost components in critical module paths → **STRICT FAILURE**.

---

### S3: Critical Symbol AC Coverage

For every exported symbol (function, class, method, constant) in critical modules:

1. If `intel.json` has `file_index[].symbols[]`: read symbol list from there.
2. Otherwise: grep for exported symbols:
   ```bash
   # TypeScript/JavaScript
   grep -n "^export\s\+\(function\|class\|const\|default\|async\)" [file]
   # Python
   grep -n "^def \|^class \|^async def " [file]
   # Go
   grep -n "^func [A-Z]" [file]
   # Java/Kotlin/C#
   grep -n "public\s\+\(static\s\+\)\?\(void\|[A-Z][a-zA-Z]*\)" [file]
   ```
3. For each exported symbol: check if any AC's Given/When/Then text references the behavior it implements. Match by function name, endpoint path, or feature description.
4. If no AC matches: flag as **UNCOVERED CRITICAL SYMBOL**.

Internal helper functions (unexported, prefixed `_` or lowercase-only in Python/Go) are exempt.

Report:
```
S3: Critical Symbol AC Coverage
─────────────────────────────────
src/auth/service.ts  (CRITICAL — path contains: auth, token)
  login()           → AC-001, AC-002  ✓ covered
  logout()          → NONE            ✗ UNCOVERED CRITICAL SYMBOL
  refreshToken()    → AC-004          ✓ covered
  _hashPassword()   → exempt (unexported)

src/utils/crypto.ts  (CRITICAL — path contains: crypto)
  generateKey()     → NONE            ✗ UNCOVERED CRITICAL SYMBOL
  encrypt()         → AC-NF-003       ✓ covered
  decrypt()         → AC-NF-003       ✓ covered

Uncovered critical symbols: 2  →  STRICT FAILURE
```

---

### S4: AC Branch Completeness

For each feature's ACs, verify the linked code has a corresponding execution branch:

- **Happy path AC** → the main implementation path exists (function is callable, route is registered)
- **Error/edge case AC** → explicit error-handling code exists in the linked function: `try/catch`, guard clause, early `return`/`throw`, explicit error status code, or conditional branch

```bash
# Locate the function body for each AC-linked symbol
# Check for error handling patterns:
grep -n "catch\|throw\|return.*error\|return.*null\|raise\|panic\|Result::Err\|if.*!ok\|if err !=" [file] | grep -A2 -B2 "[function-name]"
```

Report:
```
S4: AC Branch Completeness
───────────────────────────
F-01: Auth Login
  AC-001 (happy: valid login → token)      → login()         ✓ success path exists
  AC-002 (happy: remember-me → long TTL)   → login()         ✓ TTL branch at :42
  AC-003 (error: wrong password → 401)     → login()         ✓ explicit 401 at :35
  AC-004 (edge: expired token → re-auth)   → refreshToken()  ✗ no expiry check found — MISSING BRANCH

F-02: Password Reset
  AC-005 (happy: reset email sent)         → sendReset()     ✓ success path
  AC-006 (edge: unknown email → 404)       → sendReset()     ✓ guard clause at :18
```

Missing branches are **STRICT FAILURES**.

---

### Strict Gate Summary

```
Strict Mode Gate
─────────────────────────────────────────────
API contracts:       [N/N passing]   [N divergences]
Component map:       [ALIGNED / N ghost / N orphaned]
Critical coverage:   [N/N symbols covered]
AC branches:         [N/N complete]

Strict verdict: PASS / FAIL
```

Write results to `.buildflow/phases/[N]/STRICT-REPORT.md` — the ship gate reads this file.

If **FAIL**: list every strict violation with file:line. These block ship. They are not style suggestions — they are spec-code divergences.
If **PASS**: "Strict mode: code structure mirrors spec structure. Safe to ship."

---

## Step 6: Synthesize Findings

```
Spec Compliance
───────────────
AC-001 ✓  login with valid credentials redirects to dashboard
AC-002 ✓  login with wrong password shows error message
AC-003 ✗  FAIL — password reset email not implemented
AC-NF-001 ⚠ login endpoint has no rate limiting

Code Quality
────────────
✓ PASS  naming conventions match PATTERNS.md
⚠ WARN  AuthService is 340 lines — consider splitting
✗ FAIL  SQL query in getUserById is not parameterized (injection risk)
```

## Step 7: Ship Readiness

| Condition | Status |
|-----------|--------|
| All ACs passing | ✓ / ✗ |
| No FAIL-level code issues | ✓ / ✗ |
| Tests passing | ✓ / ✗ |
| Security gate clear | ✓ / ✗ |
| Schema drift: none | ✓ / ✗ |
| Spec coverage: >70% business logic | ✓ / ⚠ |
| Strict mode: code mirrors spec (if enabled) | ✓ / ✗ / — |

- **All green:** "Ready for `/buildflow-ship`"
- **AC failures:** "Spec not complete. Fix AC failures before shipping — they represent unfinished features, not code style."
- **Schema drift found:** "Schema drift detected. Run migrations or add missing migration files before shipping."
- **Low spec coverage:** "⚠ [N]% of business-logic files have no AC coverage — consider adding ACs or acceptable-utility markers before shipping."
- **Strict failures:** "Strict mode: [N] spec-code divergences found. Code structure does not mirror spec structure — resolve before shipping."
- **Code failures only:** "Spec satisfied. Fix code issues or proceed with caution."

Manual UAT readiness:
- Include `Manual UAT confirmed` in the readiness summary with status `PASS`, `FAIL`, or `PENDING`.
- If manual UAT is pending, say: "Manual UAT is pending. Ask the user to test the listed use cases or record an explicit skip before ship."
- If manual UAT failed, block ship and point to the failed use case and affected ACs.

Before exiting, update `.buildflow/phases/[N]/VERIFICATION.md`:
- For each AC checked, set `PASS`, `FAIL`, `BLOCKED`, `DEFERRED`, or `IN PROGRESS`.
- Add reviewer evidence and command output summaries to `Test/Evidence` or `Notes`.
- Add manual UAT confirmation, failure, or pending notes for user-confirmed use cases.
- Append any check commands to `## Test Runs`.
- Refresh `## Summary` counts and `Last updated`.

## Token cost report (print at end of check)

Measure actual cost before printing:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output from text generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

```
Token Cost — /buildflow-check
──────────────────────────────
ACs: [N/N passing]  Schema drift: [clean/N issues]  Coverage: [N]%  Strict: [PASS/FAIL/—]
Context loaded:    ~[N]K tokens   (acceptance.md + PLAN.md + [N] changed files)
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

Before printing this block, check session context usage. Because check results decide whether the phase can ship, recommend clearing the current AI session after saving `STATE.md` when context is large/noisy or the check has completed.

```
──────────────────────────────────────────────────
→ Next:  /buildflow-ship
   Why:  All [N] ACs passing, no blockers — ready to run ship gates
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If any AC failed: `→ Next: /buildflow-build` to fix the failing tasks (specify which wave).
If schema drift detected: `→ Next: resolve schema drift (run pending migrations or add migration file), then re-run /buildflow-check`.
If spec coverage below threshold and no exception recorded: the smart prompt in Step 4c already captured user decision — next step is whatever was chosen.
If strict mode FAIL: `→ Next: fix strict violations listed in STRICT-REPORT.md, then re-run /buildflow-check --strict`.

## Token Budget: ~26K standard / ~38K with --strict (adds TECHINICALDESIGN.md + symbol grep + branch analysis)
