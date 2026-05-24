---
name: buildflow-build
description: Execute the spec-traced plan wave-by-wave with auto-test and auto-fix per wave
allowed-tools: Read, Write, Bash, Grep, Glob
agents: builder, reviewer
---

# /buildflow-build

Execute the current phase plan. Spawns parallel Builder agents per wave. Each wave auto-tests and auto-fixes until green. The next wave does not start until the current wave fully passes.

Every task is traced to an acceptance criterion. Builders reference specs — not opinions.

## Usage
- `/buildflow-build` — execute all waves in the current plan
- `/buildflow-build wave-2` — execute a specific wave
- `/buildflow-build <task>` — build and test a single task

## Context Packet for this command (load only these)
- `.buildflow/phases/[N]/PLAN.md`
- `.buildflow/memory/light.md` (app_name, framework, style_fingerprint fields only)
- `.buildflow/codebase/PATTERNS.md` (if exists)
- Do NOT load: full codebase, specs, research, retros, old phases

## Step 1: Load Plan
Read `.buildflow/phases/[N]/PLAN.md`.
Confirm: "Phase [N] — [N] waves, [N] tasks, [N] ACs covered. Starting Wave 1."

## Step 2: Style Fingerprint
Before writing any code:
- Naming conventions (camelCase, PascalCase, snake_case)
- Import organization pattern
- Error handling style
- Test file location and naming
- Comment style

---

## Step 3: Wave Execution Loop

Repeat this block for each wave:

### 3a — Prepare Builder Context Packets
For each task in this wave, prepare a minimal context packet:
```
Task spec (from PLAN.md)
AC refs: [which ACs this task satisfies]
Relevant files: [max 5 files this task touches — not full codebase]
Style rules: [3-5 key conventions from PATTERNS.md]
```
Builders receive ONLY this packet — not full project state.
This is what keeps token usage low and context clean.

### 3b — Build (parallel)
Spawn Builder agents in parallel, one per task.
Each Builder:
- Receives its context packet only
- Writes code that satisfies the referenced ACs
- Adds LEARN: comment for non-obvious patterns
- Reports back: files created/modified, AC coverage confirmed

### 3c — Review
Reviewer checks each output:
- Does it satisfy the referenced ACs?
- Does it match PATTERNS.md style?
- Any security concerns?
- Tests written for new logic?

### 3d — Test + Fix Loop
Run the full test suite:
```bash
npm test        # Node / TS / JS
pytest          # Python
go test ./...   # Go
cargo test      # Rust
```

If frontend code changed: verify dev server renders without errors, core UI flow works.

**If tests fail:**
1. Identify root cause (error → file → line → why)
2. Apply minimal fix (change only what broke)
3. Re-run full test suite
4. Repeat until green

Max 5 fix attempts per wave.
If still failing after 5: stop, report unresolved failures, ask user how to proceed.

Fix log:
```
Wave [N] Fix [X]/5: [error] → [root cause] → [fix applied] → [result]
```

### 3e — Wave Complete
Only after all tests pass:
- Mark wave as complete in `phases/[N]/PLAN.md`
- Continue to next wave

---

## Step 4: Integration Check
After all waves pass:
- Run full test suite one final time
- Verify pieces connect correctly across wave boundaries
- Check for import errors or missing dependencies

## Step 5: Update Memory (minimal — prune stale fields)
```yaml
last_build_date: [today]
current_phase: [N]
plan_status: built
test_status: passing
```
Remove from light.md: any per-wave task details from previous builds (keep it lean).

## Token Budget: ~50K per wave (build + context packets + test-fix loop)
