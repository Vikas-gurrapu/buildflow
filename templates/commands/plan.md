---
name: buildflow-plan
description: Spec-traced, dependency-reasoned, risk-sequenced execution plan with engineering review
allowed-tools: Read, Write
agent: architect
---

# /buildflow-plan

Creates a precise, dependency-reasoned execution plan. Every task traces to an Acceptance Criterion. Dependencies are explained, not just listed. Tasks are risk-sequenced and effort-estimated. An Engineering Review catches design problems before a single line of code is written.

Run after `/buildflow-spec`. Refuses to plan without locked specs.

## Usage
- `/buildflow-plan` — plan the next phase
- `/buildflow-plan phase-2` — plan a specific named phase
- `/buildflow-plan --scaffold-first` — Wave 0 creates all file stubs before implementation begins
- `/buildflow-plan --risk-first` — orders risky/uncertain tasks to the front of each wave (fail fast)

## Context Packet
- `.buildflow/specs/PRD.md`
- `.buildflow/specs/TDD.md`
- `.buildflow/specs/acceptance.md`
- `.buildflow/codebase/MAP.md` (if exists)
- `.buildflow/codebase/GRAPH.md` (if exists — for dependency chain reasoning)
- `.buildflow/memory/light.md` (phase, framework, spec_status only)

Do NOT load: full codebase, old phase plans, research files, retros.

---

## Step 1: Validate Specs
Check `spec_status: locked` in `light.md` and that `acceptance.md` exists.
If not: "Run `/buildflow-spec` first. No spec, no plan."

Read all ACs. Count: [N] features, [N] user stories, [N] ACs total.
Confirm: "Planning to satisfy [N] ACs across [N] features."

---

## Step 2: Component & Task Derivation
For each feature in PRD, derive the implementation tasks needed to satisfy its ACs:

For each task ask:
1. What code needs to exist that doesn't exist yet?
2. What existing code needs to change?
3. What tests must be written to verify the linked ACs?

Map each task to its AC refs:
```
Task: Create JWT auth middleware
AC refs: AC-001, AC-002, AC-003
Files: src/middleware/auth.ts (new), src/routes/index.ts (modify)
Type: NEW / MODIFY / TEST
```

---

## Step 3: Dependency Reasoning
For each task, identify dependencies and explain WHY they exist:

```
Task: Create login API route
Depends on: "Create auth middleware" — HARD dependency
Reason: Route cannot be registered until middleware exists; calling undefined throws at startup

Task: Write login integration tests
Depends on: "Create login API route" — HARD dependency
Reason: Tests call the live route; no route = test suite errors on import

Task: Create UI login form
Depends on: "Create login API route" — SOFT dependency
Reason: Form can be scaffolded independently; only needs real API for E2E tests
Can proceed in parallel if mocked: YES
```

Dependency types:
- **HARD** — code fails to compile/run without the prerequisite
- **SOFT** — can proceed with a mock/stub; full integration requires prerequisite
- **EXTERNAL** — depends on env var, database, third-party API (flag for setup checklist)

Detect circular dependencies: if A → B → A exists, flag immediately and resolve before proceeding.

External dependency checklist (generated if any EXTERNAL deps found):
```
Before building, verify these exist:
- [ ] DATABASE_URL env var set
- [ ] [service] API key configured
- [ ] [schema] migration run
```

---

## Step 4: Effort Estimation
Estimate each task:
| Size | Meaning |
|------|---------|
| XS | < 30 min — config, type, single function |
| S | 30–90 min — single component or endpoint |
| M | 2–4 hrs — feature with tests |
| L | 4–8 hrs — complex feature, multiple components |
| XL | > 1 day — requires research or architectural decision |

Flag XL tasks: "This task is XL — consider splitting or running `/buildflow-think` first."

---

## Step 5: Wave Planning

Group tasks into parallel waves based on HARD dependencies only (SOFT deps don't block):

```
Wave 0 — Scaffolding (if --scaffold-first)
  Create empty file stubs for all new files
  Purpose: Builders know what exists; no "file not found" errors mid-wave

Wave 1 — Foundation (parallel, no hard dependencies)
  • Task A  [AC-001]  S   NEW
  • Task B  [AC-NF-001]  M   NEW

Wave 2 — Core (parallel, hard-depends on Wave 1)
  • Task C  [AC-001, AC-002]  M   MODIFY
  • Task D  [AC-003]  S   NEW

Wave 3 — Integration (depends on Wave 2)
  • Task E  [AC-001–AC-003]  M   TEST
  • Task F  [AC-004]  L   NEW

Wave 4 — UI / E2E (depends on Wave 3)
  • Task G  [AC-005, AC-006]  M   NEW
  • Task H  [all ACs]  L   TEST
```

If `--risk-first`: within each wave, sort tasks by uncertainty/novelty (most uncertain first). This surfaces problems early before other wave tasks build on broken assumptions.

---

## Step 6: AC Coverage Verification
Every AC must be covered by at least one task. Report:

```
AC Coverage
───────────
AC-001 ✓  Task C, Task E
AC-002 ✓  Task C
AC-003 ✓  Task D, Task E
AC-004 ✓  Task F
AC-005 ✓  Task G
AC-006 ✓  Task G
AC-NF-001 ✓  Task B, Task H
Uncovered: NONE
```

If any AC is uncovered: stop. "AC-[X] has no task. Add a task or explicitly mark it out of scope."

---

## Step 7: Engineering Review
Before writing the plan file, review the plan as an Engineering Lead:

**Over-engineering check:**
- Is any task adding abstraction layers not required by the ACs?
- Are there tasks that implement features "for future use" not in specs?
- Flag and remove.

**Under-engineering check:**
- Are there ACs that will be technically impossible to satisfy with the planned approach?
- Are there missing error handling tasks?
- Are tests planned for every non-trivial AC?

**Architecture smell check:**
- Does the plan introduce new patterns that conflict with `PATTERNS.md`?
- Does any task modify a HOTSPOT file? If yes, flag with: "⚠ This task touches [file] (risk: [N]) — verify test coverage before proceeding."
- Are there tasks that cross module boundaries inappropriately?

**Engineering Review Report:**
```
Engineering Review
──────────────────
Over-engineering:  [list or NONE]
Under-engineering: [list or NONE]
Architecture:      [conflicts or NONE]
Hotspot warnings:  [files or NONE]
Verdict: APPROVED / NEEDS REVISION
```

If NEEDS REVISION: apply fixes, re-run review, then proceed.

---

## Step 8: Write Plan
Write `.buildflow/phases/[N]/PLAN.md`:

```markdown
# Phase [N] Plan
**Goal:** [one sentence — what the user can DO after this phase that they can't do now]
**ACs:** [N]  **Tasks:** [N]  **Waves:** [N]  **Est. total:** [sum of estimates]
**Engineering Review:** APPROVED

## External Dependencies Checklist
- [ ] [item] — [how to verify]

## Waves

### Wave 1 — [theme]
| Task | ACs | Est | Type | Files |
|------|-----|-----|------|-------|
| [name] | AC-001 | S | NEW | src/... |

### Wave 2 — [theme]
...

## AC → Task Traceability
| AC | Task(s) |
|----|---------|
| AC-001 | Task C, Task E |
```

Update `light.md`:
```yaml
current_phase: [N]
plan_status: ready
wave_count: [N]
task_count: [N]
est_total: [size]
```

## Token Budget: ~22K
