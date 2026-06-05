---
name: buildflow-check
description: Verify quality and spec compliance with parallel Reviewer agents
allowed-tools: Read, Bash, Grep, Glob
agent: reviewer
multi-agent: true
---

# /buildflow-check

Quality and spec-compliance verification. Four parallel Reviewers check code correctness, quality, security, and — most importantly — whether every acceptance criterion is actually satisfied.

## Usage
- `/buildflow-check` — full check: spec + code + security
- `/buildflow-check <file>` — check a specific file
- `/buildflow-check acceptance` — spec compliance only
- `/buildflow-check tests` — test coverage only

## Context Packet (load only these)
- `.buildflow/epics/[epic]/ACCEPTANCE.md` — the source of truth for what must be true
- `.buildflow/epics/[epic]/PLAN.md` (index) — what was supposed to be built
- `.buildflow/epics/[epic]/waves/wave-[N].md` (relevant wave file(s)) — task details
- `.buildflow/epics/[epic]/CHECK.md` — AC coverage map + verification ledger
- Changed files — detected as follows:
  - **If `git.permission: approved`:** `git diff --name-only HEAD~[wave-count]..HEAD -- src/`
  - **If `git.permission` is not `approved`:** read the file list from wave files for completed tasks — this is the authoritative list of what changed
- `.buildflow/codebase/PATTERNS.md` (if exists)
- `.buildflow/codebase/CODEBASE.md` (if exists — structural drift and expected paths)
- `.buildflow/codebase/TESTING.md` (if exists — expected test commands/layout)
- `.buildflow/codebase/RISKS.md` (if exists — known fragile areas)
- `.buildflow/codebase/DEPENDENCIES.md` (if exists — env/webhook/external service contracts)

Do NOT load: old phases, research files, retros.
Load SPEC.md only when running `--strict`.

Also load `.buildflow/epics/[epic]/STATE.md` if it exists. Use it to resume status, risks, and test strategy.

---

**Pre-flight:** Read STATE.md + MEMORY.md + PLAN.md + CHECK.md + epic STATE.md. If `Status: check_passed` and inputs unchanged → skip to Guided Next Step. Before exiting: update epic STATE.md with check_passed/failed, decisions, blockers, next command.

**Agent protocol:** Claude Code — spawn all 4 Reviewers in one response. Other tools — sequential with `=== Reviewer [A/B/C/D] START/END ===`.

## Step 1: Load ACs & Verify Coverage

Read all ACs from ACCEPTANCE.md — primary verification target. Read CHECK.md; recreate/refresh if missing or stale. Mark new/untracked ACs as `NOT STARTED`.

**Scope check:** cross-reference ACCEPTANCE.md vs PLAN.md and CHECK.md. ACs dropped from plan → FAIL regardless of reviewers. ACs not tracked in CHECK.md → mark `NOT STARTED`, include in Reviewer A. 0 issues → silent.

---

## Step 2: Parallel Review (4 reviewers)

**Claude Code** — spawn all 4 Reviewers in one response:
```
Agent({ description: "Reviewer A: Spec Compliance", prompt: "You are a BuildFlow Reviewer checking spec compliance. For each AC in ACCEPTANCE.md, verify the code satisfies it. Score each: AC-ID ✓ PASS / ✗ FAIL / ⚠ PARTIAL with brief evidence. Files to read: ACCEPTANCE.md, CHECK.md, changed source files." })
Agent({ description: "Reviewer B: Correctness",     prompt: "You are a BuildFlow Reviewer checking correctness. Does the code do what was specified? Are edge cases handled? Are there logical errors? Read changed source files and PLAN.md task descriptions." })
Agent({ description: "Reviewer C: Code Quality",    prompt: "You are a BuildFlow Reviewer checking code quality. Check: readability, unnecessary duplications, pattern compliance vs PATTERNS.md, module fit vs CODEBASE.md, fragile areas per RISKS.md, function size." })
Agent({ description: "Reviewer D: Security",        prompt: "You are a BuildFlow Reviewer checking security. Check: no hardcoded secrets, no injection risks (SQL/command/XSS), no sensitive data in logs, DEPENDENCIES.md coverage for external changes, auth/security ACs satisfied." })
```

**Gemini CLI / Codex CLI / Cursor** — sequential:
`=== Reviewer A: Spec Compliance START ===` → check all ACs → `=== Reviewer A END ===`
`=== Reviewer B: Correctness START ===` → check logic/edge cases → `=== Reviewer B END ===`
`=== Reviewer C: Code Quality START ===` → check patterns/structure → `=== Reviewer C END ===`
`=== Reviewer D: Security START ===` → check secrets/injection/auth → `=== Reviewer D END ===`

---

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
- Does it fit the paths/modules documented in `.buildflow/codebase/CODEBASE.md`?
- Does it avoid known fragile areas or include guards from `.buildflow/codebase/RISKS.md`?
- Are functions appropriately sized?

**Reviewer D — Security:**
- No hardcoded secrets?
- No obvious injection risks?
- No sensitive data in logs?
- External service/env/webhook changes match `.buildflow/codebase/DEPENDENCIES.md` or include map-update notes.
- Relevant ACs for auth/security satisfied?

## Step 3: Drift Detection

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

Apply Git Permission Guard: read `git.permission` from `PREFERENCES.md`. If not `approved`: no git commands this session.


---

### Codebase Map Drift

If `.buildflow/codebase/CODEBASE.md` exists, classify changed files against the last mapped structure:

| Category | Trigger |
|----------|---------|
| `new_dir` | new directory/path not represented in `CODEBASE.md` |
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
Read `.buildflow/PREFERENCES.md` for:
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
# If git.permission is not approved: read from wave files task "Files to create/modify" fields (all completed tasks)
grep -A2 "Files to create/modify:" .buildflow/epics/[epic]/waves/*.md 2>/dev/null

# For each changed file, check if any test file imports it
grep -rn "[filename without ext]" --include="*.test.*" --include="*.spec.*" src/ tests/ 2>/dev/null
```

For each changed source file, cross-reference against `ACCEPTANCE.md`:
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
Required: [threshold]% (set in PREFERENCES.md → spec_coverage.threshold)

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
Mark those files as `ACCEPTABLE — coverage in progress` in CHECK.md.
Log: "Coverage below threshold [N]% — accepted: incremental coverage build-up for [files] [date]."
Proceed. No block.

**On [A] — add ACs:**
Pause check. User defines ACs, then re-run `/buildflow-check acceptance`.

**On [P] — proceed:**
Log to DEBT.md: "Coverage below threshold [N]% — accepted: developer decision [date]. Address in future phase."
Proceed. No block.

Write the coverage map to `.buildflow/epics/[epic]/CHECK.md` for the ship gate to read.
Include the decision and reason taken in Step 4c.

---

## Step 5: Test Check & UAT
- Do all tests pass?
- Are new tests written for new code?
- Is each AC covered by at least one test?

---

### Manual UAT Confirmation

Treat UAT as a manual confirmation step. Do not mark subjective user flows, UX behavior, business workflow correctness, copy/label expectations, or external integration behavior as fully UAT-passed from code inspection alone.

Build a use-case list from `ACCEPTANCE.md`, `PLAN.md`, and changed files. Then present them **one at a time** — the user tests each one and gives immediate pass/fail feedback before moving to the next.

**Before starting:** print a brief header:
```
Manual UAT — [N] use cases to verify
─────────────────────────────────────
Test each case and respond with [P]ass, [F]ail, or [S]kip.
You can fix failures inline before continuing.
```

**For each use case, show one at a time:**
```
──────────────────────────────────────────────────
UAT [current] of [total]  ·  covers AC-[N], AC-[N]

[Use case name]
What to test: [specific user action and expected visible result]

  [P] Pass  — works as expected
  [F] Fail  — something went wrong
  [S] Skip  — test later (marks AC as DEFERRED)
──────────────────────────────────────────────────
```

Wait for the user's response before showing the next use case.

**On [P] Pass:**
- Mark the related AC rows in `CHECK.md` as `PASS` (if automated evidence also supports) or `IN PROGRESS` with note `Manual UAT passed; automated evidence pending`.
- Print: `✓ AC-[N] — passed. Moving to next...`
- Show the next use case.

**On [F] Fail:**
- Ask what went wrong:
  ```
  What happened? (brief description):
  ```
- Record the failure description.
- Mark affected ACs as `FAIL` or `BLOCKED` in `CHECK.md`. Add failure details to `Notes`.
- Ask:
  ```
  ──────────────────────────────────────────────────
  AC-[N] marked FAIL.

    [X] Fix now  — pause UAT, I'll fix this, then continue
    [C] Continue — move to next use case, fix later
  ──────────────────────────────────────────────────
  ```
  - **[X] Fix now:** Pause UAT. Apply the fix (invoke debug/build logic as needed). After fix is applied, re-present the same use case for re-testing before continuing.
  - **[C] Continue:** Record the failure, move to next use case. Ship will be blocked by this failure.

**On [S] Skip:**
- Mark related ACs as `DEFERRED` in `CHECK.md`. Add note: `Manual UAT skipped — pending before ship`.
- Print: `─ AC-[N] — deferred. Moving to next...`
- Show the next use case.

**After all use cases are processed, print the UAT summary:**
```
UAT Summary
───────────────────────────────
  ✓ PASS     [N] use cases  (AC-001, AC-002, AC-005)
  ✗ FAIL     [N] use cases  (AC-003)
  ─ DEFERRED [N] use cases  (AC-004)

Ship readiness: [READY / BLOCKED — fix AC-003 before shipping / CONDITIONAL — deferred UAT must be resolved at ship]
```

- All PASS → proceed to Step 6 normally.
- Any FAIL → ship readiness is blocked. Note which ACs must be fixed.
- Any DEFERRED → ship can proceed only if `/buildflow-ship` explicitly accepts the deferred UAT.

Update `CHECK.md` after the full UAT run: add a `## Test Runs` row with `Scope: Manual UAT`, `Command: user-confirmed`, result per AC, and covered ACs.

---


## Step 5c: Strict Mode

**Only if --strict flag or strict_mode: true in PREFERENCES.md:**

→ **Load module now:** Read .claude/commands/buildflow-check-strict.md and execute Step 5c through the final ship readiness report. Return with PASS/FAIL/STRICT-FAIL verdict.

**If neither --strict nor strict_mode: true:** skip this step and proceed directly to the ship readiness summary in the guided next step.

