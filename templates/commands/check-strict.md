---
name: buildflow-check-strict
description: Module — strict mode structural spec-to-code mirroring, ship readiness gate, and final report. Loaded by /buildflow-check when --strict flag is active.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Check Strict Module

Loaded by /buildflow-check when --strict flag is active or strict_mode: true in PREFERENCES.md. Executes Step 5c (strict structural verification) through final ship readiness report. Returns verdict to main check command.
## Step 5c: Strict Mode (`/buildflow-check --strict` or `strict_mode: true` in PREFERENCES.md)

Strict mode enforces **structural spec-to-code mirroring**. Use for critical infrastructure phases (auth, payments, crypto, permissions, migrations) where divergence between spec structure and code structure is a defect, not a style choice.

Skip this step entirely if neither `--strict` flag nor `strict_mode: true` is set.

### Load Critical Module Patterns
Read `strict_critical_modules` from `.buildflow/PREFERENCES.md`:
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

Read the API Contracts table from `SPEC.md`. For each contract row:

1. Locate the handler/function in the codebase:
   ```bash
   grep -rn "router\.\(post\|get\|put\|patch\|delete\)\|app\.\(post\|get\|put\|patch\|delete\)\|@\(Post\|Get\|Put\|Patch\|Delete\)\|def [a-z_]*:" src/ --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rb" | grep -i "[path-fragment]"
   ```
2. Verify **request shape field names** match exactly — not just "a body exists":
   - Extract field names from SPEC.md contract row
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
POST /api/login  [SPEC.md row 1]
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

Read the Component Map table from `SPEC.md`. For each row:

1. **Existence check** — verify the file/module the component maps to exists:
   ```bash
   # derive file path from component name using PATTERNS.md conventions
   ```
2. **Isolation check** — heuristic for single-responsibility: a component should not import from more than one other layer. Flag if a Repository imports a Service, or a Controller imports a Repository directly (bypassing service).
   ```bash
   grep -n "^import\|^from\|^require" [component_file] | head -20
   ```
3. **Requirements linkage** — every component must be linked to at least one feature (F-XX). If `Interface Type` column is populated, verify the interface type matches actual implementation (REST route vs gRPC stub vs event handler vs plain function).

Reverse check — for each file **created or modified this phase**, verify it appears in the SPEC.md Component Map:
```bash
# git.permission approved:
git diff --name-only HEAD~[wave-count]..HEAD -- src/
# git.permission not approved: read from wave files task "Files to create/modify" fields
```

Report:
```
S2: Component Map Verification
───────────────────────────────
AuthService      → src/auth/service.ts     ✓ exists  ✓ isolated  ✓ linked F-01
UserRepository   → src/users/repo.ts       ✓ exists  ✓ isolated  ✓ linked F-01
LoginRoute       → src/routes/auth.ts      ✓ exists  ⚠ imports AuthService + DB directly (verify: intentional?)

Ghost components  (in code this phase, not in SPEC.md Component Map):
  src/utils/tokenHelper.ts  — ✗ not mapped
    → Add to SPEC.md Component Map or mark ACCEPTABLE-UTILITY

Orphaned components  (in SPEC.md, not found in code):
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

Write results to `.buildflow/epics/[epic]/STRICT-REPORT.md` — the ship gate reads this file.

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

Before exiting, update `.buildflow/epics/[epic]/CHECK.md`:
- For each AC checked, set `PASS`, `FAIL`, `BLOCKED`, `DEFERRED`, or `IN PROGRESS`.
- Add reviewer evidence and command output summaries to `Test/Evidence` or `Notes`.
- Add manual UAT confirmation, failure, or pending notes for user-confirmed use cases.
- Append any check commands to `## Test Runs`.
- Refresh `## Summary` counts and `Last updated`.

## Guided Next Step

Before printing this block, check session context usage. Because check results decide whether the phase can ship, recommend clearing the current AI session after saving `STATE.md` when context is large/noisy or the check has completed.

```
──────────────────────────────────────────────────
→ Next:  /buildflow-ship
   Why:  All [N] ACs passing, no blockers — ready to run ship gates
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
```

If any AC failed: `→ Next: /buildflow-build` to fix the failing tasks (specify which wave).
If schema drift detected: `→ Next: resolve schema drift (run pending migrations or add migration file), then re-run /buildflow-check`.
If spec coverage below threshold and no exception recorded: the smart prompt in Step 4c already captured user decision — next step is whatever was chosen.
If strict mode FAIL: `→ Next: fix strict violations listed in STRICT-REPORT.md, then re-run /buildflow-check --strict`.
