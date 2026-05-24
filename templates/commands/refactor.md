---
name: buildflow-refactor
description: Improve existing code quality without changing behavior
allowed-tools: Read, Write, Grep, Glob, Bash
agents: surgeon, reviewer
---

# /buildflow-refactor

Improve code quality, readability, or performance — without changing observable behavior.

## Usage
- `/buildflow-refactor src/components/Dashboard.tsx`
- `/buildflow-refactor "Extract auth logic into middleware"`
- `/buildflow-refactor --scope=module src/api/`

## Step 1: Load Context
Read `.buildflow/codebase/MAP.md`, `PATTERNS.md`, `HOTSPOTS.md`.

## Step 2: Define Refactor Goal
Clarify what kind of improvement:
- Readability (rename, extract function, reduce nesting)
- Performance (memoization, lazy loading, caching)
- Maintainability (extract module, reduce coupling)
- Test coverage (add tests for existing logic)

## Step 3: Behavior Contract
Before refactoring:
- Document current behavior (inputs → outputs)
- Identify existing tests
- Note any implicit side effects

The refactor must NOT change this contract.

## Step 4: Restore Point
```bash
git commit -m "pre-refactor restore point: [scope]"
```

## Step 5: Incremental Refactor
Small, reviewable steps:
1. Rename in isolation
2. Extract without logic changes
3. Move with no modifications
4. Simplify one function at a time

After each step: verify behavior unchanged.

## Step 6: Quality Check (Reviewer agent)
- Is the refactored code simpler?
- Are existing tests still passing?
- Does it match PATTERNS.md conventions?
- Any new complexity introduced?

## Step 7: Update Codebase Map
If patterns changed significantly, update `.buildflow/codebase/PATTERNS.md`.

## Token Budget: ~40K
