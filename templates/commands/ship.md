---
name: buildflow-ship
description: Finalize phase with spec gate, security gate, build telemetry gate, and context pruning
allowed-tools: Read, Write, Bash
agents: strategist, security-auditor
---

# /buildflow-ship

Finalize current phase. Three gates run before shipping: spec compliance, security scan, and test pass. After shipping, session context is pruned so the next phase starts clean.

## Context Packet (load only these)
- `.buildflow/specs/acceptance.md`
- `.buildflow/core/state.md`
- `.buildflow/memory/light.md`
- Git diff of changed files (not full codebase)

## MANDATORY Gate 0: Spec Compliance Check

Read `.buildflow/specs/acceptance.md`. Verify every AC is satisfied.

```
Spec Gate
─────────
AC-001 ✓
AC-002 ✓
AC-003 ✗  FAIL — password reset not implemented
```

**If any AC is ✗ FAIL → BLOCK:**
```
🔴 SHIP BLOCKED — Spec Not Complete

These acceptance criteria are not satisfied:
[AC-003] password reset not implemented

Fix them with /buildflow-build or /buildflow-modify, then re-run /buildflow-ship.
Override (skips spec gate only): /buildflow-ship --skip-spec
```

**If all ACs pass → proceed to Gate 1.**

---

## MANDATORY Gate 1: Pre-Ship Security Scan

Spawn Security Auditor in `--pre-ship` mode:
- Scan changed files only (git diff since last commit)
- Check for secrets
- Check critical injection patterns
- Check auth bypass risks
- Check critical dependency CVEs

**Critical found → BLOCK:**
```
🔴 SHIP BLOCKED — Critical Security Issues

[C1] [issue] at [file:line]
     Fix: [specific action]

Run /buildflow-modify for surgical fixes.
Override (not recommended): /buildflow-ship --force
```

**High found → WARN (non-blocking):**
```
⚠️  Security Warnings
[H1] [issue] — fix in next phase
```

**Clean → proceed.**

---

## MANDATORY Gate 2: Tests Pass + Cross-Phase Regression

### 2a — Full suite run
Run the test suite one final time.
If any test fails: BLOCK. "Fix test failures before shipping."

### 2b — Cross-Phase Regression Check

Run the full test suite including tests from all prior phases — not just tests added this phase.

```bash
npm test           # runs all tests in the repo
pytest             # runs all tests in the repo
go test ./...      # runs all packages
cargo test         # runs all crates
```

Check for regressions introduced by this phase's changes:
1. Pull the baseline passing test count from `light.md` field `last_ship_test_count` (set after previous ship)
2. Compare: if current passing count < baseline → regression detected

**Regression detected → BLOCK:**
```
🔴 SHIP BLOCKED — Regression Detected

Tests that were passing before this phase are now failing:
  [test name] at [file:line] — was: PASS, now: FAIL

These tests cover prior-phase behavior. Do not ship until they pass.
Fix with /buildflow-modify (targeted fix) or /buildflow-debug (root-cause analysis).
```

**No regressions → proceed.**

After Gate 2 passes, record the test count for the next phase:
```yaml
last_ship_test_count: [N passing tests]
last_ship_date: [today]
```

---

## MANDATORY Gate 3: Build Telemetry

Run the full build quality pipeline — type safety and compilation correctness are non-negotiable before shipping.

### Type Check
```bash
# TypeScript
npx tsc --noEmit
# Python
mypy .
# Go
go vet ./...
# Rust
cargo check
```

**Any type errors → BLOCK:**
```
🔴 SHIP BLOCKED — Type Errors

[N] type error(s) found:
  [file:line] [error message]

Fix with /buildflow-modify or /buildflow-hotfix, then re-run /buildflow-ship.
```

### Lint
```bash
# JS/TS
npx eslint src/ --max-warnings=0
# Python
ruff check . / flake8 .
# Go
golangci-lint run
# Rust
cargo clippy -- -D warnings
```

**Lint errors → BLOCK.** Lint warnings → non-blocking WARN, logged.

### Compile / Build
```bash
npm run build      # JS/TS
python -m build    # Python
go build ./...     # Go
cargo build        # Rust
```

**Compile failure → BLOCK:**
```
🔴 SHIP BLOCKED — Build Failed

Build command exited with errors.
Fix compilation errors before shipping.
```

### Bundle Size (JS/TS only)
Compare final bundle size against baseline from `Build Toolchain Profile` (recorded during last `/buildflow-build`):
- Delta ≤ +10% → PASS
- Delta +10–25% → `⚠ BUNDLE WARN: bundle grew [X]% — review before shipping`
- Delta > +25% → `🔴 BUNDLE ALERT: bundle grew [X]% — likely an unintended large import. Investigate before shipping.` — BLOCKING

**Gate 3 Summary:**
```
Build Telemetry Gate
────────────────────
Type-check:   ✓ PASS
Lint:         ⚠ WARN  (4 warnings — logged, non-blocking)
Compile:      ✓ PASS
Bundle size:  ✓ PASS  (148 KB → 151 KB, +2%)

Gate 3: ✓ PASS
```

---

## Step 1: Pre-Ship Checklist (summary)
- [ ] All ACs satisfied (Gate 0)
- [ ] Security gate passed (Gate 1)
- [ ] All tests passing — current phase (Gate 2a)
- [ ] No cross-phase regressions (Gate 2b)
- [ ] Build telemetry clean (Gate 3) — type-check + lint errors + compile
- [ ] `/buildflow-check` run and reviewed

---

## Step 2: Retrospective
Ask:
1. What worked well this phase?
2. What was harder than expected?
3. What did you learn?
4. Confidence in deliverables (1-5)?

Save to `.buildflow/phases/[N]/retro.md`

---

## Step 3: Context Pruning (token efficiency)

After a successful ship, prune `light.md` to stay lean for the next phase:

**Archive** these from `light.md` to `phases/[N]/retro.md`:
- Phase-specific task lists
- Wave completion details
- Build timestamps
- Hotfix history older than current phase

**Keep** in `light.md`:
- app_name, framework, language
- current_phase (update to N+1 or "complete")
- spec_status (reset to "none" for next phase)
- style_fingerprint
- last 2 architectural decisions
- onboard_status

**Target:** `light.md` must be under 3K tokens after pruning.

Update `light.md`:
```yaml
current_phase: [N+1 or complete]
last_ship_date: [today]
spec_status: none
plan_status: none
context_pruned: [today]
```

---

## Step 4: Update Docs
- README if public-facing features shipped
- `vision.md` if pivots occurred during the phase

---

## Step 5: Tag Release
```bash
git add .
git commit -m "ship: phase [N] complete"
git tag "phase-[N]-complete"
```

---

## Step 6: Next Phase
Suggest next phase based on remaining roadmap items.
"Phase [N] shipped. Run `/buildflow-spec` to define the next phase."

---

## Override Flags
- `--skip-spec` — skips spec gate only. Logs to `security/DEBT.md`: "Spec gate skipped — [reason]"
- `--force` — skips security gate only. Requires typed confirmation. Logged with timestamp.
- `--skip-telemetry` — skips Gate 3. Logs to `security/DEBT.md`: "Build telemetry gate skipped — [reason]"

No flag skips the test gate (Gate 2) or type errors in Gate 3. Type safety and green tests are non-negotiable.

## Token Budget: ~26K (including gates)
