---
name: buildflow-build-detect
description: Module — test framework detection, build toolchain detection, style fingerprint. Loaded by /buildflow-build on first wave.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Build Detection Module

Loaded by `/buildflow-build` before the first wave. Writes profiles to `.buildflow/epics/[epic]/BUILD_SESSION.md`, then returns.

---

## Fast Path (onboarded project — runs in most cases)

**Check in this order:**

**1. BUILD_SESSION.md cache hit** — if `.buildflow/epics/[epic]/BUILD_SESSION.md` exists and `spec_version` matches current `ACCEPTANCE.md` version: load profiles from it directly. Skip everything below. Return immediately.

**2. Knowledge files exist (onboard already ran)** — if ALL three exist:
- `.buildflow/codebase/TESTING.md`
- `.buildflow/codebase/CODEBASE.md`
- `.buildflow/codebase/PATTERNS.md`

Extract profiles directly from those files — no shell detection needed:

- **Test Framework Profile** → read from `TESTING.md`: framework name, config file, test location, naming convention, mocking library, coverage tool, existing test count
- **Build Toolchain Profile** → read from `CODEBASE.md`: language, type-check command, lint command, build command, bundle tool
- **Style Fingerprint** → read the top 5 conventions from `PATTERNS.md`
- **Hotspot Files** → read from `RISKS.md`: high-risk files relevant to this epic's wave file lists
- **Locale Flags** → read from `intel.json`: `locale_support`, `local_support`, `catalog_files`

Write `BUILD_SESSION.md` with the extracted profiles (see format at bottom of this file). Return immediately — do not run any shell commands below.

**3. Shell detection (greenfield or pre-onboard)** — only if knowledge files are missing or incomplete. Continue to Step 2 below.

---

## Shell Command Note
All shell commands below use Bash/POSIX syntax. On Windows, prefer PowerShell equivalents unless Bash is available. Adjust `grep` → `Select-String`, `find` → `Get-ChildItem`, `cat` → `Get-Content`, `2>/dev/null` → `2>$null`.

---

## Step 2: Detect Test Framework (shell fallback — only if fast path failed)

Before writing a single test line, identify what testing infrastructure exists.

### Detection checklist:

**JavaScript / TypeScript:**
```bash
cat package.json | grep -E "jest|vitest|mocha|jasmine|@testing-library|supertest|cypress|playwright"
ls jest.config.* vitest.config.* .mocharc.* 2>/dev/null
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
cat pom.xml 2>/dev/null | grep -E "junit|testng|mockito|assertj"
find . -path "*/src/test/*" -name "*Test.java" -o -name "*Spec.kt" | head -5
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
| No framework, existing project with no tests | Warn: "⚠ No test framework found. Proceeding without tests — recommend adding [framework] before shipping." Log to `epics/[epic]/DEBT.md`: "No test framework — zero coverage." |

### Capture test profile:
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

---

## Step 2b: Detect Build Toolchain (shell fallback — only if fast path failed)

Before the first wave, identify what static analysis and build tools are available.

**JavaScript / TypeScript:**
```bash
cat package.json | python3 -c "import sys,json; s=json.load(sys.stdin).get('scripts',{}); [print(k,':',v) for k,v in s.items() if any(x in k for x in ['build','lint','type','check','tsc'])]"
ls tsconfig.json tsconfig.*.json 2>/dev/null
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
ls pom.xml 2>/dev/null && cat pom.xml | grep -E "checkstyle|spotbugs|pmd|errorprone|detekt|ktlint"
ls build.gradle build.gradle.kts 2>/dev/null && cat build.gradle.kts build.gradle 2>/dev/null | grep -E "checkstyle|spotbugs|detekt|ktlint"
ls mvnw gradlew 2>/dev/null
```

**C# / .NET:**
```bash
find . -name "*.csproj" | xargs grep -l "StyleCop\|SonarAnalyzer\|Roslynator" 2>/dev/null | head -3
ls .editorconfig global.json 2>/dev/null
```

**Ruby / PHP / Dart / Swift / Scala:**
```bash
cat Gemfile 2>/dev/null | grep -E "rubocop|brakeman|reek"
cat composer.json 2>/dev/null | grep -E "phpstan|psalm|php-cs-fixer"
cat analysis_options.yaml 2>/dev/null | head -10
which swiftlint 2>/dev/null
cat build.sbt 2>/dev/null | grep -E "scalafmt|scalafix|wartremover"
```

### Build Toolchain Profile:
```
Build Toolchain Profile
───────────────────────
Language:        [detected language]
Type-check cmd:  tsc --noEmit / mypy . / go vet ./... / cargo check / mvn compile -q / dotnet build / flutter analyze / swift build / sbt compile
Lint cmd:        eslint / ruff / golangci-lint / cargo clippy / ./gradlew detekt / dotnet format / rubocop / phpstan analyse / swiftlint / sbt scalafmt
Build cmd:       npm run build / python -m build / go build ./... / cargo build / mvn package -DskipTests / dotnet publish / flutter build / swift build / sbt package
Bundle tool:     vite / webpack / esbuild / rollup / N/A
Bundle baseline: [size in KB from last build, or "no baseline yet"]
Has config:      YES / NO
```

| Result | Action |
|--------|--------|
| Type-check found | Run before each wave commit — type errors BLOCK the commit |
| Lint found | Run before each wave commit — errors BLOCK, warnings non-blocking |
| Build cmd found | Run before ship — compile failure BLOCKS |
| None found | Warn once: "⚠ No build toolchain detected." Log to `epics/[epic]/DEBT.md`. |

**Test command shapes (scoped — not whole-suite):**
```bash
npx jest [specific-test-file] / npx vitest run [specific-test-file]   # JS/TS
pytest [specific-test-file]                                             # Python
./mvnw test -Dtest=SpecificTest                                         # Java Maven
./gradlew test --tests "*.SpecificTest"                                 # Gradle
dotnet test --filter "FullyQualifiedName~SpecificTest"                  # C#
bundle exec rspec spec/path/to/specific_spec.rb                         # Ruby
flutter test test/specific_test.dart                                    # Dart
swift test --filter SpecificTest                                        # Swift
sbt "testOnly *SpecificSpec"                                            # Scala
go test ./[touched-package]                                             # Go
cargo test specific_test_name                                           # Rust
```

**Test command resolution rules:**
- Do not prepend `CI=true` unless the project already uses it.
- Do not blindly append a positional file path to complex test commands.
- Resolve the nearest runnable project root before testing.
- Prefer the repo's documented targeted command from `TESTING.md`.
- If the resolved command would run the entire suite, stop and ask the user.

---

## Step 3: Establish Style Fingerprint (shell fallback — only if fast path failed)

If `PATTERNS.md` exists: extract the 5 most important conventions and hold them in scope.
If not: read 2 existing source files and infer:
- Naming convention
- Import order
- Error handling pattern
- Async style
- Test naming pattern (from test profile above)

This fingerprint applies to every Builder in every wave.

---

## Write BUILD_SESSION.md

Use the **Write tool** to save the detected profiles to `.buildflow/epics/[epic]/BUILD_SESSION.md`:

```markdown
# Build Session Cache
**Epic:** [epic-slug]
**Spec version:** [spec_version]
**Recorded:** [ISO datetime]

## Test Framework Profile
[paste Test Framework Profile block]

## Build Toolchain Profile
[paste Build Toolchain Profile block]

## Style Fingerprint
[5 key conventions]

## Hotspot Files (from RISKS.md — relevant to this epic's touched paths)
[list of high-risk files relevant to current epic's wave files — or NONE]

## Locale Flags (from intel.json)
locale_support: [true/false]
local_support: [true/false]
catalog_files: [list or NONE]
```

**Subsequent waves** load only `BUILD_SESSION.md` — no re-reading of TESTING.md, CODEBASE.md, PATTERNS.md, RISKS.md, or intel.json needed.

Return to `/buildflow-build` — the multi-agent protocol and wave execution loop continue from here.
