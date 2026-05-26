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
- `.buildflow/phases/[N]/STATE.md` (if exists - resume status, check result, risks, test strategy)
- Changed file list only: git diff if `git.permission: approved`; otherwise completed wave file lists from `PLAN.md`

---

## Phase State Resume
Read `.buildflow/core/state.md`, `.buildflow/memory/light.md`, `.buildflow/phases/[N]/PLAN.md`, and `.buildflow/phases/[N]/STATE.md` if it exists.

Use `STATE.md` to confirm the latest build/check status, risks, skipped tests, and intended ship path. If it says `Status: shipped` and `SHIPPED.md` exists, summarize the shipped state and continue to the next-phase recommendation instead of re-shipping unless the user explicitly asks.

Before exiting, update `.buildflow/phases/[N]/STATE.md` with:
- Current State: `Status: shipped`, `Wave: complete`
- Decisions: ship gate outcomes, accepted debt, post-ship advisor choice
- Files That Matter: `SHIPPED.md`, `retro.md`, snapshots/tags, and key shipped files
- Next Command: `/buildflow-spec "[suggested phase name]"`
- Risks / Open Questions: open debt, deferred checks, follow-up work
- Test Strategy: ship tests/regression results and baseline counts/coverage

---

## MANDATORY Gate 0: Spec Compliance Check

**0a — Version consistency check:**
Read `spec_version` from `acceptance.md` frontmatter and from `PLAN.md` header.
If they differ:
```
🔴 SHIP BLOCKED — Plan Built Against Old Spec

Plan was built against spec v[N], current spec is v[M].
The code may implement outdated requirements.

Run /buildflow-plan to regenerate the plan, then /buildflow-build for affected waves.
Override: /buildflow-ship --skip-spec (logs to DEBT.md)
```

**0b — Full AC compliance:**
Read `.buildflow/specs/acceptance.md`. Verify every AC is satisfied.

```
Spec Gate (v[spec_version])
────────────────────────────
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

**If versions match and all ACs pass → proceed to Gate 0c.**

**0c — Strict Mode Gate (if `strict_mode: true` in preferences.md OR phase was planned with `--strict`):**

Read `.buildflow/phases/[N]/STRICT-REPORT.md`.
If the file does not exist: "Run `/buildflow-check --strict` first — strict mode is enabled for this phase."
If the file exists:

```
Strict Mode Gate
──────────────────────────────────────────
API contracts:      [N/N passing]
Component map:      [ALIGNED / N ghost / N orphaned]
Critical coverage:  [N/N symbols covered]
AC branches:        [N/N complete]

Strict verdict: PASS / FAIL
```

**If strict verdict is FAIL → BLOCK:**
```
🔴 SHIP BLOCKED — Strict Mode Violations

Code structure diverges from spec structure:
  [S1] POST /api/login — response field "accessToken" != TECHINICALDESIGN.md contract "token"
  [S3] src/auth/service.ts — logout() has no linked AC
  [S4] AC-004 — refreshToken() has no expiry check branch

Fix violations listed in .buildflow/phases/[N]/STRICT-REPORT.md, then re-run:
  /buildflow-check --strict
  /buildflow-ship

No override flag exists for strict violations. Strict mode means the spec is law.
```

**If strict verdict is PASS (or strict mode not enabled) → proceed to Gate 1.**

---

## MANDATORY Gate 1: Pre-Ship Security Scan

Spawn Security Auditor in `--pre-ship` mode:
- Scan changed files only:
  - **If `git.permission: approved`:** `git diff --name-only HEAD~1..HEAD -- src/`
  - **If `git.permission` is not `approved`:** use file list from completed wave tasks in `PLAN.md` (same source as check.md)
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
Run the type-check command from the Build Toolchain Profile detected in Step 2b of `/buildflow-build` (stored in `light.md → build_toolchain`). If not recorded, detect now:

```bash
# TypeScript
npx tsc --noEmit
# Python
mypy .
# Go
go vet ./...
# Rust
cargo check
# Java (Maven)
./mvnw compile -q 2>&1 | grep -E "ERROR|error:"
# Java/Kotlin (Gradle)
./gradlew compileJava compileKotlin --quiet 2>&1 | grep -E "error:"
# C# / .NET
dotnet build --no-restore 2>&1 | grep -E "error CS|Build FAILED"
# Ruby (syntax check all files)
find . -name "*.rb" ! -path "*/vendor/*" | xargs ruby -c 2>&1 | grep -v "Syntax OK"
# PHP
find . -name "*.php" ! -path "*/vendor/*" | xargs php -l 2>&1 | grep -v "No syntax errors"
# Dart / Flutter
flutter analyze 2>/dev/null || dart analyze
# Swift
swift build 2>&1 | grep -E "error:"
# Scala
sbt compile 2>&1 | grep -E "\[error\]"
```

**Any type/compile errors → BLOCK:**
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
# Java (Maven)
./mvnw checkstyle:check -q 2>/dev/null
# Java/Kotlin (Gradle)
./gradlew checkstyleMain detekt 2>/dev/null
# C# / .NET
dotnet format --verify-no-changes 2>/dev/null
# Ruby
bundle exec rubocop --format progress 2>/dev/null
# PHP
./vendor/bin/phpstan analyse --no-progress 2>/dev/null || ./vendor/bin/psalm --no-progress 2>/dev/null
# Dart / Flutter  (analysis_options.yaml drives this)
flutter analyze 2>/dev/null || dart analyze
# Swift
swiftlint lint --quiet 2>/dev/null
# Scala
sbt scalafmtCheck 2>/dev/null
```

**Lint errors → BLOCK.** Lint warnings → non-blocking WARN, logged.

### Compile / Build
```bash
npm run build          # JS/TS
python -m build        # Python
go build ./...         # Go
cargo build            # Rust
./mvnw package -DskipTests -q   # Java (Maven)
./gradlew build -x test         # Java/Kotlin (Gradle)
dotnet publish -c Release -q    # C# / .NET
bundle exec rake assets:precompile 2>/dev/null  # Ruby on Rails
composer install --no-dev       # PHP
flutter build apk --release 2>/dev/null || flutter build web  # Dart / Flutter
swift build -c release          # Swift
sbt package                     # Scala
```

**Compile failure → BLOCK:**
```
🔴 SHIP BLOCKED — Build Failed

Build command exited with errors.
Fix compilation errors before shipping.
```

### Docker Build (if Dockerfile present)
```bash
# Verify the image still builds cleanly before shipping
docker build --no-cache -t [app-name]:ship-check . 2>&1 | tail -5
docker rmi [app-name]:ship-check 2>/dev/null
```
**Docker build failure → BLOCK:** "Dockerfile builds failed. Fix image before shipping."
**No Dockerfile:** skip silently.

### Test Coverage
Read the coverage threshold from `.buildflow/you/preferences.md`:
```yaml
spec_coverage:
  threshold: 80   # default: 70 if not set
```

Run coverage and compare against `last_ship_coverage` in `light.md`:
```bash
npx jest --coverage --coverageReporters=json-summary --passWithNoTests 2>/dev/null
pytest --cov=src --cov-report=term-missing 2>/dev/null
go test ./... -cover 2>/dev/null
```

Also check `.buildflow/phases/[N]/COVERAGE-MAP.md` (written by `/buildflow-check`):
- If COVERAGE-MAP.md has a recorded exception decision (bugfix/incremental), inherit that decision — no re-prompt needed. Log inherited decision and proceed.

| Coverage state | Action |
|----------------|--------|
| No baseline yet | Record current %, proceed |
| Drop 0–5% | WARN — non-blocking |
| Drop < threshold AND no COVERAGE-MAP exception | Smart prompt (see below) |
| Drop ≥ threshold | PASS silently |
| Increased | PASS silently |

**Smart coverage prompt at ship (when below threshold and no prior exception):**
```
Coverage at Ship
────────────────
Last shipped:    [N]%
Current:         [M]%
Your threshold:  [T]%  (set in preferences.md)

Uncovered areas:
  [file] — [N] uncovered functions

Context:
  [B] Bugfix phase — coverage tracking less relevant for targeted fixes
  [N] Building up coverage incrementally — this flow is partially covered intentionally
  [F] Fix now — add tests before shipping (re-runs from Gate 2)
  [P] Ship anyway — log gap to DEBT.md and proceed
```

- **[B]:** Log "Shipped: bugfix phase, coverage [N]% below threshold [T]% — accepted [date]" to DEBT.md. Proceed.
- **[N]:** Log "Shipped: incremental coverage build-up, [N]% below threshold [T]% — accepted [date]" to DEBT.md. Proceed.
- **[F]:** Pause ship, add tests, re-run gates from Gate 2.
- **[P]:** Log "Shipped with coverage [N]% below threshold [T]% — developer decision [date]" to DEBT.md. Proceed.

Coverage never hard-blocks ship — the decision belongs to the developer.

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
Coverage:     ⚠ WARN  (74% → 71%, -3% — proceeding)
Compile:      ✓ PASS
Bundle size:  ✓ PASS  (148 KB → 151 KB, +2%)

Gate 3: ✓ PASS
```

---

## Step 1: Pre-Ship Checklist (summary)
- [ ] Spec version consistent — plan matches current spec (Gate 0a)
- [ ] All ACs satisfied (Gate 0b)
- [ ] Strict mode passed (Gate 0c) — only if `strict_mode: true` or `--strict` flag
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
- spec_version (reset to 0 — next phase starts fresh)
- style_fingerprint
- last 2 architectural decisions
- onboard_status

**Never archive or delete:**
- `.buildflow/specs/approvals.md` — permanent audit trail, never pruned
- `.buildflow/phases/[N]/PLAN.md` `## Deviations` section — permanent record

**Target:** `light.md` must be under 3K tokens after pruning.

Update `light.md`:
```yaml
current_phase: [N+1 or complete]
last_ship_date: [today]
last_ship_spec_version: [N]   ← record what version shipped
last_ship_coverage: [N]%      ← baseline for next phase coverage drop detection
spec_status: none
spec_version: 0
plan_status: none
context_pruned: [today]
```

---

## Step 4: Write Phase History (cross-phase continuity)

Write `.buildflow/phases/[N]/SHIPPED.md` — a compact, permanent record future phases can load as context:

```markdown
# Phase [N] — Shipped [date]

## What was built
[2–3 sentences. What the user can now DO that they couldn't before this phase.]

## ACs satisfied
[N] total: AC-001 (login), AC-002 (invalid password), AC-003 (password reset), ...

## Key files changed
| File | What changed | AC |
|------|--------------|----|
| src/auth/service.ts | new — JWT login logic | AC-001, AC-002 |
| src/routes/auth.ts | new — /login, /reset endpoints | AC-001, AC-003 |

## Architecture decisions made
- [decision]: [why — one line]

## Technical debt opened this phase
[N items — brief list from DEBT.md entries added this phase]

## Spec version shipped
v[N] (approved [date])

## Coverage at ship
[N]% ([N] passing tests)
```

This file is ≤500 tokens. It is the only cross-phase context future `/buildflow-start` sessions load — not the full plan or spec.

---

## Step 5: Update Docs
- README if public-facing features shipped
- `vision.md` if pivots occurred during the phase

---

## Step 5: Tag Release

Before any git command, read `.buildflow/you/preferences.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Use no-git snapshot mode, even if `.git/` exists or `light.md` says `git_available: true`.
- If `preferences.md` is missing or `git.permission` is absent: ask the user before running any git command.

**If `git.permission: approved`:**
```bash
git add .
git commit -m "ship: phase [N] complete"
git tag "phase-[N]-complete"
```

**If `git.permission` is not `approved` (no-git mode):**
Take a full snapshot of `src/` into `.buildflow/snapshots/phase-[N]-shipped/`.
Record phase completion in `state.md`:
```yaml
phase_[N]_status: shipped
phase_[N]_shipped_at: [ISO datetime]
phase_[N]_snapshot: .buildflow/snapshots/phase-[N]-shipped/
phase_[N]_ac_count: [N]
phase_[N]_spec_version: v[N]
```
This snapshot is the authoritative record of what was shipped — equivalent to a git tag.

---

## Step 6a: Git Status Message (always shown at ship time)

**If `git_permission: denied` or `git_permission: denied_permanent` (no-git mode):**
```
✓ Phase [N] complete — [N] ACs satisfied
──────────────────────────────────────────────────────────────
Your feature is built, tested, and all acceptance criteria are satisfied.

Code snapshot:   .buildflow/snapshots/phase-[N]-shipped/
Phase record:    .buildflow/phases/[N]/SHIPPED.md
State:           .buildflow/core/state.md  (phase_[N]_status: shipped)

To add version control at any time:
  1. Install git: https://git-scm.com/downloads
  2. Run in terminal: git init && git add . && git commit -m "feat: phase [N] complete"
  3. Enable in BuildFlow: edit .buildflow/you/preferences.md
     set: git.permission: approved
  4. In your AI tool run: /buildflow-help git-enable

Your work is safe — the snapshot is a full record of everything shipped this phase.
```

**If `git.permission: approved` AND `parked_changes` is non-empty:**
```
⚠ Parked Changes — Action Needed
──────────────────────────────────
These changes from earlier phases were never committed to git:

  Phase [N], Wave [W] — [date parked]
  Files: [list]
  Snapshot: .buildflow/snapshots/phase-[N]-wave-[W]-parked/

Options:
  [C] Commit now  — run git commit for each parked snapshot in order
  [L] Leave       — continue to next phase (parked changes remain in working tree)
  [H] Help        — run /buildflow-help git-resolve-parked for step-by-step guide
```
Clear resolved entries from `parked_changes` in `light.md` after the user commits them.

---

## Step 6b: Post-Ship Advisor

After shipping, automatically run the feature advisor from `/buildflow-help next` — no need for the user to ask separately.

### 6a — What's left in the roadmap
If `vision.md` contains a roadmap or future features list: surface the next 2–3 items.
"Remaining from your vision: [items]"

### 6b — Market & standards gap (auto-runs, parallel)
Spawn two quick Researchers (same as `/buildflow-help next` Step 5b):

**Researcher A** — top 3 features users of this app type expect that aren't shipped yet
**Researcher B** — engineering standards for this app type that are missing

Time-box each to a fast search (3–5 queries). This runs automatically — user doesn't need to trigger it.

Print the summary:
```
Phase [N] shipped ✓
────────────────────────────────────────────
What you just built: [one-line summary of shipped ACs]

What to consider next:
─────────────────────
Standard features missing:
  → [feature 1] — [why it matters for this app type]
  → [feature 2] — [why it matters]

Engineering standards to address:
  → [standard 1] — [e.g., "health check endpoint — standard for any deployed service"]
  → [standard 2]

Your debt right now: [N items in DEBT.md] — consider a cleanup phase if > 5

Suggested next: /buildflow-spec "[suggested phase name]"
```

Save to `.buildflow/learnings/feature-suggestions.md` (appends, doesn't overwrite).

---

## Override Flags
- `--skip-spec` — skips spec gate only. Logs to `security/DEBT.md`: "Spec gate skipped — [reason]"
- `--force` — skips security gate only. Requires typed confirmation. Logged with timestamp.
- `--skip-telemetry` — skips Gate 3. Logs to `security/DEBT.md`: "Build telemetry gate skipped — [reason]"

No flag skips the test gate (Gate 2) or type errors in Gate 3. Type safety and green tests are non-negotiable.

## Token cost report (print at end of ship)

Measure actual cost before printing:
1. Sum character counts of all files read in Context Packet + gate-loaded files ÷ 4 = input tokens
2. Estimate output from text generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

```
Token Cost — /buildflow-ship
─────────────────────────────
Ship complete — Phase [N]
Gates: 0a ✓  1 ✓  2a ✓  2b ✓  3 ✓
ACs verified: [N/N]
Context loaded:    ~[N]K tokens   (acceptance.md + state.md + light.md + changed files)
Output generated:  ~[N]K tokens   (gates output + SHIPPED.md + retro.md)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

Update `light.md`: `last_ship_tokens: ~[N]K`

## Guided Next Step

Before printing this block, check session context usage. Because shipping closes a phase boundary, recommend clearing the current AI session after saving `STATE.md` before starting the next phase.

The post-ship advisor (Step 6b) already surfaced the top suggestion. Close with:

```
──────────────────────────────────────────────────
→ Next:  /buildflow-spec "[suggested phase name]"
   Why:  Phase [N] shipped ✓ — start defining what to build next
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

Use the suggested phase name from the post-ship advisor output as the argument.
If debt > 5 items: `Or: /buildflow-think --debt` (address tech debt before next feature).

## Token Budget: ~26K (gates) / ~40K (with post-ship market research in Step 6b)
