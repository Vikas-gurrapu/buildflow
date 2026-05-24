---
name: buildflow-check
description: Verify quality with parallel Reviewer agents
allowed-tools: Read, Bash, Grep, Glob
agent: reviewer
---

# /buildflow-check

Quality verification. Parallel Reviewers check code against acceptance criteria.

## Usage
- `/buildflow-check` — check current phase
- `/buildflow-check <file>` — check a specific file
- `/buildflow-check tests` — verify test coverage
- `/buildflow-check acceptance` — verify acceptance criteria only

## Step 1: Load Acceptance Criteria
Read `.buildflow/phases/[N]/PLAN.md` for definition of done.

## Step 2: Parallel Review (3 reviewers)

**Reviewer A — Correctness:**
- Does the code do what was specified?
- Are edge cases handled?
- Are there logical errors?

**Reviewer B — Quality:**
- Is the code readable?
- Are there unnecessary duplications?
- Does it match `.buildflow/codebase/PATTERNS.md`?
- Are functions appropriately sized?

**Reviewer C — Security:**
- No hardcoded secrets?
- No obvious injection risks?
- No sensitive data in logs?
- Dependencies up to date?

## Step 3: Test Check
- Do existing tests pass?
- Are new tests written for new code?
- Is critical logic tested?

## Step 4: Synthesize Findings

Report format:
```
✓ PASS  — criterion
⚠ WARN  — issue (non-blocking)
✗ FAIL  — issue (must fix before /buildflow-ship)
```

## Step 5: Confidence Check
Ask: "How confident are you in this code? (1-5)"

## Step 6: Next Steps
- All pass: "Ready for /buildflow-ship"
- Warnings: "Warnings noted. Run /buildflow-ship or fix first."
- Failures: "Fix these issues, then re-run /buildflow-check"

## Token Budget: ~20K
