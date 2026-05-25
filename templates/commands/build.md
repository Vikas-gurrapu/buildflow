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
- `.buildflow/codebase/STRUCTURE.md` (if exists — only relevant sections for touched paths)
- `.buildflow/codebase/TESTING.md` (if exists — targeted test command and test layout)
- `.buildflow/codebase/CONCERNS.md` (if exists — only concerns relevant to touched paths)
- `.buildflow/memory/light.md` (app_name, framework, style_fingerprint only)
- `.buildflow/you/preferences.md` (git.permission only)

Do NOT load: full specs, full codebase, research, retros, old phases.

---

## Git Permission Guard (mandatory)

Before any git command, read `.buildflow/you/preferences.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Treat this session as no-git mode, even if `.git/` exists or `light.md` says `git_available: true`.
- If `preferences.md` is missing or `git.permission` is absent: ask the user before running any git command.

This guard applies to commits, tags, stash, worktrees, branches, merges, and resets.

---

## Step 1: Load & Confirm Plan
Read `.buildflow/phases/[N]/PLAN.md`.
Report: "Phase [N] — [N] waves, [N] tasks, [N] ACs. Est: [total]. Starting Wave [N]."

**Parked-changes conflict check — runs before every build start:**

Read `parked_changes` array from `light.md`. If it is non-empty, cross-reference against the new phase's PLAN.md file lists:

For every file in the new plan's tasks, check if that file appears in `parked_changes`:

```
Parked Changes Conflict Detected
──────────────────────────────────
The following files have unresolved parked changes from a previous phase
AND are also listed in this phase's plan:

  src/auth/service.ts
    Parked: Phase 1, Wave 2 (2024-01-14)
    Reason: git commit failed
    Snapshot: .buildflow/snapshots/phase-1-wave-2-parked/
    New plan task: "Add refresh token logic" (Wave 2, this phase)

Building on top of parked changes means both features will be combined
in a single future git commit — you lose the ability to review or revert
them independently.

Options:
  [G] Resolve git first (recommended)
      Fix the git issue, commit Phase 1 changes, then start this phase.
      Run: /buildflow-help git-enable  OR  check your git remote/auth.

  [S] Stack and continue (acknowledged)
      BuildFlow will take a "stack snapshot" separating Phase 1 and Phase 2
      changes on these files before Phase 2 modifies them.
      When git is restored, you will see one combined diff — that is expected.
      Your PLAN.md will note which commits belong to which phase.

  [A] Abort this phase
      Come back after resolving the parked changes.
```

**If user chooses Stack and continue:**
1. Before Phase 2 writes anything to the overlapping files, copy their current state (which includes Phase 1's parked changes) into `.buildflow/snapshots/phase-[N-1]-final-state/`
2. Add a note to the new phase's PLAN.md:
   ```markdown
   ## Parked Changes Notice
   Files inherited with unresolved parked changes from Phase [N-1]:
     - src/auth/service.ts (parked wave 2, 2024-01-14)
   Stack snapshot: .buildflow/snapshots/phase-1-final-state/
   When git is restored: commit phase-1-final-state/ first, then commit current state.
   ```
3. Continue the build normally.

If `parked_changes` is empty: skip this check silently.

**Spec amendment gate — runs before every build start:**
1. Read `spec_version` from `PLAN.md` header (the version this plan was built against)
2. Read `spec_version` from `.buildflow/specs/acceptance.md` frontmatter (current version)
3. If they differ:
   ```
   🔴 BUILD BLOCKED — Spec Amended Since Plan Was Created

   Plan was built against spec v[plan version].
   Current spec is v[acceptance.md version].

   The spec changed after this plan was locked. Some plan tasks may reference
   outdated ACs. Building against a stale plan risks implementing the wrong thing.

   Options:
     A) Run /buildflow-plan to regenerate the plan against the new spec (recommended)
     B) Run /buildflow-spec --review to see what changed between versions
     C) Continue anyway: /buildflow-build --accept-stale-spec
        (logs to security/DEBT.md: "Built against stale spec v[N] — current is v[M]")
   ```
4. If versions match: proceed silently.

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

**Java / Kotlin:**
```bash
# Maven
cat pom.xml 2>/dev/null | grep -E "junit|testng|mockito|assertj"
find . -path "*/src/test/*" -name "*Test.java" -o -name "*Spec.kt" | head -5
# Gradle
cat build.gradle build.gradle.kts 2>/dev/null | grep -E "junit|kotest|mockk|testng"
```

**C# / .NET:**
```bash
find . -name "*.csproj" | xargs grep -l "xunit\|nunit\|mstest\|FluentAssertions" 2>/dev/null | head -3
find . -name "*Tests.cs" -o -name "*Test.cs" -o -name "*Spec.cs" | head -5
```

**Ruby:**
```bash
cat Gemfile 2>/dev/null | grep -E "rspec|minitest|capybara|factory_bot"
find . -name "*_spec.rb" -o -name "*_test.rb" | head -5
```

**PHP:**
```bash
cat composer.json 2>/dev/null | grep -E "phpunit|pest|codeception|mockery"
find . -name "*Test.php" -o -name "*Spec.php" | head -5
```

**Dart / Flutter:**
```bash
cat pubspec.yaml 2>/dev/null | grep -E "flutter_test|test:|mocktail|mockito"
find . -path "*/test/*" -name "*_test.dart" | head -5
```

**Swift:**
```bash
# Package.swift targets with Test suffix
grep -n "testTarget\|XCTestCase\|\.testTarget" Package.swift 2>/dev/null | head -5
find . -name "*Tests.swift" -o -name "*Spec.swift" | head -5
```

**Scala:**
```bash
cat build.sbt 2>/dev/null | grep -E "scalatest|specs2|munit|scalacheck"
find . -path "*/src/test/*" -name "*Spec.scala" -o -name "*Test.scala" | head -5
```

### Framework Resolution:

| Result | Action |
|--------|--------|
| Framework found + config exists + test files exist | Use it. Infer conventions from existing test files. |
| Framework in package.json/pom/build.gradle but no test files yet | Use it. Write tests following framework docs conventions. |
| No framework found, greenfield project | Ask: "No test framework detected. Recommend [Jest/Vitest for TS, pytest for Python, JUnit 5 for Java/Kotlin, xUnit for C#, RSpec for Ruby, PHPUnit for PHP, flutter_test for Flutter, XCTest for Swift, ScalaTest for Scala, built-in for Go/Rust]. Set it up now?" |
| No framework, existing project with no tests | Warn: "⚠ No test framework found. Tests cannot be written until one is installed. Proceeding without tests — recommend adding [framework] before shipping." Log to `security/DEBT.md`: "No test framework — zero coverage." |

### If framework found — capture test profile:
```
Test Framework Profile
──────────────────────
Language:      TypeScript / Python / Java / Kotlin / C# / Ruby / PHP / Dart / Swift / Scala / Go / Rust
Framework:     Jest / pytest / JUnit 5 / Kotest / xUnit / RSpec / PHPUnit / flutter_test / XCTest / ScalaTest / go test / cargo test
Config file:   jest.config.ts / pytest.ini / build.gradle / .csproj / .rspec / phpunit.xml / N/A
Test location: co-located / src/test/ / spec/ / Tests/ / test/
Naming:        describe/it / def test_ / @Test / [Fact] / it "..." / testWidget / func Test / #[test]
Mocking:       jest.mock / pytest fixtures / Mockito / Moq / RSpec mocks / Mockery / mocktail
Coverage tool: --coverage / --cov / jacoco / coverlet / simplecov / pcov / flutter test --coverage / cargo tarpaulin
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
grep -E "clippy" Cargo.toml 2>/dev/null
```

**Java / Kotlin:**
```bash
# Maven
ls pom.xml 2>/dev/null && cat pom.xml | grep -E "checkstyle|spotbugs|pmd|errorprone|detekt|ktlint"
# Gradle
ls build.gradle build.gradle.kts 2>/dev/null && cat build.gradle.kts build.gradle 2>/dev/null | grep -E "checkstyle|spotbugs|detekt|ktlint"
# Wrapper scripts
ls mvnw gradlew 2>/dev/null
```

**C# / .NET:**
```bash
# Roslyn analyzers, StyleCop, SonarAnalyzer
find . -name "*.csproj" | xargs grep -l "StyleCop\|SonarAnalyzer\|Roslynator" 2>/dev/null | head -3
ls .editorconfig global.json 2>/dev/null
```

**Ruby:**
```bash
cat Gemfile 2>/dev/null | grep -E "rubocop|brakeman|reek"
ls .rubocop.yml 2>/dev/null
```

**PHP:**
```bash
cat composer.json 2>/dev/null | grep -E "phpstan|psalm|php-cs-fixer|squizlabs"
ls phpstan.neon psalm.xml .php-cs-fixer.php 2>/dev/null
```

**Dart / Flutter:**
```bash
cat analysis_options.yaml 2>/dev/null | head -10
ls analysis_options.yaml 2>/dev/null
```

**Swift:**
```bash
which swiftlint 2>/dev/null
ls .swiftlint.yml 2>/dev/null
```

**Scala:**
```bash
cat build.sbt 2>/dev/null | grep -E "scalafmt|scalafix|wartremover"
ls .scalafmt.conf .scalafix.conf 2>/dev/null
```

### Build Toolchain Profile:
```
Build Toolchain Profile
───────────────────────
Language:        [detected language]
Type-check cmd:  tsc --noEmit / mypy . / go vet ./... / cargo check /
                 mvn compile -q / ./gradlew compileKotlin / dotnet build /
                 bundle exec ruby -c / php -l / flutter analyze / swift build / sbt compile
Lint cmd:        eslint / ruff / golangci-lint / cargo clippy /
                 mvn checkstyle:check / ./gradlew detekt / dotnet format --verify-no-changes /
                 rubocop / phpstan analyse / flutter analyze / swiftlint / sbt scalafmt
Build cmd:       npm run build / python -m build / go build ./... / cargo build /
                 mvn package -DskipTests / ./gradlew build -x test / dotnet publish /
                 bundle exec rake / composer install / flutter build / swift build / sbt package
Bundle tool:     vite / webpack / esbuild / rollup / N/A
Bundle baseline: [size in KB from last build, or "no baseline yet"]
Has config:      YES / NO  ([tsconfig / mypy.ini / checkstyle.xml / .rubocop.yml / phpstan.neon / etc.])
```

| Result | Action |
|--------|--------|
| Type-check found | Run before each wave commit — type errors BLOCK the commit |
| Lint found | Run before each wave commit — warnings non-blocking, errors BLOCK |
| Build cmd found | Run before ship — compile failure BLOCKS |
| None found | Warn once: "⚠ No build toolchain detected. Type safety and lint checks skipped." Log to `security/DEBT.md`. |

**Language-specific test run commands (referenced in wave execution):**
```bash
# JS/TS
npm test / npx jest / npx vitest run

# Python
pytest / python -m pytest

# Java (Maven)
./mvnw test  OR  mvn test

# Java/Kotlin (Gradle)
./gradlew test

# C# / .NET
dotnet test

# Ruby
bundle exec rspec  OR  bundle exec rake test

# PHP
./vendor/bin/phpunit  OR  ./vendor/bin/pest

# Dart / Flutter
flutter test  OR  dart test

# Swift
swift test  OR  xcodebuild test -scheme [scheme] -destination 'platform=iOS Simulator,...'

# Scala
sbt test

# Go
go test ./...

# Rust
cargo test
```

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

### 3a — Build Context Packets + Overlap Detection

**Before spawning Builders, check for file overlap within this wave:**

List all files each task in this wave will touch (from the File Ownership Map in PLAN.md). If two tasks in the same wave list the same file:

```
⚠ File overlap detected in Wave [N]:
  src/auth/service.ts is claimed by:
    Task "Implement login" (modifying)
    Task "Add refresh token" (modifying)

Auto-serialization applied: these two tasks will run sequentially, not in parallel.
Order: "Implement login" → "Add refresh token" (alphabetical by task name unless a SOFT dependency suggests otherwise)
```

Overlapping tasks are **serialized automatically** — the second task reads the output of the first. No manual intervention needed unless the tasks have conflicting Before→After contracts (in which case, escalate to the user).

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
Serialized after: [task name, or "none — runs in parallel"]
```

The "closest existing example" is the most important field. Builders replicate proven patterns — they don't invent new ones unless the task explicitly requires it. Find the nearest analog in the codebase.

### 3b — Parallel Build (with serialization where overlap detected)

**Git worktree isolation — check Git Permission Guard first:**

**If `git.permission: approved`:**
```bash
git worktree add .buildflow/worktrees/wave-[N]-task-[name] -b buildflow/wave-[N]-[name]
```
Each Builder works in its own worktree. After all complete:
```bash
git merge buildflow/wave-[N]-[task-A] --no-ff -m "merge: wave [N] task [A]"
git merge buildflow/wave-[N]-[task-B] --no-ff -m "merge: wave [N] task [B]"
git worktree remove .buildflow/worktrees/wave-[N]-task-[name]
git branch -d buildflow/wave-[N]-[name]
```
Merge conflicts = undeclared ownership violation → log as SCOPE deviation, update ownership map.

**If `git.permission` is not `approved` (no-git mode):**
Skip worktree isolation entirely. Use Step 3a serialization as the sole safety net — overlapping tasks run sequentially, not in parallel. Note in wave report: "Worktree isolation skipped (no git) — serial execution applied to overlapping tasks."

Spawn one Builder per task. Each Builder receives ONLY its context packet.

Each Builder:
- Writes code that satisfies the Before → After contract
- Follows the closest existing example's structure
- Covers the referenced ACs
- **Writes tests as part of the same task — not after, not later, not optional**
- Adds `LEARN:` comment only for patterns not present elsewhere in the codebase

**If the task is tagged `[TF]` (failing-test-first) in PLAN.md — mandatory protocol:**
1. Write the test(s) for the linked ACs first
2. Run them: `npm test -- --testPathPattern=[test file]` (or equivalent)
3. Confirm they FAIL — a meaningful assertion failure, not a syntax/import error
   - If they pass immediately: the test is wrong (too permissive) — fix the test before proceeding
   - If they error on import: the stub/scaffold is missing — create the empty stub first, then re-run
4. Write the implementation
5. Run the tests again — confirm they now PASS
6. Report: "TF verified: [test name] failed before, passes after"

This proof-of-failure step is non-negotiable for `[TF]` tasks. Skip it only for SCAFFOLD/CONFIG/MIGRATION task types.

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

**3. Test Coverage Check**
```bash
# JS/TS — Jest/Vitest
npx jest --coverage --coverageReporters=json-summary --passWithNoTests 2>/dev/null
npx vitest run --coverage 2>/dev/null
# Python
pytest --cov=src --cov-report=term-missing 2>/dev/null
# Go
go test ./... -cover 2>/dev/null | grep "coverage:"
# Rust
cargo tarpaulin --out Stdout 2>/dev/null
```

Extract total coverage % and compare against `last_ship_coverage` in `light.md`:

| Delta | Action |
|-------|--------|
| First run — no baseline | Record as baseline, non-blocking |
| Coverage dropped 0–5% | `⚠ COVERAGE WARN: [N]% → [M]% (-[X]%). Non-blocking.` |
| Coverage dropped 5–15% | Prompt user (see below) |
| Coverage dropped >15% | Prompt user (see below) |

**Coverage drop prompt (5%+ drop):**
```
Coverage Report  Wave [N]
─────────────────────────
Previous:  [N]%
Current:   [M]%
Drop:      -[X]%  [MODERATE / SIGNIFICANT]

Uncovered files added this wave:
  src/auth/helper.ts  — 0% covered
  src/utils/crypto.ts — 40% covered

Options:
  [F] Fix now   — pause and add tests before committing this wave
  [P] Proceed   — commit this wave as-is, log coverage debt
  [S] Skip coverage check for this wave only
```

Wait for user response:
- **F (Fix):** pause build, list uncovered functions per file, help user write tests, re-run coverage, then continue
- **P (Proceed):** commit wave, log to `security/DEBT.md`: "Wave [N] coverage drop: [N]% → [M]% — [files] uncovered"
- **S (Skip):** skip for this wave only, do NOT log as debt

Record current coverage in Build Telemetry Report regardless of choice.

**4. Bundle Size Check (JS/TS only, if build cmd exists)**
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
Coverage:     ⚠ WARN  (74% → 71%, -3% — user chose: proceed)
Bundle size:  ✓ PASS  (142 KB → 144 KB, +1.4%)
```

Only proceed to Step 3e after type-check is PASS, lint errors (not warnings) are fixed, and the user has responded to any coverage prompt.

### 3e — Targeted Test + Fix Loop

Run the smallest meaningful test set first — not the whole application.

**Build the targeted test set from this wave's touched files:**
1. Start with every source file created or modified by this wave.
2. Add direct test files for those sources using the Test Framework Profile conventions.
3. Add dependency-neighborhood tests:
   - tests for files imported by the touched files when behavior relies on them
   - tests for files that import the touched files (dependents/callers)
   - contract/API tests for changed exported functions, routes, schemas, or components
4. If no direct tests exist, run the nearest package/module test command and clearly say why.

**Examples:**
```bash
# JS/TS
npx vitest run src/auth/auth.service.test.ts src/auth/__tests__/routes.test.ts
npx jest src/auth/auth.service.test.ts

# Python
pytest tests/auth/test_service.py tests/api/test_auth_routes.py

# Go
go test ./internal/auth ./internal/api

# Rust
cargo test auth::
```

Do not run `npm test`, `pytest`, `go test ./...`, `cargo test`, or the full app yet unless the user approves it.

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

**After targeted tests pass, ask before broader verification:**

```
Targeted tests passed for Wave [N].

Would you like me to run broader verification now?
  [I] Impacted area tests — touched files plus nearby module/package tests
  [A] App smoke check     — start app/dev server and verify core flow
  [B] Both                — impacted area tests, then app smoke check
  [S] Skip for now        — continue to next wave; full gates still run at /buildflow-ship
```

Wait for the user's choice.

- **I:** run the broader touched-file impact set only. This may include nearby package/module tests, but should still avoid whole-repo test commands unless the touched area cannot be isolated.
- **A:** if frontend or runtime behavior changed, start the app/dev server and verify the relevant core flow; otherwise explain why app smoke is unnecessary.
- **B:** run impacted area tests, then app smoke check.
- **S:** record in wave report: "Broader verification skipped by user after targeted tests passed."

If the user does not answer, do not silently run whole-repo tests or the application.

### 3f — Schema Drift Check (runs after tests, before commit — if schema files exist)

If this wave touched any schema-defining file (`*.prisma`, `*.entity.ts`, `models.py`, `schema.sql`, migration files):

1. Check if a new migration was created alongside the schema change
   - Schema changed but no migration added → BLOCK commit: "Add migration for schema change before committing"
2. Check if the migration can be applied cleanly (dry-run where possible):
   ```bash
   npx prisma migrate dev --create-only 2>/dev/null   # Prisma dry-run
   python manage.py makemigrations --check 2>/dev/null  # Django check
   ```
3. If new migration added: note it in the wave commit body

If no schema files were touched: skip this step.

### 3g — Deviation Handling

During build, a Builder may discover that the plan's Before → After contract cannot be satisfied as written — due to a missing dependency, a codebase constraint discovered during implementation, or a spec ambiguity.

**This is a deviation. It must be handled explicitly — never silently worked around.**

When a Builder hits a deviation:
1. Stop immediately — do not proceed with a workaround
2. Record the deviation:
   ```
   DEVIATION  Wave [N]  Task: [name]
   ─────────────────────────────────
   Expected (from plan): [what the plan said]
   Actual (discovered):  [what is actually true]
   Blocker:              [why the plan cannot be followed as written]
   Impact:               [which ACs are at risk]
   Options:
     A) [approach A — describe tradeoff]
     B) [approach B — describe tradeoff]
     C) Defer this task to a new wave after resolving [dependency]
   ```
3. Surface the deviation to the user — do not choose an option unilaterally unless it is a SOFT deviation (see below)

**Deviation severity:**
| Type | Definition | Action |
|------|-----------|--------|
| HARD | Cannot satisfy the AC with any reasonable approach | Stop wave, escalate immediately |
| SOFT | Can satisfy the AC via a different approach with no downstream impact | Choose simplest approach, log deviation, continue |
| SCOPE | The correct fix requires touching files outside this task's ownership | Stop, propose plan amendment |

**After resolution:** log the deviation and chosen option in `phases/[N]/PLAN.md` under a `## Deviations` section:
```markdown
## Deviations
- Wave 2, Task "Create auth service": JWT library API changed in v9 — used `jose` instead of `jsonwebtoken` (SOFT deviation, no AC impact)
```

### 3h — Wave Commit

**If `git.permission: approved`:**
```bash
git add [changed files — explicit list, not -A]
git commit -m "[type](scope): [what changed]

[Body: why this change, which ACs it satisfies]
[AC refs: AC-001, AC-003]
[Wave: N of M]"
```
Commit types: `feat` / `fix` / `test` / `refactor` / `chore`

**If the commit or push fails (git error):**
```
⚠ Git operation failed
────────────────────────
Error: [exact git error message]
Wave [N] code changes are complete and tested, but could not be committed/pushed.

Options:
  [R] Retry     — try the git operation again (use if transient network/auth issue)
  [P] Park      — save changes as a file snapshot, mark wave as "parked", continue working
  [W] Wait      — pause here until you resolve the git issue manually, then re-run /buildflow-build
```

**If user chooses Park:**
1. Take file snapshot into `.buildflow/snapshots/phase-[N]-wave-[N]-parked/`
2. Mark wave in `PLAN.md`:
   ```markdown
   ### Wave 2 — Auth Services  ⚠ PARKED [2024-01-15 14:32]
   Code complete and tested. Git commit failed — changes saved to snapshot.
   Snapshot: .buildflow/snapshots/phase-1-wave-2-parked/
   Files parked: [list]
   ```
3. Update `parked_changes` in `light.md`:
   ```yaml
   parked_changes:
     - file: src/auth/service.ts
       phase: 1
       wave: 2
       snapshot: .buildflow/snapshots/phase-1-wave-2-parked/
       reason: "git commit failed"
       parked_at: [ISO datetime]
   ```
4. Continue to next wave — the code is safe, only the git record is missing.

**If user chooses Wait:** pause build. Resume with `/buildflow-build wave-[N]` once git is resolved.

**If `git.permission` is not `approved` (no-git mode):**
1. Take a file snapshot — copy all files modified this wave into `.buildflow/snapshots/phase-[N]-wave-[N]-complete/`:
   ```
   .buildflow/snapshots/
   └── phase-1-wave-2-complete/
       ├── src/auth/service.ts
       ├── src/auth/service.test.ts
       └── src/routes/auth.ts
   ```
2. Mark the wave complete in `phases/[N]/PLAN.md` under the wave header:
   ```markdown
   ### Wave 2 — Auth Services  ✓ COMPLETE [2024-01-15 14:32]
   Snapshot: .buildflow/snapshots/phase-1-wave-2-complete/
   ```
3. Record in `state.md`:
   ```yaml
   last_wave_completed: 2
   last_wave_date: [today]
   phase_progress: wave 2 of 4 complete
   ```

In both modes: mark wave complete in `phases/[N]/PLAN.md` and proceed to next wave.

---

### 3i — Codebase Map Drift Note (non-blocking)

After the wave's file changes are known, classify structural changes against `.buildflow/codebase/STRUCTURE.md` if it exists:

| Category | Trigger |
|----------|---------|
| `new_dir` | new directory not represented in `STRUCTURE.md` |
| `route` | new route/API/page/screen file |
| `migration` | schema/migration file |
| `barrel` | new `index.ts/js` public export |
| `dependency` | package/lock/build config changed |
| `integration` | API client/webhook/auth/env contract changed |
| `test` | test framework/config/fixture layout changed |
| `copy_locale` | locale catalog, label/copy catalog, or localized docs changed |

If drift exists, do not fail the wave. Add a short note to the wave report:
```
Codebase map drift detected: [categories] at [paths]
Suggested refresh: /buildflow-onboard --paths [affected top-level paths]
```

If 3 or more drift elements exist, show the note to the user after the wave completes. Do not auto-run onboarding unless the user asks.

---

## Step 4: Final Integration Check
After all waves:
- Run targeted phase-level tests for all files touched across all waves and their dependency neighborhoods.
- Ask the user whether to run impacted area tests and/or an application smoke check before leaving build.
- Check imports across wave boundaries (no dangling references)
- If impacted area tests are approved: include touched files, nearby module/package tests, and relevant prior-phase tests for the same affected area.
- If impacted area tests are skipped: record that final whole-repo regression remains deferred to `/buildflow-ship`.
- Cross-phase regression check: when impacted area tests include prior-phase tests, compare passing count for that affected area against `last_ship_test_count` or the nearest available baseline. If lower, a prior-phase behavior was broken — flag before shipping.

```
Integration Check
─────────────────
All waves:          ✓ PASS
Targeted tests:     ✓ PASS  ([N] files, [N] dependency-neighborhood tests)
AC coverage:        [N/N ACs verified]
Impacted tests:     RUN / SKIPPED BY USER
App smoke:          RUN / SKIPPED / NOT APPLICABLE
Cross-phase tests:  ✓ PASS / DEFERRED TO SHIP
Dangling imports:   NONE
```

If approved impacted-area or app-smoke verification finds regressions: fix immediately — do not defer to `/buildflow-ship`.

---

## Step 5: Update Memory (lean — prune old build fields)
```yaml
last_build_date: [today]
plan_status: built
test_status: passing
waves_completed: [N]
passing_test_count: [N]      ← baseline for cross-phase regression check at ship time
last_build_coverage: [N]%    ← baseline for coverage drop detection
last_build_tokens: ~[N]K     ← actual token cost of this build run
```
Remove from `light.md`: per-task details from previous builds.

**Token cost report (print at end of every build):**

Measure actual cost:
1. Sum character counts of all Context Packet files loaded across all waves ÷ 4 = input tokens
2. Estimate output from code generated + test output + fix loop iterations ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's total

```
Token Cost — /buildflow-build
──────────────────────────────
Waves: [N]  Tasks: [N]  ACs satisfied: [N/N]
Context loaded:    ~[N]K tokens   ([N] context packets × [N] waves + [N] fix iterations)
Output generated:  ~[N]K tokens   ([N] files written, [N] test runs)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

---

## Guided Next Step

After all waves complete:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  All waves complete — verify every AC is satisfied before shipping
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If a wave failed and stopped: `→ Next: /buildflow-debug` (root-cause before retrying).
If all waves complete but tests are borderline: `→ Next: /buildflow-check` (check will surface what needs fixing).

After each individual wave (not final): print only the session token line — no next step until all waves are done.

## Token Budget: ~50K per wave (context packets keep individual Builder costs low)
