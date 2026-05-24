---
name: buildflow-plan
description: Create a dependency-aware execution plan with the Architect agent
allowed-tools: Read, Write
agent: architect
---

# /buildflow-plan

Create a detailed, phased execution plan. The Architect agent maps dependencies before sequencing work.

## Usage
- `/buildflow-plan` — plan the next phase
- `/buildflow-plan phase-2` — plan a specific phase
- `/buildflow-plan <feature>` — plan a specific feature

## Step 1: Load Context
Read `.buildflow/core/vision.md`, `.buildflow/memory/light.md`.
If existing project: read `.buildflow/codebase/MAP.md` and `DEPENDENCIES.md`.

## Step 2: Scope Confirmation
Ask: "What are we building in this phase? What's the definition of done?"
Confirm scope before planning.

## Step 3: Dependency Mapping
List all components/features needed. For each:
- What does it depend on?
- What depends on it?
- Can it be built in parallel?

## Step 4: Task Breakdown
For each task:
```
Task: [name]
Description: [what it does]
Depends on: [prerequisite tasks]
Parallelizable: yes/no
Estimated complexity: low/medium/high
Files affected: [list]
```

## Step 5: Wave Planning
Group tasks into parallel waves:
```
Wave 1 (parallel): [tasks with no dependencies]
Wave 2 (parallel): [tasks depending only on Wave 1]
Wave 3: [tasks depending on Wave 2]
```

## Step 6: Risk Check
Identify:
- Tasks with high complexity
- Tasks touching security-sensitive code
- Tasks requiring external APIs or services

## Step 7: Save Plan
Write to `.buildflow/phases/[N]/PLAN.md`
Update state.md with current phase number.

## Token Budget: ~20K
