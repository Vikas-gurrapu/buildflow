---
name: buildflow-build
description: Spec-traced wave execution with pattern-matched Builders, auto-test, auto-fix, and PR-ready commits
allowed-tools: Read, Write, Bash, Grep, Glob
agents: builder, reviewer
---

# /buildflow-build

Execute the current phase plan. Each Builder receives a precise context packet — task spec, AC refs, before/after contract, and the closest existing example to follow. Every wave auto-tests, auto-fixes until green, and produces a PR-ready commit. The next wave never starts until the current wave is fully passing.

## Usage
- `/buildflow-build` — execute all waves
- `/buildflow-build wave-2` — execute a specific wave
- `/buildflow-build <task>` — build a single task

## Context Packet for this command (load only these)
- `.buildflow/phases/[N]/PLAN.md`
- `.buildflow/codebase/PATTERNS.md` (if exists)
- `.buildflow/memory/light.md` (app_name, framework, style_fingerprint only)

Do NOT load: full specs, full codebase, research, retros, old phases.

---

## Step 1: Load & Confirm Plan
Read `.buildflow/phases/[N]/PLAN.md`.
Report: "Phase [N] — [N] waves, [N] tasks, [N] ACs. Est: [total]. Starting Wave [N]."

Check external dependency checklist if present. If unchecked items: "Verify these before building: [list]"

---

## Step 2: Detect Test Framework (runs once before any wave)

Before writing a single test line, identify what testing infrastructure exists.

### Detection checklist:

**JavaScript / TypeScript:**
```bash
# Check package.json for test deps
cat package.json | grep -E "jest|vitest|mocha|jasmine|@testing-library|supertest|cypress|playwright"
# Check for config files
ls jest.config.* vitest.config.* .mocharc.* 2>/dev/null
# Check for existing test files
find . -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" | head -5
find . -type d -name "__tests__" | head -3
```

**Python:**
```bash
cat requirements.txt pyproject.toml setup.cfg 2>/dev/null | grep -E "pytest|unittest|nose"
find . -name "test_*.py" -o -name "*_test.py" | head -5
```

**Go:**
```bash
find . -name "*_test.go" | head -5
```

**Rust:**
```bash
grep -n "#\[test\]\|#\[cfg(test)\]" src/**/*.rs | head -5
```

### Framework Resolution:

| Result | Action |
|--------|--------|
| Framework found + config exists + test files exist | Use it. Infer conventions from existing test files. |
| Framework in package.json but no test files yet | Use it. Write tests following framework docs conventions. |
| No framework found, greenfield project | Ask: "No test framework detected. Recommend installing [Jest/Vitest for TS, pytest for Python, built-in for Go/Rust]. Set it up now? (yes / skip / I'll do it later)" |
| No framework, existing project with no tests | Warn: "⚠ No test framework found. Tests cannot be written until one is installed. Proceeding without tests — recommend adding [framework] before shipping." Log to `security/DEBT.md`: "No test framework — zero coverage." |

### If framework found — capture test profile:
```
Test Framework Profile
──────────────────────
Framework:     Jest 29 / Vitest 1.x / pytest 7.x / go test / cargo test
Config file:   jest.config.ts / vitest.config.ts / pytest.ini / N/A
Test location: co-located (*.test.ts) / __tests__/ / tests/
Naming:        describe/it / test() / def test_ / #[test]
Mocking:       jest.mock / vi.mock / pytest fixtures / mockall
Coverage tool: --coverage / --cov / go test -cover / cargo tarpaulin
Existing tests: [N] files, [N] total cases
```

This profile is passed to every Builder as part of their context packet.

---

## Step 2b: Detect Build Toolchain (runs once before any wave)

Before the first wave, identify what static analysis and build tools are available.

### Detection checklist:

**JavaScript / TypeScript:**
```bash
# Check package.json scripts for build toolchain commands
cat package.json | python3 -c "import sys,json; s=json.load(sys.stdin).get('scripts',{}); [print(k,':',v) for k,v in s.items() if any(x in k for x in ['build','lint','type','check','tsc'])]"
# Check for TypeScript config
ls tsconfig.json tsconfig.*.json 2>/dev/null
# Check for linter config
ls .eslintrc.* .eslintrc .prettierrc* biome.json 2>/dev/null
```

**Python:**
```bash
cat pyproject.toml setup.cfg 2>/dev/null | grep -E "mypy|flake8|pylint|ruff|black|isort"
ls mypy.ini .mypy.ini setup.cfg 2>/dev/null
```

**Go:**
```bash
which golangci-lint 2>/dev/null
ls .golangci.yml .golangci.yaml 2>/dev/null
```

**Rust:**
```bash
# clippy is built-in to cargo
grep -E "clippy" Cargo.toml 2>/dev/null
```

### Build Toolchain Profile:
```
Build Toolchain Profile
───────────────────────
Type-check cmd:  tsc --noEmit / mypy . / go vet ./... / cargo check
Lint cmd:        eslint src/ / ruff check . / golangci-lint run / cargo clippy
Build cmd:       npm run build / python -m build / go build ./... / cargo build
Bundle tool:     vite / webpack / esbuild / rollup / N/A
Bundle baseline: [size in KB from last build, or "no baseline yet"]
Has tsconfig:    YES / NO
Has lint config: YES / NO
```

| Result | Action |
|--------|--------|
| Type-check found | Run before each wave commit — type errors BLOCK the commit |
| Lint found | Run before each wave commit — warnings non-blocking, errors BLOCK |
| Build cmd found | Run before ship — compile failure BLOCKS |
| None found | Warn once: "⚠ No build toolchain detected. Type safety and lint checks skipped." Log to `security/DEBT.md`. |

This profile is passed to every wave alongside the Test Framework Profile.

---

## Step 3: Establish Style Fingerprint
If `PATTERNS.md` exists: extract the 5 most important conventions and hold them in scope.
If not: read 2 existing source files and infer:
- Naming convention
- Import order
- Error handling pattern
- Async style
- Test naming pattern (from test profile above)

This fingerprint applies to every Builder in every wave.

---

## Step 3: Wave Execution Loop

Repeat for each wave:

### 3a — Build Context Packets
For each task in this wave, assemble a minimal context packet:

```
Task: [name]
Goal: [one sentence — what this task makes true]
AC refs: [AC-001, AC-003]
Before: [what currently exists — "file doesn't exist" or "function X does Y"]
After:  [what must be true when this task is done]

Files to create/modify: [explicit list — max 5]
Closest existing example: [path/to/similar/file.ts — "follow this structure"]
Key pattern to follow: [specific convention from PATTERNS.md]
Definition of done: [linked ACs that must pass]
```

The "closest existing example" is the most important field. Builders replicate proven patterns — they don't invent new ones unless the task explicitly requires it. Find the nearest analog in the codebase.

### 3b — Parallel Build
Spawn one Builder per task. Each Builder receives ONLY its context packet.

Each Builder:
- Writes code that satisfies the Before → After contract
- Follows the closest existing example's structure
- Covers the referenced ACs
- **Writes tests as part of the same task — not after, not later, not optional**
- Adds `LEARN:` comment only for patterns not present elsewhere in the codebase

#### Mandatory Test Writing Rules (enforced per Builder)

**Prerequisite:** Test Framework Profile from Step 2 must exist. If no framework was found and user chose to skip, mark this task's test output as SKIPPED and log to `security/DEBT.md`.

**For every new source file created:**
- Create a corresponding test file using the detected framework and location convention:
  - Jest/Vitest co-located: `auth.service.ts` → `auth.service.test.ts`
  - `__tests__` folder: `src/auth/auth.service.ts` → `src/auth/__tests__/auth.service.test.ts`
  - pytest: `src/auth/service.py` → `tests/auth/test_service.py`
  - Go: `auth/service.go` → `auth/service_test.go` (same package)
  - Rust: add `#[cfg(test)] mod tests { }` block inside same file
- Test file must cover: each exported function/method, each AC referenced by this task
- Minimum: 1 happy path + 1 error/edge case per exported function

**For every modified source file:**
- Locate the existing test file using the detected convention
- Add new test cases for every function whose behavior changed
- Update existing test cases if the function's contract or signature changed
- Do NOT delete passing test cases unless the behavior they test was explicitly removed

**Test structure — follow detected framework exactly:**

Jest / Vitest:
```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('returns token when credentials are valid', async () => { ... })
    it('throws UnauthorizedError when password is wrong', async () => { ... })
  })
})
```
pytest:
```python
def test_login_returns_token_with_valid_credentials():  ...
def test_login_raises_unauthorized_with_wrong_password(): ...
```
Go:
```go
func TestLogin_ReturnsToken_WithValidCredentials(t *testing.T) { ... }
func TestLogin_ReturnsError_WithWrongPassword(t *testing.T) { ... }
```

Builder reports back:
```
Task: [name] — COMPLETE
Files created:  [list]
Files modified: [list]
Test files written/updated: [list with case count]
  auth.service.test.ts — 6 cases (4 new, 2 updated)
ACs addressed: [AC-001 ✓, AC-003 ✓]
Pattern followed: [example file used]
```

### 3c — Reviewer Check
Reviewer reads each Builder's output:
- Does the implementation satisfy the referenced ACs?
- Does it match the style fingerprint and closest example?
- Are tests present for non-trivial logic?
- Any security concerns?
- Did the Builder follow the Before → After contract?

Flag any deviation from existing patterns — Builders should blend in, not stand out.

### 3d — Build Telemetry Check (runs before tests — catches type errors early)

Using the Build Toolchain Profile from Step 2b, run the quality pipeline in sequence:

**1. Type Check**
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
- **PASS** → proceed
- **FAIL (type errors)** → enter fix loop immediately. Do NOT proceed to tests until type-clean.

Type error fix loop (max 3 attempts before escalating):
```
Type Fix [X]/3  Wave [N]
Error:      [message at file:line]
Root cause: [why it's failing]
Fix:        [exactly what changed]
Result:     PASS / still failing
```

**2. Lint**
```bash
# JS/TS
npx eslint src/ --max-warnings=0
# Python
ruff check . / flake8 . / pylint src/
# Go
golangci-lint run
# Rust
cargo clippy -- -D warnings
```
- **Errors** (exit code non-zero) → fix before proceeding
- **Warnings only** → log to wave report as `⚠ LINT WARN: [N] warnings` — non-blocking

**3. Bundle Size Check (JS/TS only, if build cmd exists)**
```bash
npm run build 2>&1 | grep -E "dist/|bundle|chunk|asset"
```
Compare output size against `Bundle baseline` in Build Toolchain Profile:
- First build → record as baseline in profile
- Subsequent builds → compute delta
- Delta > +10% → `⚠ BUNDLE WARN: bundle grew [X]% ([old KB] → [new KB])` — non-blocking
- Delta > +25% → `🔴 BUNDLE ALERT: bundle grew [X]% — likely an unintended import. Investigate before proceeding.` — BLOCKING

**Build Telemetry Report (printed for each wave):**
```
Build Telemetry  Wave [N]
────────────────────────
Type-check:   ✓ PASS  (0 errors)
Lint:         ⚠ WARN  (3 warnings — non-blocking)
Bundle size:  ✓ PASS  (142 KB → 144 KB, +1.4%)
```

Only proceed to Step 3e after type-check is PASS and lint errors (not warnings) are fixed.

### 3e — Test + Fix Loop
Run the full test suite:
```bash
npm test        # Node / TS / JS
pytest          # Python
go test ./...   # Go
cargo test      # Rust
```

If frontend changed: verify dev server renders without errors, core flow works.
Check: no regressions in previously passing tests.

**On test failure:**
1. Read the exact error — file, line, message
2. Trace root cause (not just symptom)
3. Apply minimal fix
4. Re-run tests
5. Repeat until green

Max 5 fix attempts. After 5: stop, report what's unresolved, ask how to proceed.

Fix log per attempt:
```
Fix [X]/5  Wave [N]
Error:      [message at file:line]
Root cause: [why it's failing]
Fix:        [exactly what changed]
Result:     PASS / still failing
```

### 3f — Wave Commit
When all tests pass, commit this wave atomically:
```bash
git add [changed files — explicit list, not -A]
git commit -m "[type](scope): [what changed]

[Body: why this change, which ACs it satisfies]
[AC refs: AC-001, AC-003]
[Wave: N of M]"
```

Commit types: `feat` / `fix` / `test` / `refactor` / `chore`

Example:
```
feat(auth): add JWT middleware and login route

Implements token validation for all protected routes.
Satisfies: AC-001 (valid login), AC-002 (invalid password rejection), AC-003 (expired token)
Wave: 2 of 4
```

Mark wave complete in `phases/[N]/PLAN.md`. Proceed to next wave.

---

## Step 4: Final Integration Check
After all waves:
- Run full test suite one last time
- Verify all AC-referenced behaviors work end-to-end
- Check imports across wave boundaries (no dangling references)

---

## Step 5: Update Memory (lean — prune old build fields)
```yaml
last_build_date: [today]
plan_status: built
test_status: passing
waves_completed: [N]
```
Remove from `light.md`: per-task details from previous builds.

---

## Token Budget: ~50K per wave (context packets keep individual Builder costs low)
