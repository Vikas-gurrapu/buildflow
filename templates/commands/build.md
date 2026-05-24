---
name: buildflow-build
description: Execute the plan with parallel Builder agents, auto-test and auto-fix each wave
allowed-tools: Read, Write, Bash, Grep, Glob
agents: builder, reviewer
---

# /buildflow-build

Execute the current phase plan. Spawns parallel Builder agents per wave. After every wave, automatically runs tests and fixes failures — the next wave does not start until the current wave passes all tests.

## Usage
- `/buildflow-build` — execute current phase plan (all waves, auto-test each)
- `/buildflow-build wave-2` — execute and test a specific wave
- `/buildflow-build <task>` — build and test a single task

## Step 1: Load Plan
Read `.buildflow/phases/[N]/PLAN.md`.
Load `.buildflow/memory/light.md` for style preferences.
If existing project: load `.buildflow/codebase/PATTERNS.md`.

## Step 2: Style Fingerprint
Before writing any code, confirm:
- Naming conventions (camelCase, PascalCase, snake_case)
- Import organization
- Error handling style
- Test file location and naming

## Step 3: Execute Wave

Repeat this block for each wave in the plan:

### 3a — Build
Spawn Builder agents in parallel for all tasks in this wave.
Each Builder:
- Gets the task spec and relevant context files
- Writes code matching the detected style
- Adds LEARN: comments for non-obvious patterns
- Reports back: files created/modified, decisions made

### 3b — Review
Reviewer checks each output:
- Does it meet the task spec?
- Does it match codebase style?
- Any security concerns?
- Are tests written for new logic?

### 3c — Test (automatic, runs after every wave)
Detect and run the test suite:
```bash
npm test        # Node / JS / TS projects
pytest          # Python
go test ./...   # Go
cargo test      # Rust
# etc. based on detected framework
```

Also check:
- If frontend code changed: start dev server and verify UI renders, flows work, no console errors
- No import errors, missing modules, or broken references
- All previously passing tests still pass (no regressions)

### 3d — Fix loop (runs only if tests fail)
If any test fails:
1. Identify root cause (trace error → file → line → why)
2. Apply minimal fix — change only what broke, do not refactor surrounding code
3. Re-run the full test suite
4. Repeat until all tests pass

**Do not move to the next wave until this wave is fully green.**

Maximum fix attempts per wave: 5.
If still failing after 5 attempts: stop, report the unresolved failure, and ask the user how to proceed.

Fix attempt log format:
```
Wave [N] — Fix attempt [X]/5
Error: [error message]
Root cause: [explanation]
Fix applied: [what changed]
Result: [pass / still failing]
```

## Step 4: Wave Complete
Only after a wave is fully tested and passing:
- Log the wave as complete in `.buildflow/phases/[N]/PLAN.md`
- Continue to the next wave (back to Step 3)

## Step 5: Integration Check
After all waves pass:
- Run the full test suite one final time
- Verify all pieces connect correctly end-to-end
- Check for any import/dependency issues across wave boundaries

## Step 6: Update Memory
```yaml
last_build_date: [today]
phase: [N]
tasks_completed: [list]
files_changed: [list]
waves_completed: [N]
test_status: all passing
```

## Token Budget: ~50K per wave (build + test + fix loop)
