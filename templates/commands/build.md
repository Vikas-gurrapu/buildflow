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
- `.buildflow/phases/[N]/VERIFICATION.md`
- `.buildflow/phases/[N]/STATE.md` (if exists - resume wave/status, risks, test strategy)
- `.buildflow/codebase/PATTERNS.md` (if exists)
- `.buildflow/codebase/STRUCTURE.md` (if exists — only relevant sections for touched paths)
- `.buildflow/codebase/TESTING.md` (if exists — targeted test command and test layout)
- `.buildflow/codebase/CONCERNS.md` (if exists — only concerns relevant to touched paths)
- `.buildflow/memory/light.md` (app_name, framework, style_fingerprint only)
- `.buildflow/you/preferences.md` (git.permission only)

Do NOT load: full specs, full codebase, research, retros, old phases.

---

## Phase State Resume
Read `.buildflow/core/state.md`, `.buildflow/memory/light.md`, `.buildflow/phases/[N]/PLAN.md`, `.buildflow/phases/[N]/VERIFICATION.md`, and `.buildflow/phases/[N]/STATE.md` if it exists.

Use `STATE.md` to resume the active wave and avoid asking the user where to continue. If `STATE.md`, `state.md`, and `PLAN.md` disagree, trust `PLAN.md` wave completion markers first, then `state.md`, then update `STATE.md` to match before building.

Before exiting after each wave or full build, update `.buildflow/phases/[N]/STATE.md` with:
- Current State: `Status: build_in_progress` with `Wave: [current]/[total]`, or `Status: built` when all waves complete
- Decisions: deviations, user choices, implementation decisions, and any approved skips
- Files That Matter: files touched this wave/all waves, snapshots, and drift paths
- Next Command: next `/buildflow-build wave-[N+1]` or `/buildflow-check` when all waves are complete
- Risks / Open Questions: drift, parked changes, skipped tests, unresolved concerns
- Test Strategy: focused tests run for touched files, dependency-neighborhood tests, impacted-area/app-smoke user decision, and ship regression status

---

## Git Permission Guard (mandatory)

Before any git command, read `.buildflow/you/preferences.md`.

- If `git.permission` is `approved`: git operations are allowed.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. Treat this session as no-git mode, even if `.git/` exists or `light.md` says `git_available: true`.
- If `preferences.md` is missing or `git.permission` is absent: ask the user before running any git command.

This guard applies to commits, tags, stash, worktrees, branches, merges, and resets.

---

## Folder Access Guard (mandatory before any file read/write outside .buildflow/)

Before reading or writing any source file, apply the installed **Folder Access Guard**:
- Check `path_permissions.[folder]` in `.buildflow/you/preferences.md`
- `approved` → proceed; `denied` → skip + warn; not listed → show [1]/[2]/[3] prompt once per folder
- Batch all new folders needed for this wave into a single prompt rather than asking per-file

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

## Step 1c: Scope-Reduction Detection

Before building, verify the plan covers every AC in `acceptance.md`. This catches silent requirement drops introduced during planning.

**Extract AC IDs from acceptance.md:**
```bash
grep -oE "AC-NF-[0-9]+" .buildflow/specs/acceptance.md | sort -u
grep -oE "AC-[0-9]+" .buildflow/specs/acceptance.md | grep -v "AC-NF" | sort -u
```

**Extract AC IDs referenced in PLAN.md tasks:**
```bash
grep -oE "AC-NF-[0-9]+" .buildflow/phases/[N]/PLAN.md | sort -u
grep -oE "AC-[0-9]+" .buildflow/phases/[N]/PLAN.md | grep -v "AC-NF" | sort -u
```

**Find ACs in acceptance.md with no reference in any PLAN.md task** — these are "dropped" requirements.

```
Scope-Reduction Check
──────────────────────
ACs in acceptance.md:  [N]
ACs referenced in plan: [M]
Dropped (no plan task): [list or NONE]
```

**Response by severity:**

| Dropped | Response |
|---------|----------|
| 0 | Silent — proceed. |
| 1–2 (≤ 20% of total) | WARN — show options below |
| 3+ or > 20% of total | BLOCK — plan does not cover this phase's requirements |

**Warning options (1–2 dropped):**
```
⚠ Scope-Reduction Warning
───────────────────────────
[N] ACs in acceptance.md have no plan task:
  AC-004 — "Password reset via email"
  AC-007 — "Rate limiting on auth endpoints"

Were these intentionally excluded or accidentally dropped?

  [D] Deferred — mark as DEFERRED in VERIFICATION.md, log to DEBT.md, proceed
  [A] Accidental — abort; re-run /buildflow-plan to include all ACs
  [S] Scope split — these belong in a future phase; add a SCOPE note to PLAN.md and proceed
```

**Block (3+ or > 20% dropped):**
```
🔴 BUILD BLOCKED — Scope Reduction Detected

[N] of [total] ACs ([%]) have no plan task. This phase cannot fulfill all requirements.
Dropped: AC-003, AC-004, AC-007...

Run /buildflow-plan to regenerate the plan with full AC coverage.
Override (logs to DEBT.md): /buildflow-build --accept-scope-reduction
```

If all ACs are covered: proceed silently.

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

**Language-specific test command shapes (scope before use in wave execution):**
```bash
# JS/TS
npx jest [specific-test-file] / npx vitest run [specific-test-file]

# Python
pytest [specific-test-file] / python -m pytest [specific-test-file]

# Java (Maven)
./mvnw test -Dtest=SpecificTest  OR  mvn test -Dtest=SpecificTest

# Java/Kotlin (Gradle)
./gradlew test --tests "*.SpecificTest"

# C# / .NET
dotnet test --filter "FullyQualifiedName~SpecificTest"

# Ruby
bundle exec rspec spec/path/to/specific_spec.rb

# PHP
./vendor/bin/phpunit  OR  ./vendor/bin/pest

# Dart / Flutter
flutter test test/specific_test.dart  OR  dart test test/specific_test.dart

# Swift
swift test --filter SpecificTest  OR  xcodebuild test -only-testing:[target]/[test]

# Scala
sbt "testOnly *SpecificSpec"

# Go
go test ./[touched-package]

# Rust
cargo test specific_test_name
```

**Test command resolution rules (prevents path/filter mistakes):**
- Do not prepend or force `CI=true` unless the project's existing script already uses it or the user explicitly asks for CI mode.
- Do not blindly append a positional file path to an existing complex test command. Some older runners or CI wrappers treat positional paths as filters after flags and run the wrong scope.
- Resolve the nearest runnable project root before testing. For monorepos/submodules, run from the nearest folder containing the relevant `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `.csproj`, `pom.xml`, `build.gradle`, or equivalent.
- Prefer the repo's documented targeted command from `.buildflow/codebase/TESTING.md`. If absent, infer the safest scoped command from existing test scripts and nearby test files.
- If a framework supports both file paths and named filters, choose the form already used by the project. Examples: Jest/Vitest often accept paths; Gradle/dotnet usually prefer `--tests` / `--filter`; Go often prefers package + `-run`; Rust often prefers test name filters.
- If the resolved command would run the entire app or all packages, stop and ask the user before running it.

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
Locale context: [INCLUDE intel.json locale_support section if task type is copy_locale OR task description references label/copy/i18n keys — otherwise OMIT]
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
- **Writes or updates focused tests after the code change, within the same task — not later, not optional**
- Adds `LEARN:` comment only for patterns not present elsewhere in the codebase

### 3b-post-merge - Post-Merge Gate (after worktrees merge or serialized tasks complete)

After all worktrees in a wave are merged back, or after serialized no-git tasks complete, run one post-merge gate to catch conflicts that individual Builders may miss.

1. Resolve the smallest build command that validates the merged touched area.
   - Prefer package/module-level build/type-check commands for touched workspaces.
   - Use a 5-minute timeout.
   - If only a whole-app build command exists, ask before running it.
2. Resolve the smallest post-merge test command for the merged touched area.
   - Use Test Command Resolution Rules above.
   - Prefer touched package/module tests and direct dependency-neighborhood tests.
   - Use a 5-minute timeout.
   - If the resolved command would run the full suite, ask before running it.
3. Run each command once. Do not automatically rerun failures.

If the post-merge build or test gate fails:
```
Post-merge gate failed after Wave [N].
Command: [exact command]
Likely cause: [merge conflict side effect / command resolution issue / real code failure / timeout]

Options:
1. Rerun with corrected command - [show safer command]
2. Fix now - inspect [files/functions likely responsible]
3. Defer - record as wave risk and continue only if no AC is blocked
```
Proceed based on the user's choice. If an AC is blocked, do not continue to the next wave until fixed or the plan is amended.

**Post-change focused testing protocol:**

**Pure style/config/data fast path:** If this task ONLY touches `.css`, `.scss`, `.sass`, `.less`, `.styl`, locale/label catalogs (`.json` label catalogs, `.properties`, `strings.xml`, `.arb`, `.po`), or static assets — skip focused unit tests unless a relevant snapshot/catalog test already exists.

1. Write the implementation first
2. Write or update tests for the linked ACs and changed behavior
3. Run **only the new or changed test file(s)** — not the full suite:
   ```bash
   npx jest [specific-test-file] --no-coverage   # JS/TS
   npx vitest run [specific-test-file]
   pytest [specific-test-file] -v                # Python
   go test ./[package]/... -run TestFunctionName # Go
   cargo test specific_test_name                 # Rust
   ./mvnw test -Dtest=SpecificTest -q            # Java/Maven
   ./gradlew test --tests "*.SpecificTest"       # Gradle
   dotnet test --filter "FullyQualifiedName~X"   # C#
   bundle exec rspec [specific_spec]             # Ruby
   ```
4. Confirm they PASS
5. Report: "Focused tests passed: [test files]"
6. Update `.buildflow/phases/[N]/VERIFICATION.md` for the linked ACs:
   - `Status: PASS` when focused evidence satisfies the AC
   - `Status: IN PROGRESS` when implementation exists but broader evidence is still pending
   - Add the exact command to `## Test Runs`
   - Put file/function evidence in `Test/Evidence`

If the focused test command fails, do not enter a rerun loop. Diagnose whether the failure is:
- an invocation/path problem (wrong cwd, submodule root, unsupported positional path, CI wrapper, bad filter)
- a real implementation/test failure

Then ask before rerunning:
```
Focused test failed for [task].
Likely cause: [command issue / code issue / unclear]

Options:
1. Rerun with corrected command — [show command]
2. Fix now — [brief file/function area to inspect]
3. Defer — record as build risk and continue only if this task is not blocking its AC
```
Proceed based on the user's choice. Never rerun automatically after a failed task-level test.
If the user chooses defer or the AC remains blocked, update `VERIFICATION.md` with `Status: DEFERRED` or `BLOCKED`, the failing command, and the next recommended fix location.

Do not write or run tests before implementation. BuildFlow verifies behavior after code changes with focused tests first, then broader checks later.

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

### 3b-locale — Locale Catalog Sync (runs after Builder, before Reviewer)

**Triggered when any of these is true:**
- Task description or ACs reference label, copy, text, or i18n key additions/changes
- Task type in PLAN.md is `copy_locale`
- Builder output added new i18n key references in source code (`t('...')`, `getString(R.string....)`, `__('...')`, `NSLocalizedString(...)`, `I18n.t('...')`)

**If NOT triggered:** skip this step entirely.

**Action — sync key values to ALL catalog files:**

1. Read `intel.json → locale_support`:
   - `catalog_files[]` — all locale catalog paths
   - `label_catalogs[]` — static label/copy JSON paths
   - `supported_locales[]` — all locale codes
   - `catalog_type` — json / properties / xml / arb / strings / po

2. Identify every new/changed/removed key from the Builder's source file output this task.

3. For each key:

   **New key:**
   - Primary locale catalog: add with the real value from the task AC or description
   - All other locale catalogs: add with `[TRANSLATE: <primary-value>]` placeholder
   - Static label catalogs (`label_catalogs[]`): add with real value (no locale variants)

   **Changed value (same key, updated text):**
   - Primary locale catalog: update the value
   - All other locale catalogs: update to `[TRANSLATE: <new-primary-value>]` unless the task explicitly provides translated values

   **Removed key:**
   - Grep ALL source files to verify no remaining references before removing
   - Remove from ALL catalog files

4. Write format per catalog type:

   | Type | Format |
   |------|--------|
   | JSON | `"key": "value"` — match existing nesting structure |
   | Properties | `key=value` — match existing line style |
   | XML (`strings.xml`) | `<string name="key">value</string>` inside `<resources>` |
   | ARB (Flutter) | `"key": "value"` + `"@key": {}` metadata if others have it |
   | PO | `msgid "key"\nmsgstr "value"` block |
   | `.strings` (iOS) | `"key" = "value";` |

5. Use the **Write tool** to update each catalog file. Do not output content as text — write to disk.

6. If `catalog_files[]` is empty in intel.json but locale code was detected: grep for catalog files now. If still not found: warn "⚠ Locale catalogs not located — run `/buildflow-onboard --update` to refresh intel.json."

7. Add to Builder report:
   ```
   Locale Catalog Sync:
     Keys added/changed: [N]
     Catalogs updated: src/locales/en.json, src/locales/fr.json (+2 more)
     [TRANSLATE] placeholders remaining: [N]
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

**3. Focused Coverage Check**

Do not run whole-repo coverage during `/buildflow-build`. Coverage checks during build must be scoped to files touched in this wave or skipped with a note. Whole-repo coverage belongs to `/buildflow-ship` unless the user explicitly approves it.
```bash
# JS/TS — Jest/Vitest
npx jest [specific-test-file] --coverage --coverageReporters=json-summary --passWithNoTests 2>/dev/null
npx vitest run [specific-test-file] --coverage 2>/dev/null
# Python
pytest [specific-test-file] --cov=[touched-module] --cov-report=term-missing 2>/dev/null
# Go
go test ./[touched-package] -cover 2>/dev/null | grep "coverage:"
# Rust
cargo tarpaulin --out Stdout [touched-test-target] 2>/dev/null
```

If the project's coverage tool cannot scope coverage to touched files/packages, skip coverage during build and record: "Focused coverage skipped - whole-repo coverage deferred to /buildflow-ship."

Extract focused coverage % and compare against `last_ship_coverage` in `light.md`:

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

Do not run `npm test`, bare `pytest`, `go test ./...`, bare `cargo test`, or the full app during a wave. Full-suite approval is requested only once in the final integration prompt below.

**On test failure:**
1. Read the exact error - file, line, message.
2. Trace root cause (not just symptom).
3. Classify the failure:
   - **Command issue:** wrong cwd, submodule root mismatch, unsupported positional path/filter, CI wrapper, timeout
   - **Code/test issue:** changed behavior is broken or the test expectation is wrong
   - **Unclear:** needs user choice before spending more tokens
4. Ask before rerunning:
   ```
   Targeted test failed.
   Command: [exact command]
   Likely cause: [command issue / code issue / unclear]

   Options:
   1. Rerun with corrected command - [show command and cwd]
   2. Fix now - inspect [files/functions likely responsible], then run one focused test
   3. Defer - record as build risk; continue only if no AC is blocked
   ```
5. Proceed based on the user's choice. Never rerun automatically after a failed wave-level test.

Max 3 user-approved fix/rerun attempts. After 3: stop, report what's unresolved, ask how to proceed.

Fix log per attempt:
```
Fix [X]/3  Wave [N]
Error:      [message at file:line]
Root cause: [why it's failing]
Fix:        [exactly what changed]
Result:     PASS / still failing
```

**After targeted tests pass:**
- Do not ask for or run the full app-level test suite here.
- Record the targeted test files/packages that passed in the wave report.
- Proceed to Step 3f.
- Full app-level tests are deferred to the final integration prompt below or /buildflow-ship.

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

Update `.buildflow/phases/[N]/VERIFICATION.md` before moving to the next wave:
- For ACs covered by this wave's completed tasks and passing focused tests: mark `PASS` or `IN PROGRESS` based on evidence strength.
- For failed/deferred tests: mark `FAIL`, `BLOCKED`, or `DEFERRED`.
- Append every targeted/post-merge command to `## Test Runs`.
- Refresh the `## Summary` counts.

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
- Do not run whole-app/full-suite tests automatically.
- Ask the user once whether to run broader checks before leaving build:
  ```
  Targeted phase tests passed. Run broader checks now?
    [1] No - defer full regression to /buildflow-ship (recommended)
    [2] Impacted area only - nearby module/package tests for touched areas
    [3] Application smoke check only - one lightweight app-level sanity check
    [4] Full app-level test suite - explicit approval, may consume more tokens
  ```
- Check imports across wave boundaries (no dangling references)
- If impacted area tests are approved: include touched files, nearby module/package tests, and relevant prior-phase tests for the same affected area.
- If application smoke is approved: run only the smallest meaningful smoke check, not the whole suite.
- If full app-level suite is approved: run it once, report token/time cost clearly, and do not repeat it during build.
- If broader checks are skipped: record that final whole-repo regression remains deferred to `/buildflow-ship`.
- Cross-phase regression check: when impacted area tests include prior-phase tests, compare passing count for that affected area against `last_ship_test_count` or the nearest available baseline. If lower, a prior-phase behavior was broken — flag before shipping.

```
Integration Check
─────────────────
All waves:          ✓ PASS
Targeted tests:     ✓ PASS  ([N] files, [N] dependency-neighborhood tests)
AC coverage:        [N/N ACs verified]
Broader checks:     DEFERRED / IMPACTED AREA / SMOKE / FULL SUITE APPROVED
Impacted tests:     RUN / SKIPPED BY USER / NOT REQUESTED
App smoke:          RUN / SKIPPED / NOT REQUESTED
Full suite:         RUN BY USER APPROVAL / DEFERRED TO SHIP
Cross-phase tests:  PASS / DEFERRED TO SHIP
Dangling imports:   NONE
```

If approved impacted-area or app-smoke verification finds regressions: fix immediately — do not defer to `/buildflow-ship`.

After final integration check, update `.buildflow/phases/[N]/VERIFICATION.md`:
- Mark ACs with sufficient focused/integration evidence as `PASS`.
- Keep ACs needing ship-level regression as `IN PROGRESS` with note `Full regression deferred to /buildflow-ship`.
- Mark any failed evidence as `FAIL` or `BLOCKED`.
- Refresh summary counts and `Last updated`.

---

## Step 5: Update Memory (lean — prune old build fields)
```yaml
last_build_date: [today]
plan_status: built
test_status: focused_passing
waves_completed: [N]
focused_test_count: [N]      ← focused build tests only; full regression baseline is recorded at ship
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

Before printing this block, check session context usage. After a completed wave or all-wave build, recommend clearing the current AI session after saving `STATE.md` when the session is large/noisy or a boundary has been reached; otherwise say it is OK to continue.

After all waves complete:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  All waves complete — verify every AC is satisfied before shipping
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If a wave failed and stopped: `→ Next: /buildflow-debug` (root-cause before retrying).
If all waves complete but tests are borderline: `→ Next: /buildflow-check` (check will surface what needs fixing).

After each individual wave (not final): print only the session token line — no next step until all waves are done.

## Token Budget: ~50K per wave (context packets keep individual Builder costs low)
