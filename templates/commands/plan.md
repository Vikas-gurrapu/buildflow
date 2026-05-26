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
- `/buildflow-plan --strict` — mark this phase as strict mode: every task must trace to a TDD component or API contract; `/buildflow-check --strict` and `/buildflow-ship` strict gate are mandatory before this phase ships

## Context Packet
- `.buildflow/specs/PRD.md`
- `.buildflow/specs/TDD.md`
- `.buildflow/specs/acceptance.md`
- `.buildflow/phases/[N]/STATE.md` (if exists - resume status, decisions, active risks, next command)
- `.buildflow/codebase/MAP.md` (if exists)
- `.buildflow/codebase/STACK.md` (if exists — runtime, frameworks, critical dependencies)
- `.buildflow/codebase/STRUCTURE.md` (if exists — physical layout and entry points)
- `.buildflow/codebase/INTEGRATIONS.md` (if exists — external services, env contracts, webhooks)
- `.buildflow/codebase/TESTING.md` (if exists — test framework and validation patterns)
- `.buildflow/codebase/CONCERNS.md` (if exists — risks, debt, blind spots)
- `.buildflow/codebase/FEATURES.md` (if exists — existing capabilities, local support, and locale support)
- `.buildflow/codebase/GRAPH.md` (if exists — for dependency chain reasoning)
- `.buildflow/codebase/intel.json` fields `features[]`, `local_support`, and `locale_support` (if exists)
- `.buildflow/memory/light.md` (phase, framework, spec_status only)

Do NOT load: full codebase, old phase plans, research files, retros.

---

## Phase State Resume
Read `.buildflow/core/state.md`, `.buildflow/memory/light.md`, and `.buildflow/phases/[N]/STATE.md` if it exists.

Use `STATE.md` to carry forward spec decisions, unresolved risks, files that matter, and the intended next command. If `STATE.md` says `Status: plan_ready` and `PLAN.md` exists for the same spec version, do not regenerate the plan unless the user asks; continue to the guided next step.

Before exiting, create or update `.buildflow/phases/[N]/STATE.md` with:
- Current State: `Status: plan_ready`, `Wave: 0/[wave_count]`
- Decisions: planning decisions, task splits, strict mode, and dependency/risk sequencing choices
- Files That Matter: `PLAN.md`, spec files, codebase map files used, and high-risk planned paths
- Next Command: `/buildflow-build`
- Risks / Open Questions: hard blockers, unresolved dependencies, and plan assumptions
- Test Strategy: focused post-change tests for touched files, dependency-neighborhood tests, and any user-approved broader checks

---

## Step 1: Validate Specs

**Check 1 — Spec locked:**
Read `spec_status` from `light.md` and `status` from `acceptance.md` frontmatter.
If either is not `locked`: "Run `/buildflow-spec` first. No spec, no plan."

**Check 2 — Version consistency:**
Read `spec_version` from `acceptance.md` frontmatter.
Read `spec_version` from `light.md`.
If they differ: "Spec version mismatch — `acceptance.md` is v[A] but `light.md` records v[B]. Re-run `/buildflow-spec` to reconcile."

**Check 3 — No active amendment in progress:**
Read `acceptance.md` frontmatter. If `status: AMENDING` exists: "Spec amendment in progress. Complete or cancel it in `/buildflow-spec` before planning."

Record the locked `spec_version` in `PLAN.md` header — this is the version this plan was built against.

Read all ACs. Count: [N] features, [N] user stories, [N] ACs total.
Confirm: "Planning to satisfy [N] ACs across [N] features (spec v[N])."

If `FEATURES.md` or `intel.json.features[]` exists:
- Mark already-implemented capabilities as "existing support" and avoid recreating them.
- If a task touches a feature listed in `features[]`, reference that feature in the task.
- If `local_support.status` is YES or PARTIAL, preserve local run/dev scripts, local config, mocks, seed data, Docker/dev compose, and documented local workflows unless explicitly out of scope.
- If `locale_support.status` is YES or PARTIAL, preserve locale JSON catalogs, static label/copy catalogs, localized docs, translation imports/loaders, fallback/default locale config, language routes/switchers, and i18n provider/middleware unless explicitly out of scope.

If focused codebase maps exist:
- Use `STACK.md` to avoid adding incompatible dependencies or runtime assumptions.
- Use `STRUCTURE.md` to choose existing folders/entry points and to plan scoped remaps for new directories/routes.
- Use `INTEGRATIONS.md` to add env/webhook/setup tasks when external contracts change.
- Use `TESTING.md` to select targeted test commands and create tests in the repo's expected location.
- Use `CONCERNS.md` to front-load tasks touching known fragile areas.

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
Feature refs: Auth, Local development support (if touched)
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

Group tasks into parallel waves based on HARD dependencies only (SOFT deps don't block).

### 5a — Thin-Slice Ordering (enforced for full-stack features)

For any feature that spans UI + API + DB layers, enforce this ordering across waves:
```
Wave N   — DB / schema layer first (migrations, models, repositories)
Wave N+1 — API / service layer (endpoints, business logic, service methods)
Wave N+2 — UI layer (components, pages, forms)
Wave N+3 — Integration / E2E tests (require all layers complete)
```

**Why:** Building UI before API produces placeholder code that must be rewritten. Building API before schema produces calls into undefined tables. The thin-slice order eliminates rework by building each layer on a stable foundation.

If the plan has tasks that violate this order (e.g., UI task in Wave 1 with DB task in Wave 2): flag and reorder before proceeding. The only exception is UI tasks that are purely presentational and do not call any API (static layouts, pure components).

### 5b — Exclusive File Ownership

Every file modified in this phase must have exactly one owner wave. No two waves may modify the same file.

**Ownership assignment rules:**
1. List all files each task will touch (create or modify).
2. If two tasks in different waves touch the same file → merge them into one task, or resolve which wave owns the file and move all other tasks that touch it into that wave.
3. Exception: test files (`*.test.*`, `*_test.*`, `test_*.py`) may be extended across waves but the extension must be additive only — no deletions or signature changes to existing test cases.

**Ownership map (generated for each plan):**
```
File Ownership Map
──────────────────
src/auth/service.ts       Wave 2  (owned by: "Create auth service")
src/auth/service.test.ts  Wave 2  (owned by: "Create auth service" — tests co-located)
src/routes/auth.ts        Wave 3  (owned by: "Create auth routes")
src/db/schema.ts          Wave 1  (owned by: "Create user schema")
```

If a conflict is detected (same file, two waves): **STOP and resolve before writing the plan.**
```
⚠ File ownership conflict:
  src/auth/service.ts is touched by Wave 2 ("Create auth service") AND Wave 3 ("Add refresh token")
  Resolution options:
    A) Merge both into Wave 2 (if no HARD dependency ordering is violated)
    B) Move "Add refresh token" into Wave 2 (refresh token is part of the same service unit)
    C) Split src/auth/service.ts into two files, one per wave
  Choose one before proceeding.
```

### 5c — Wave Table

```
Wave 0 — Scaffolding (if --scaffold-first)
  Create empty file stubs for all new files
  Purpose: Builders know what exists; no "file not found" errors mid-wave

Wave 1 — DB / Schema (parallel, no hard dependencies)
  • Task A  [AC-001]  S   NEW    src/db/schema.ts (owned)

Wave 2 — API / Services (hard-depends on Wave 1)
  • Task C  [AC-001, AC-002]  M   NEW    src/auth/service.ts (owned)
  • Task D  [AC-003]  S   NEW            src/auth/service.test.ts (owned)

Wave 3 — Routes / Integration (depends on Wave 2)
  • Task E  [AC-001–AC-003]  M   MODIFY  src/routes/auth.ts (owned)
  • Task F  [AC-004]  L   NEW            src/routes/auth.test.ts (owned)

Wave 4 — UI (depends on Wave 3)
  • Task G  [AC-005, AC-006]  M   NEW    src/components/LoginForm.tsx (owned)
  • Task H  [all ACs]  L   TEST          src/components/LoginForm.test.tsx (owned)
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

## Step 6b: Post-Change Test Sequencing

For every non-trivial AC, plan focused tests after the implementation work. BuildFlow does not require failing-test-first or test-before-code sequencing.

**Rule:** For each task of type `NEW` or `MODIFY` that satisfies an AC:
1. Implement the code change.
2. Add or update focused tests for the changed behavior and linked ACs.
3. Run only tests for touched files and direct dependents during build/modify.
4. Ask the user before running broader app-level tests.

**How to encode this in the wave table:**

Keep implementation and focused test work together in the same task or adjacent sub-task:

```
Wave 2 — Auth Service
  • Implement login service + focused tests (AC-001, AC-002)   M   NEW
```

**Exception:** Pure scaffolding tasks (type: `SCAFFOLD`), config tasks, database migration tasks, pure style files, static assets, and locale/label catalogs only need tests when a relevant focused test already exists.

**Planner check:** Before writing the plan file, verify that every `NEW`/`MODIFY` task with AC refs includes post-change focused test coverage or an explicit rationale for why tests are not applicable.

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
- Does every non-trivial NEW/MODIFY task include post-change focused test coverage?

**Architecture smell check:**
- Does the plan introduce new patterns that conflict with `PATTERNS.md`?
- Does the plan introduce paths/layers that conflict with `STRUCTURE.md`?
- Does the plan add dependencies or runtime assumptions that conflict with `STACK.md`?
- Does the plan change external services/env/webhooks without tasks to update `INTEGRATIONS.md` and setup docs?
- Does the plan's test strategy match `TESTING.md`?
- Does the plan address any relevant known risk from `CONCERNS.md`?
- Does any task modify a HOTSPOT file? If yes, flag with: "⚠ This task touches [file] (risk: [N]) — verify test coverage before proceeding."
- Are there tasks that cross module boundaries inappropriately?
- Does any task unintentionally remove or bypass an existing feature from `FEATURES.md`, especially local support?
- If local support exists, does the plan preserve or update the local workflow docs/scripts/config when runtime behavior changes?
- If locale support exists, does the plan preserve or update static JSON catalogs, label/copy catalogs, localized docs, import paths, fallback locale behavior, and language-specific tests/docs when user-facing copy or routes change?

**Engineering Review Report:**
```
Engineering Review
──────────────────
Over-engineering:  [list or NONE]
Under-engineering: [list or NONE]
Architecture:      [conflicts or NONE]
Hotspot warnings:  [files or NONE]
Thin-slice order:  [violations or OK]
File conflicts:    [ownership conflicts or OK]
Focused tests:     [tasks missing post-change tests or OK]
Verdict: APPROVED / NEEDS REVISION
```

If NEEDS REVISION: apply fixes, re-run review. **Repeat the review cycle until APPROVED.** Do not write the plan file until the Engineering Review passes cleanly. There is no limit on review cycles — convergence is the goal, not speed.

**Convergence protocol:**
- Cycle 1: initial review → find issues
- Cycle 2: apply fixes → re-review
- Cycle 3+: verify fixes resolved the issues without introducing new ones
- Stop when all seven dimensions above show no issues

Log each review cycle in the plan file header:
```yaml
engineering_review_cycles: 2
engineering_review_verdict: APPROVED
```

---

## Step 7b: Strict Mode Annotations (if `--strict` flag)

When `--strict` is active:

1. **Tag each task** with its TDD mapping:
   - Every `NEW`/`MODIFY` task must reference the TDD Component Map row it implements (`[TDD: ComponentName]`)
   - Every task implementing an API endpoint must reference its TDD API Contract row (`[TDD: POST /api/path]`)
   - If a task cannot be mapped to a TDD entry: either add the entry to TDD.md (amendment, with spec version increment) or remove the task (out of scope)

2. **Mark the plan header:**
   ```yaml
   strict_mode: true
   strict_check_required: true   ← /buildflow-check --strict must pass before /buildflow-ship
   ```

3. **Critical module flag** — tasks touching critical module files get a `[CRITICAL]` tag in the wave table. The Builder must verify that every exported symbol in those files has an AC reference before marking the task complete.

4. **If any task cannot be mapped to TDD** → flag before writing plan:
   ```
   ⚠ Strict mode: Task "[name]" has no TDD Component Map or API Contract entry.
   Options:
     A) Add a TDD.md entry for this component (amend spec — increments spec_version)
     B) Remove the task — it is out of spec scope
   ```
   Do not write the plan until every task has a TDD mapping or is explicitly out-of-scope.

---

## Step 8: Write Plan
Use the **Write tool** to create `.buildflow/phases/[N]/PLAN.md`. Create the directory first if needed. Do not output the plan as text — write it to disk.

```markdown
# Phase [N] Plan
**Goal:** [one sentence — what the user can DO after this phase that they can't do now]
**ACs:** [N]  **Tasks:** [N]  **Waves:** [N]  **Est. total:** [sum of estimates]
**Spec version:** v[N]  ← amendment gate uses this to detect drift
**Engineering Review:** APPROVED (cycles: [N])
**Thin-slice order:** ENFORCED
**File conflicts:** NONE
**Strict mode:** [enabled — /buildflow-check --strict required before ship / disabled]

## External Dependencies Checklist
- [ ] [item] — [how to verify]

## File Ownership Map
| File | Owner Wave | Owner Task |
|------|-----------|------------|
| src/... | Wave 1 | [task name] |

## Waves

### Wave 1 — [theme: DB/Schema]
| Task | ACs | Est | Type | Files | Tests | TDD Ref |
|------|-----|-----|------|-------|-------|---------|
| [name] | AC-001 | S | NEW | src/... | focused after change | [ComponentName / POST /path / —] |

(TDD Ref column only present when `strict_mode: true`. "—" = non-critical utility task exempt from strict tracing.)

### Wave 2 — [theme: API/Services]
...

### Wave N — [theme: UI]
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

## Token cost report (print at end of plan)

Measure actual cost:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output from PLAN.md generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

```
Token Cost — /buildflow-plan
─────────────────────────────
Plan ready — Phase [N]
Waves: [N]  Tasks: [N]  ACs: [N]  Engineering review cycles: [N]
Context loaded:    ~[N]K tokens   (spec + vision + onboard data)
Output generated:  ~[N]K tokens   (PLAN.md)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```
Update `light.md`: `last_plan_tokens: ~[N]K`

## Guided Next Step

Before printing this block, check session context usage. Because planning creates the execution contract, recommend clearing the current AI session after saving `STATE.md` unless context is very small and the user is continuing immediately.

```
──────────────────────────────────────────────────
→ Next:  /buildflow-build
   Why:  Plan is ready — execute wave 1 of [N] waves ([N] tasks)
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If engineering review flagged HARD blockers that were not resolved: `→ Next: resolve the HARD blockers listed above, then re-run /buildflow-plan`.

## Token Budget: ~22K
