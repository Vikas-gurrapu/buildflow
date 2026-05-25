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
- Changed files only (git diff since last commit) — NOT the full codebase
- `.buildflow/codebase/PATTERNS.md` (if exists)

Do NOT load: PRD, TDD, old phases, research files, retros.

## Step 1: Load Acceptance Criteria
Read every AC from `.buildflow/specs/acceptance.md`.
This is the primary verification target — all other checks are secondary.

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
- Are functions appropriately sized?

**Reviewer D — Security:**
- No hardcoded secrets?
- No obvious injection risks?
- No sensitive data in logs?
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
```bash
git diff HEAD~1 -- "*.prisma" "schema.sql" "models.py" "*.entity.ts"
git diff HEAD~1 --name-only -- "migrations/" "db/migrations/"
```
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

## Step 4: Test Check
- Do all tests pass?
- Are new tests written for new code?
- Is each AC covered by at least one test?

## Step 4: Synthesize Findings

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

## Step 5: Ship Readiness

| Condition | Status |
|-----------|--------|
| All ACs passing | ✓ / ✗ |
| No FAIL-level code issues | ✓ / ✗ |
| Tests passing | ✓ / ✗ |
| Security gate clear | ✓ / ✗ |
| Schema drift: none | ✓ / ✗ |

- **All green:** "Ready for `/buildflow-ship`"
- **AC failures:** "Spec not complete. Fix AC failures before shipping — they represent unfinished features, not code style."
- **Schema drift found:** "Schema drift detected. Run migrations or add missing migration files before shipping."
- **Code failures only:** "Spec satisfied. Fix code issues or proceed with caution."

## Token Budget: ~26K (includes schema drift check)
