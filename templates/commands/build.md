---
name: buildflow-build
description: Execute the plan with parallel Builder agents
allowed-tools: Read, Write, Bash
agents: builder, reviewer
---

# /buildflow-build

Execute the current phase plan. Spawns parallel Builder agents per wave, then Reviewer checks quality.

## Usage
- `/buildflow-build` — execute current phase plan
- `/buildflow-build wave-2` — execute a specific wave
- `/buildflow-build <task>` — build a single task

## Step 1: Load Plan
Read `.buildflow/phases/[N]/PLAN.md`.
Load `.buildflow/memory/light.md` for style preferences.
If existing project: load `.buildflow/codebase/PATTERNS.md`.

## Step 2: Style Fingerprint
Before writing code, confirm:
- Naming conventions (camelCase, PascalCase, snake_case)
- Import organization
- Error handling style
- Comment style
- Test file location and naming

## Step 3: Execute Wave 1
Spawn Builder agents in parallel for Wave 1 tasks.
Each Builder agent:
- Gets the task spec and relevant context files
- Writes code matching detected style
- Adds LEARN: comments for non-obvious patterns
- Reports back: files created/modified, decisions made

## Step 4: Review Wave 1
Reviewer agent checks each output:
- Does it meet the task spec?
- Does it match the codebase style?
- Any security concerns?
- Tests present if needed?

## Step 5: Continue Waves
Repeat for Wave 2, Wave 3, etc.
Each wave waits for the previous to complete and pass review.

## Step 6: Integration Check
After all waves: verify the pieces connect correctly.
Run existing tests if available.

## Step 7: Update Memory
```yaml
last_build_date: [today]
phase: [N]
tasks_completed: [list]
files_changed: [list]
```

## Token Budget: ~50K per wave (parallel)
