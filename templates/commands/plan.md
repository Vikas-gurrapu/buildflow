---
name: buildflow-plan
description: Create a spec-traced, dependency-aware execution plan with the Architect agent
allowed-tools: Read, Write
agent: architect
---

# /buildflow-plan

Create a detailed, phased execution plan. Every task traces back to an acceptance criterion. The Architect reads specs, maps dependencies, and groups work into parallel waves.

Run after `/buildflow-spec`. If specs don't exist, the Architect will ask you to create them first.

## Usage
- `/buildflow-plan` — plan the next phase
- `/buildflow-plan phase-2` — plan a specific phase
- `/buildflow-plan <feature>` — plan a specific feature

## Context Packet (load only these)
- `.buildflow/specs/PRD.md`
- `.buildflow/specs/TDD.md`
- `.buildflow/specs/acceptance.md`
- `.buildflow/memory/light.md` (phase, framework, spec_status fields only)
- `.buildflow/codebase/MAP.md` (if exists — existing projects only)
- `.buildflow/codebase/DEPENDENCIES.md` (if exists — existing projects only)

Do NOT load: full codebase, old phase plans, research files, retros.

## Step 1: Validate Specs
Check `.buildflow/specs/acceptance.md` exists and `spec_status: locked` in light.md.
If missing: "Run `/buildflow-spec` first to define acceptance criteria before planning."

## Step 2: Scope Confirmation
Read all acceptance criteria (AC-001, AC-002, ...).
Confirm: "I'll plan tasks to satisfy [N] acceptance criteria. Correct?"

## Step 3: Dependency Mapping
For each AC, identify all components/tasks needed. For each task:
- What does it depend on?
- What depends on it?
- Can it be built in parallel with other tasks?

## Step 4: Task Breakdown
For each task:
```
Task: [name]
AC refs: [AC-001, AC-003]   ← which acceptance criteria this satisfies
Description: [what it does]
Depends on: [prerequisite tasks or "none"]
Parallelizable: yes/no
Complexity: low / medium / high
Files affected: [list]
```

Every AC must be covered by at least one task. Flag uncovered ACs before proceeding.

## Step 5: Wave Planning
Group tasks into parallel waves:
```
Wave 1 (parallel — no dependencies):
  • Task A  [AC-001]
  • Task B  [AC-002]

Wave 2 (parallel — depends on Wave 1):
  • Task C  [AC-001, AC-003]
  • Task D  [AC-004]

Wave 3 (depends on Wave 2):
  • Task E  [AC-005]
```

## Step 6: AC Coverage Check
Verify every acceptance criterion from `acceptance.md` is referenced in at least one task.
Report:
```
AC Coverage
───────────
AC-001 ✓  covered by Task A, Task C
AC-002 ✓  covered by Task B
AC-003 ✗  NOT COVERED — add a task or flag as out of scope
```

Do not write the plan if any AC is uncovered without explicit user confirmation to skip it.

## Step 7: Risk Check
Flag tasks that are:
- High complexity
- Touching security-sensitive code
- Requiring external APIs or services
- Not covered by existing tests

## Step 8: Save Plan
Write to `.buildflow/phases/[N]/PLAN.md`.
Update `state.md` with current phase number.
Update `light.md`:
```yaml
current_phase: [N]
ac_count: [N]
plan_status: ready
```

## Token Budget: ~20K
