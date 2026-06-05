---
name: buildflow-test
max_context_kb: 20
description: Run tests, verify UI flow, and auto-fix failures until all pass
allowed-tools: Read, Write, Bash, Grep, Glob
agent: reviewer
---

# /buildflow-test

Standalone test + fix loop. Runs the test suite, checks UI flow and functionality, and automatically fixes failures — repeats until everything passes or the fix limit is reached.

Use this when:
- You want to re-verify a wave that was already built
- You made a manual code change and want to test it
- `/buildflow-build` stopped and you want to resume testing from where it left off

For automated testing during builds, this loop is already built into `/buildflow-build` — you don't need to run `/buildflow-test` separately after each wave unless you want to re-check.

## Usage
- `/buildflow-test` — test current wave/phase output
- `/buildflow-test wave-2` — test a specific wave
- `/buildflow-test ui` — focus on UI alignment and flow only
- `/buildflow-test --full` — run full suite including integration and e2e

## Step 1: Load Context
Read `.buildflow/epics/[epic]/PLAN.md` to know what this wave was supposed to deliver.
Read `.buildflow/MEMORY.md` for framework and test setup.

## Step 2: Detect Test Setup
Identify:
- Test framework (Jest, Vitest, Pytest, Go test, Cargo, etc.)
- Test command (`npm test`, `pytest`, `go test ./...`, etc.)
- E2E framework if present (Playwright, Cypress, etc.)
- Dev server command if UI is involved

## Step 3: Run Tests
```bash
npm test        # or pytest / go test etc.
```

Also check:
- If frontend code changed: start dev server, verify UI renders and flows work, no console errors
- No import errors or missing modules
- Previously passing tests still pass (no regressions)

## Step 4: Fix Loop (runs automatically on failure)

If any test fails:
1. Identify root cause (trace error → file → line → why)
2. Apply minimal fix — only change what broke, do not refactor surrounding code
3. Re-run the full test suite
4. Repeat until all tests pass

Maximum fix attempts: 5.
If still failing after 5 attempts: stop, report what's unresolved, and ask the user how to proceed.

Fix attempt log format:
```
Fix attempt [X]/5
Error: [error message]
Root cause: [explanation]
Fix applied: [what changed]
Result: [pass / still failing]
```

## Step 5: Report

```
Test Results
────────────
✓ PASS  Tests: 24/24 passing
✓ PASS  Functional: signup flow works end-to-end
✓ PASS  UI: form renders correctly, validation messages shown
⚠ WARN  No test for empty email edge case (non-blocking)
```

## Step 6: Decision
- All pass: "Ready to continue to next wave or /buildflow-ship."
- Warnings only: "Non-blocking. Proceed or address first — your call."
- Unresolved after 5 attempts: "Manual intervention needed. Use /buildflow-debug for deeper analysis."

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Tests passing — run full spec compliance check before shipping
──────────────────────────────────────────────────
```

If tests failed and could not be auto-fixed: `→ Next: /buildflow-debug` (root-cause the failure).
If this was a wave re-test: `→ Next: /buildflow-build wave [N+1]` (continue to next wave).

