---
name: buildflow-onboard
description: Deep codebase analysis — maps modules, patterns, hotspots, features, import graph, and writes all knowledge files to .buildflow/codebase/
allowed-tools: Read, Write, Bash, Glob, Grep
agent: cartographer
---

# /buildflow-onboard

Deep one-time analysis of an existing codebase. Produces 5 knowledge files that every other BuildFlow command references. All other agents load these files rather than re-scanning the codebase.

## When to run
- First time using BuildFlow on an existing project
- After a major refactor or framework migration
- `--update` flag: incremental refresh after significant changes
- `--paths src/auth,packages/ui` flag: scoped remap of specific paths

## Usage
- `/buildflow-onboard` — full analysis + write all knowledge files
- `/buildflow-onboard --update` — refresh changed files only
- `/buildflow-onboard --paths src/auth,packages/ui` — remap specific paths
- `/buildflow-onboard --query locale` — search knowledge files for a term without rewriting

---

## OUTPUT CONTRACT — Read this first

This command MUST produce the following files before it is complete. The analysis and the file writes are not separable — each analysis section writes its file immediately. Do not defer writes to the end.

Required output files:
```
.buildflow/codebase/CODEBASE.md     ← module map, entry points, folder roles, tech stack, physical layout
.buildflow/codebase/PATTERNS.md     ← code patterns, architectural style, feature inventory, locale support
.buildflow/codebase/DEPENDENCIES.md ← package dependencies, external integrations, import graph, fan-in/out
.buildflow/codebase/RISKS.md        ← high-risk files, code quality concerns, debt, fragile flows
.buildflow/codebase/TESTING.md      ← test framework, layout, coverage gaps
.buildflow/codebase/intel.json      ← machine-readable index for other commands
```

If any write fails, stop immediately and report the file path and error. Do not continue to the next step.

---

## Step 1: Setup

```bash
mkdir -p .buildflow/codebase .buildflow/memory
```

Check for prior state:
- If `.buildflow/codebase/CODEBASE.md` already exists and `--update` is NOT passed: ask "Full re-onboard or incremental update?" — in non-interactive context, default to incremental.
- If `--update`: identify changed files since last `drift_baseline.recorded_at` in `intel.json`, classify them into drift areas, then present a **multiselect** of affected areas. If `--paths` is also given, skip the multiselect and use those paths directly.

  **Drift area classification:**

  | Changed file type | Drift area | Steps to re-run |
  |---|---|---|
  | `locales/`, `i18n/`, `*.po/arb/resx/strings.xml` | `locale` | Step 9c → PATTERNS.md + intel.json |
  | Route / screen / page / handler files | `routes` | Step 9a → PATTERNS.md |
  | Source files (general) | `modules` | Steps 4–6 → import graph, load-bearing, risk |
  | Dependency files (`package.json`, `go.mod`, etc.) | `dependencies` | Step 8 → CODEBASE.md, DEPENDENCIES.md |
  | Structural change (new dirs, new entry points) | `structure` | Step 3 → CODEBASE.md |

  **Multiselect prompt (shown when drift is detected):**
  ```
  Drift detected since last onboard ([date])
  ──────────────────────────────────────────────────
  Select areas to refresh (comma-separated, or "all"):

    [1]  structure    — [N] new directories or entry points
    [2]  modules      — [N] source files changed
    [3]  dependencies — package manifest changed
    [4]  routes       — [N] route/screen/page files changed
    [5]  locale       — locale catalog or i18n files changed

  Your selection (e.g. 1,3 or "all"):
  ```

  Re-run only the steps corresponding to the selected drift areas. If no drift is detected in any area, print "No drift detected since [date] — onboard data is current." and exit.
- If `--query [term]`: search `.buildflow/codebase/*.md` and `intel.json` for the term, print matches, and exit without rewriting any files.
- If `--paths [paths]`: validate paths are repo-relative, don't contain `..` or shell metacharacters, then restrict all scans to those paths.

---

## Step 2: Language & Framework Detection

Run this first — the language determines which grep patterns to use in later steps.

```bash
# Detect project files
ls package.json requirements.txt Cargo.toml go.mod pom.xml build.gradle build.gradle.kts pubspec.yaml Package.swift build.sbt Gemfile composer.json 2>/dev/null
```

Identify: primary language, framework, package manager, runtime version.

Stack analysis feeds into CODEBASE.md (written in Step 12 after all analysis is complete).

---

## Step 3: Structural Analysis

Run these scans:

```bash
# Entry points
find . \( -name "main.*" -o -name "index.*" -o -name "app.*" \) | grep -v node_modules | grep -v ".buildflow" | head -20

# Directory structure
find . -maxdepth 3 -type d | grep -v node_modules | grep -v ".git" | grep -v ".buildflow" | head -40

# Layer markers
find . \( -path "*/controllers/*" -o -path "*/services/*" -o -path "*/models/*" -o -path "*/repositories/*" -o -path "*/routes/*" -o -path "*/components/*" \) | grep -v node_modules | head -20

# File count by type
find src/ app/ lib/ -type f 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10
```

Identify: entry points, top-level folder responsibilities, architectural pattern (MVC / layered / hexagonal / feature-based / flat).

Structural analysis feeds into CODEBASE.md (written in Step 12 after all analysis is complete).

---

## Step 4: Module Boundary Mapping

Identify **bounded contexts** — groups of files that form a logical subsystem.

```bash
# Find module/package-level files
find . \( -name "index.ts" -o -name "index.js" -o -name "__init__.py" -o -name "mod.rs" \) | grep -v node_modules | head -20
```

For each module, identify: owns (file paths), exports (public API), depends on, depended on by.

Flag **boundary violations**: files importing across module lines without going through the module's public export.

---

## Step 5: Load-Bearing Module Identification

```bash
# Get all imports across source files to compute fan-in
grep -rn "^import\|^from\|^require\|^use " src/ app/ lib/ --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" 2>/dev/null | head -200
```

Calculate for each file:
- **Fan-in** (how many other files import THIS file) — high = load-bearing
- **Fan-out** (how many files THIS file imports) — high = coupled

Files with fan-in ≥ 5 are **load-bearing** — mark as CRITICAL or HIGH.

---

## Step 6: Risk Scoring

Score each file (1–5) on:
- Fan-in (0–1 = 1, 10+ = 5)
- File size (< 100 lines = 1, > 500 lines = 5)
- Test coverage (tests exist = 1, no tests = 5)
- Complexity proxy (< 5 TODO/FIXME = 1, > 20 = 5)

```bash
# Largest files
find src/ app/ lib/ -type f 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -20

# Files with no co-located test
find src/ -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" 2>/dev/null | head -20

# TODO/FIXME density per file
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ app/ 2>/dev/null | head -30
```

Hotspot data feeds into RISKS.md (written in Step 11 after security/concerns analysis).

---

## Step 7: Pattern Recognition

Read 2–3 representative files per major module:

```bash
# Read example files from each module
```

Document:
- Naming conventions (PascalCase, camelCase, snake_case)
- Import order (stdlib → 3rd party → internal)
- Error handling (throw vs return, error types)
- Async pattern (async/await, Promise chains, callbacks)
- Test conventions (co-located vs `__tests__/`, naming)

Detect test framework:
```bash
# JS/TS
cat package.json 2>/dev/null | grep -E "jest|vitest|mocha|jasmine|@testing-library|supertest|cypress|playwright"
ls jest.config.* vitest.config.* .mocharc.* 2>/dev/null

# Python
cat requirements.txt pyproject.toml 2>/dev/null | grep -E "pytest|unittest|nose"

# Go
find . -name "*_test.go" | head -5

# Rust
grep -rn "#\[cfg(test)\]" src/ 2>/dev/null | head -3
```

**Write `.buildflow/codebase/PATTERNS.md` NOW** using the Write tool:

```markdown
---
generated_by: buildflow-onboard
last_mapped_at: [ISO date]
scope: [full repo or comma-separated paths]
---

# Patterns

## Naming Conventions
- Files: [kebab-case / PascalCase / snake_case]
- Classes: [PascalCase]
- Functions: [camelCase / snake_case]
- Constants: [UPPER_SNAKE / camelCase]

## Component / Class Structure
[example from actual codebase]

## Import Order
[stdlib → 3rd party → internal — example from actual codebase]

## Error Handling
[throw vs return — example from actual codebase]

## Async Pattern
[async/await / Promise chains — example]

## Testing
Framework:     [Jest / Vitest / pytest / go test / cargo test / NONE]
Config:        [jest.config.ts / vitest.config.ts / pytest.ini / N/A]
Test location: [co-located *.test.ts / __tests__/ / tests/ / inline]
Naming:        [describe/it / test() / def test_ / #[test]]
Mock library:  [jest.mock / vi.mock / pytest fixtures / mockall / NONE]
Coverage:      [jest --coverage / pytest-cov / go test -cover / NONE]
Existing tests:[N files, N cases]
Has tests:     [YES / NO]
```

**Write `.buildflow/codebase/TESTING.md` NOW** using the Write tool:

```markdown
---
generated_by: buildflow-onboard
last_mapped_at: [ISO date]
scope: [full repo or comma-separated paths]
---

# Testing

## Frameworks
| Framework | Type | Command | Evidence |
|-----------|------|---------|----------|
| [framework] | [unit/integration/e2e] | [command] | [evidence file] |

## Test Layout
- [path pattern] — [unit/integration/e2e/fixture]

## Targeted Test Strategy
- Source file → likely test file convention: [convention]
- Run tests for a specific file: [command]

## Gaps
- [missing test framework/coverage/e2e/fixtures or NONE]
```

---

## Step 8: Dependency & Integration Analysis

```bash
# Parse dependency files
cat package.json 2>/dev/null
cat requirements.txt pyproject.toml 2>/dev/null
cat Cargo.toml 2>/dev/null
cat go.mod 2>/dev/null
cat pom.xml 2>/dev/null | head -80

# External service signals
grep -rn "axios\|fetch(\|http\.\|grpc\|stripe\|twilio\|sendgrid\|firebase\|supabase\|redis\|rabbitmq\|kafka" src/ app/ 2>/dev/null | head -30

# Env contracts
find . \( -name ".env.example" -o -name ".env.sample" -o -name ".env.template" \) | head -5
cat .env.example .env.sample 2>/dev/null | grep -v "^#" | head -30

# Webhook / callback patterns
grep -rn "webhook\|callback\|on_event\|event\.listen\|pubsub" src/ app/ 2>/dev/null | head -20
```

**Write `.buildflow/codebase/DEPENDENCIES.md` NOW** using the Write tool:

```markdown
---
generated_by: buildflow-onboard
last_mapped_at: [ISO date]
scope: [full repo or comma-separated paths]
---

# Dependencies

## Runtime Dependencies
| Package | Purpose | Criticality | Notes |
|---------|---------|-------------|-------|
| [name] | [purpose] | CORE/UTIL | [notes] |

## Dev Dependencies
| Package | Purpose | Notes |
|---------|---------|-------|
| [name] | [purpose] | [notes] |

## Known Vulnerability Flags
- [package@version] — [CVE or "ok"]

## External Services & Integrations
| Service | Purpose | SDK/Client | Auth/Env Contract | Evidence |
|---------|---------|------------|-------------------|----------|
| [service] | [purpose] | [sdk] | [ENV_VAR] | [file:line] |

## Data Stores
| Store | Client/ORM | Migrations | Evidence |
|-------|------------|------------|----------|
| [store] | [client] | [yes/no/N] | [file] |

## Webhooks / Callbacks
| Direction | Service | Endpoint | Verification | Evidence |
|-----------|---------|----------|--------------|----------|

## Environment Contracts
- [ENV_VAR] — [purpose, required/optional, evidence path]

## Import Graph (File-Level)
| File | Fan-in | Fan-out | Imports | Notes |
|------|--------|---------|---------|-------|
| [file] | [N] | [N] | [file, file] | CRITICAL / HIGH / normal |

## Symbol Caller Index
[SymbolName.method]    → [file:line, file:line]
[SymbolName2]          → [file:line]
```

---

## Step 9: Feature Inventory (Lens E)

Run ALL scans below. Do not skip any section — locale detection is required even if the project doesn't look like it has i18n, because locale evidence is often in config or static JSON files rather than in `src/`.

### 9a: Routes, screens, CLI

```bash
# HTTP routes / API handlers
grep -rn "router\.\|app\.\(get\|post\|put\|delete\|patch\)\|@Get\|@Post\|@Put\|@Delete\|urlpatterns\|FastAPI\|Blueprint\|Route(\|routes\." src/ app/ pages/ api/ 2>/dev/null | head -80

# UI screens / pages / views
find src app pages screens views components lib -type f 2>/dev/null | grep -E "(page|screen|view|route|layout)\.(ts|tsx|js|jsx|vue|svelte|dart|kt|swift)$" | head -60

# CLI commands and background jobs
grep -rn "command(\|program\.\|commander\|click\.command\|cobra\.Command\|urfave/cli\|thor \|argparse\|subcommand" . 2>/dev/null | head -40

# Feature names from tests (user-visible behavior)
grep -rn "describe(\|it(\|test(\|Feature:\|Scenario:\|User can\|should " test tests spec specs docs README.md src app 2>/dev/null | head -60
```

### 9b: Local dev / offline support

```bash
# Local run / dev server / offline signals
grep -rn "localhost\|127\.0\.0\.1\|offline\|localStorage\|IndexedDB\|sqlite\|file://\|dev server\|hot reload\|watch\|mock\|fixture\|seed" . 2>/dev/null | grep -v node_modules | grep -v ".buildflow" | head -60

# Docker / dev environment files
find . \( -name "docker-compose*.yml" -o -name "docker-compose*.yaml" -o -name "devcontainer.json" -o -name ".env.example" -o -name ".env.sample" -o -name ".env.template" \) | grep -v node_modules | head -20
```

### 9c: Locale / i18n support — run every command regardless of language

This is the most commonly missed feature. Run all of these — the evidence may be in config, static JSON, docs, or dependency files rather than in application code.

```bash
# --- Locale catalog files (language-agnostic) ---
find . -type f \( \
  -path "*/locales/*" \
  -o -path "*/locale/*" \
  -o -path "*/i18n/*" \
  -o -path "*/messages/*" \
  -o -path "*/translations/*" \
  -o -path "*/lang/*" \
  -o -name "*.locale.json" \
  -o -name "*.messages.json" \
  -o -name "messages*.properties" \
  -o -name "*.po" \
  -o -name "*.mo" \
  -o -name "*.resx" \
  -o -name "*.arb" \
  -o -name "Localizable.strings" \
  -o -name "strings.xml" \
\) 2>/dev/null | grep -v node_modules | grep -v ".buildflow" | head -60

# --- JS / TS (React, Next.js, Vue, Svelte, Node) ---
grep -rn "i18n\|useTranslation\|t(\|formatMessage\|next-intl\|react-i18next\|vue-i18n\|svelte-i18n\|Intl\.\|locale\|locales\|language\|languages" src/ app/ pages/ lib/ components/ 2>/dev/null | grep -v node_modules | head -60
grep -rn "import.*locales\|require.*locales\|import.*i18n\|require.*i18n\|import.*translations\|require.*translations" src/ app/ pages/ lib/ 2>/dev/null | head -30

# --- Python (Django, Flask, FastAPI, Babel) ---
grep -rn "gettext\|ngettext\|Babel\|flask_babel\|django\.utils\.translation\|LocaleMiddleware\|LANGUAGE_CODE\|LANGUAGES\s*=\|ugettext" . --include="*.py" --include="*.cfg" --include="*.ini" 2>/dev/null | head -40
find . \( -name "*.po" -o -name "*.mo" \) 2>/dev/null | grep -v node_modules | head -20

# --- Java / Spring Boot ---
grep -rn "ResourceBundle\|MessageSource\|LocaleContextHolder\|spring\.messages\|@RequestMapping.*locale\|LocaleResolver\|AcceptHeaderLocaleResolver" . --include="*.java" --include="*.properties" --include="*.yml" --include="*.yaml" 2>/dev/null | head -40
find . -name "messages*.properties" -o -name "messages*.xml" 2>/dev/null | grep -v node_modules | head -20

# --- Kotlin (Spring Boot, Android) ---
grep -rn "ResourceBundle\|MessageSource\|getString(R\.string\|Locale\.getDefault\|androidx\.compose\.ui\.text\.intl" . --include="*.kt" --include="*.xml" --include="*.properties" 2>/dev/null | head -30
find . -name "strings.xml" 2>/dev/null | grep -v node_modules | head -10

# --- Go ---
grep -rn "golang\.org/x/text\|language\.Tag\|message\.NewPrinter\|go-i18n\|i18n\.Bundle\|i18n\.Config\|Locale\|locale" . --include="*.go" 2>/dev/null | head -30

# --- Rust ---
grep -rn "i18n\|locale\|fluent\|rust-i18n\|gettext\|tr!(" . --include="*.rs" --include="*.toml" 2>/dev/null | head -20

# --- Ruby / Rails ---
grep -rn "I18n\.t\|I18n\.locale\|config/locales\|rails-i18n\|translate\|:locale =>" . --include="*.rb" --include="*.yml" --include="*.yaml" 2>/dev/null | head -30
find . -path "*/config/locales/*" -type f 2>/dev/null | head -20

# --- PHP / Laravel / Symfony ---
grep -rn "__(\|trans(\|Lang::\|resources/lang\|symfony/translation\|Translator\|setLocale\|getLocale\|app\.locale\|fallback_locale" . --include="*.php" --include="*.yaml" --include="*.yml" 2>/dev/null | head -30
find . -path "*/resources/lang/*" -o -path "*/translations/*" 2>/dev/null | grep "\.php\|\.json\|\.yaml\|\.yml" | grep -v node_modules | head -20

# --- C# / .NET ---
grep -rn "CultureInfo\|IStringLocalizer\|ResourceManager\|resx\|\.AddLocalization\|RequestLocalizationOptions\|SupportedCultures" . --include="*.cs" --include="*.resx" --include="*.csproj" 2>/dev/null | head -30
find . -name "*.resx" 2>/dev/null | grep -v node_modules | head -10

# --- Dart / Flutter ---
grep -rn "AppLocalizations\|Intl\.message\|flutter_localizations\|arb-dir\|\.arb\|supportedLocales\|localizationsDelegates\|MaterialApp.*locale" . --include="*.dart" --include="*.arb" --include="pubspec.yaml" 2>/dev/null | head -30
find . -name "*.arb" 2>/dev/null | head -10

# --- Swift / iOS ---
grep -rn "NSLocalizedString\|Localizable\.strings\|Locale\.current\|Bundle\.localizations\|\.localized\|stringsdict" . --include="*.swift" --include="*.strings" --include="*.stringsdict" 2>/dev/null | head -30
find . \( -name "Localizable.strings" -o -name "*.stringsdict" \) 2>/dev/null | head -10

# --- Scala (Play, Akka) ---
grep -rn "Messages\|MessagesApi\|Lang\|play\.i18n\|I18nSupport\|Lang\(" . --include="*.scala" --include="*.conf" 2>/dev/null | head -20

# --- Localized documentation ---
find . \( -name "README.*.md" -o -name "*.locale.md" -o -name "CHANGELOG.*.md" -o -name "CONTRIBUTING.*.md" \) 2>/dev/null | grep -v node_modules | head -20
grep -rn "English.*Português\|English.*日本語\|English.*한국어\|English.*中文\|English.*Español\|language selector\|language switcher\|\[en\]\|\[fr\]\|\[ja\]\|\[ko\]\|\[zh\]" README*.md docs 2>/dev/null | head -30

# --- Label / copy catalogs (static UI text in JSON/MD) ---
find . -type f \( \
  -name "*labels*.json" \
  -o -name "*copy*.json" \
  -o -name "*strings*.json" \
  -o -name "*messages*.json" \
  -o -name "*text*.json" \
  -o -name "*content*.json" \
\) 2>/dev/null | grep -v node_modules | head -20
grep -rn "\"label\"\s*:\|\"placeholder\"\s*:\|\"title\"\s*:\|\"aria-label\"\s*:\|displayName\s*:" src/ app/ lib/ components/ 2>/dev/null | head -30
```

### 9c: Locale detection rules

From the scan results above, determine:

1. **Locale catalog files found?** → Any `.po`, `.mo`, `.resx`, `.arb`, `*.locale.json`, `messages*.properties`, `strings.xml`, `Localizable.strings`, or JSON files under `locales/`, `i18n/`, `translations/`, `lang/` → **locale support exists**

2. **i18n library/framework found?** → Any import of `react-i18next`, `next-intl`, `vue-i18n`, `flutter_localizations`, `I18n.t`, `ResourceBundle`, `django.utils.translation`, `gettext`, `go-i18n`, `Intl.message`, `NSLocalizedString`, etc. → **locale support exists**

3. **Default locale** → Look for: `defaultLocale`, `LANGUAGE_CODE`, `app.locale`, `default_locale`, `fallback_locale`, locale folder named `en/` or `en.json`, or the first entry in a `LANGUAGES = []` list

4. **Supported locales** → Folder names under `locales/` or `lang/`, or file names like `fr.json`, `ja.json`, `.po` prefixes, or `supportedLocales: [...]` array

5. **Label catalogs** → JSON files containing `label`, `placeholder`, `title`, `aria-label` as primary keys → treat as locale evidence even if no i18n framework present

6. **If NO locale evidence found at all** → mark `Status: NO` in PATTERNS.md (Locale Support section) with confidence `high` (not `unknown`) — the absence is a confirmed finding, not a gap in the scan

Rules for feature discovery:
- A feature is real if at least one exists: route/handler, UI entry point, CLI command, background job, config flag, documented workflow, or test scenario.
- Docs-only features → mark `docs-only`; missing despite docs → mark `documented_missing`
- Local support (Docker Compose, seeds, offline mode) is a first-class feature — always detect it
- **i18n/locale is a first-class feature — always scan for it using all 9c commands above, even for projects that appear monolingual**

Feature inventory data (features, locale support, local support) feeds into PATTERNS.md (written in Step 7). Append this section to PATTERNS.md after the core patterns content:

```markdown
## Feature Inventory

### Summary
| Feature | Status | Entry Points | Owned Modules | Evidence |
|---------|--------|--------------|---------------|----------|
| [feature] | implemented/partial/docs-only | [route or script] | [module] | [file:line] |

### Local Support
Status: YES / PARTIAL / NO
Confidence: high / medium / low
Evidence:
- [path] [what it enables]
Gaps:
- [missing item or NONE]

### Locale Support
Status: YES / PARTIAL / NO  ← never leave as UNKNOWN; confirm YES or NO using scan results from Step 9c
Confidence: high / medium / low
Default locale: [en / fr / ja / UNKNOWN]
Supported locales: [en, fr, ja — derived from catalog filenames or supportedLocales array]
Detected stacks: [TypeScript/react-i18next / Python/django-i18n / Java/Spring-MessageSource / etc.]
Catalog type: [json / properties / po/mo / resx / arb / strings / xml]
i18n library: [react-i18next / next-intl / I18n.t / ResourceBundle / NSLocalizedString / django gettext / etc. / NONE]

Catalog files:
- [path] — [locale code and purpose, e.g., "en.json — English translation catalog"]

Provider / config:
- [path:line] [i18n init, locale middleware, or language switcher]

Label / copy catalogs:
- [path] — [purpose, e.g., "UI button labels", "form placeholders"]

Localized docs:
- [path] — [locale and purpose, e.g., "README.ja-JP.md — Japanese README"]

Evidence:
- [path:line] [catalog / library import / config / provider]

Gaps:
- [missing fallback locale / no test coverage for locale switching / etc. — or NONE]
- [if Status is NO: "Confirmed — no locale catalogs, i18n libraries, or locale-specific file patterns found"]

### Features

#### [Feature Name]
Status: implemented / partial / docs-only / documented_missing
Confidence: high / medium / low
User value: [what this enables]
Entry points:
- [route / screen / command]
Evidence:
- [path:line] [why this proves the feature exists]
Owned modules: [module names]
Tests: [test paths or NONE]
Blind spots: [what static mapping cannot prove, or NONE]
```

**Update `.buildflow/codebase/PATTERNS.md`** using the Write tool to append the Feature Inventory section above after the core patterns content.

---

## Step 10: Import Graph — File Level & Symbol Level (feeds into DEPENDENCIES.md)

### 10a: File-level import graph

```bash
# JS/TS
grep -rn "^import\|^const.*require" src/ app/ --include="*.ts" --include="*.js" 2>/dev/null | head -200

# Python
grep -rn "^import\|^from" src/ app/ --include="*.py" 2>/dev/null | head -100

# Go
grep -rn "^import" --include="*.go" . 2>/dev/null | head -100

# Rust
grep -rn "^use " src/ --include="*.rs" 2>/dev/null | head -100
```

Build: file → imports list. Calculate fan-in and fan-out per file.

### 10b: Symbol export extraction

For each source file, extract exported symbols:

```bash
# TypeScript / JavaScript
grep -rn "^export \(async \)\?function\|^export class\|^export const\|^export type\|^export interface\|^export enum\|^export default" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null

# Python — public symbols (no leading underscore)
grep -rn "^def [^_]\|^class [^_]\|^async def [^_]" src/ app/ --include="*.py" 2>/dev/null

# Go — exported (uppercase)
grep -rn "^func [A-Z]\|^type [A-Z]" --include="*.go" . 2>/dev/null

# Rust — pub items
grep -rn "^pub fn\|^pub struct\|^pub enum\|^pub trait" src/ --include="*.rs" 2>/dev/null

# Java
grep -rn "^public class\|^public interface\|public [a-zA-Z].*(" src/main/ --include="*.java" 2>/dev/null | head -40

# Kotlin
grep -rn "^fun [A-Z]\|^class \|^data class \|^object \|^interface " src/main/ --include="*.kt" 2>/dev/null | grep -v "private\|internal" | head -40

# C#
grep -rn "public class \|public interface \|public static.*\|public .*(" src/ --include="*.cs" 2>/dev/null | grep -v "//" | head -40

# Ruby
grep -rn "^class \|^module \|^  def [^_]\|^def [^_]" app/ lib/ --include="*.rb" 2>/dev/null | grep -v "private\|protected" | head -40
```

### 10c: Symbol caller index

For each key exported symbol, find callers:

```bash
# For each symbol name: grep for references in source files excluding the defining file
grep -rn "[SymbolName]" src/ app/ --include="*.ts" --include="*.py" --include="*.go" 2>/dev/null | grep -v "[defining-file]" | head -20
```

**Update `.buildflow/codebase/DEPENDENCIES.md`** using the Write tool to fill in the Import Graph and Symbol Caller Index sections (added in Step 8's template) with the data gathered in Steps 10a–10c.

---

## Step 11: Security Surface & Concerns

```bash
# Potential secret exposure
grep -rn "password\|secret\|api_key\|apikey\|token\|credential" src/ app/ --include="*.ts" --include="*.py" --include="*.go" -i 2>/dev/null | grep -v "test\|spec\|mock" | head -20

# Dangerous patterns
grep -rn "eval(\|exec(\|shell_exec\|subprocess\|dangerouslySetInnerHTML\|innerHTML" src/ app/ 2>/dev/null | head -10

# Auth surface
find . \( -path "*/auth*" -o -path "*/middleware*" -o -path "*/guard*" \) | grep -v node_modules | head -10
```

**Write `.buildflow/codebase/RISKS.md` NOW** using the Write tool:

```markdown
---
generated_by: buildflow-onboard
last_mapped_at: [ISO date]
scope: [full repo or comma-separated paths]
---

# Risks

## Hotspots — Handle With Care
Files scored ≥ 3.5 risk. Review before any modification.

| File | Risk | Fan-in | Size | Tests | Notes |
|------|------|--------|------|-------|-------|
| [file] | [N.N] | [N] | [N]L | [yes/no/partial] | [why risky] |

## High-Risk Areas
| Area/File | Concern | Evidence | Suggested Guard |
|-----------|---------|----------|-----------------|
| [file] | [concern] | [evidence] | [guard] |

## Security Surface
- Auth files: [list]
- Potential secret refs: [list or NONE]
- Dangerous API usage: [list or NONE]

## Technical Debt
- TODO/FIXME count: [N]
- Largest files with no tests: [list]

## Mapping Blind Spots
- [generated routes, dynamic imports, feature flags, missing tests — or NONE]
```

---

## Step 12: Write CODEBASE.md and intel.json

Now that all sub-files are written, write the master knowledge file and machine-readable index.

**Write `.buildflow/codebase/CODEBASE.md` NOW** using the Write tool:

```markdown
---
generated_by: buildflow-onboard
last_mapped_at: [ISO date]
scope: [full repo or comma-separated paths]
---

# Codebase
**Project:** [name]  **Onboarded:** [date]  **Files analyzed:** [N]

## Stack

### Languages & Runtimes
| Language/Runtime | Version | Evidence |
|------------------|---------|----------|
| [language] | [version] | [evidence file] |

### Frameworks & Build Tools
| Tool | Purpose | Evidence |
|------|---------|----------|
| [framework] | [purpose] | [evidence file] |

### Package Managers & Lockfiles
- [npm/pnpm/yarn/pip/poetry/maven/gradle/go/cargo] — [evidence path]

### Critical Dependencies
| Dependency | Purpose | Runtime/Dev | Evidence |
|------------|---------|-------------|----------|
| [name] | [purpose] | [runtime/dev] | [file] |

### Platform Requirements
- Development: [requirements]
- Production: [requirements]

## Module Map

### Entry Points
- [file]: [purpose]

### Module Boundaries
| Module | Owns | Exports | Depends On | Depended On By |
|--------|------|---------|------------|----------------|
| [name] | [paths] | [symbols] | [modules] | [modules] |

### Load-Bearing Modules
| File | Fan-in | Risk | Notes |
|------|--------|------|-------|
| [file] | [N] | [N.N] | CRITICAL / HIGH |

### Boundary Violations
[files importing across module lines without public API — or NONE]

## Structure

### Directory Map
| Path | Responsibility | Owner Module | Notes |
|------|----------------|--------------|-------|
| [path] | [responsibility] | [module] | [notes] |

### Folder Structure
```
[annotated directory tree — one line per folder with its role]
```

### Generated / Static Assets
- [path] — [locale labels, fixtures, generated clients, public assets]

### Path Conventions
- [source layout, test layout, route layout, package layout]
```

**Write `.buildflow/codebase/intel.json` NOW** using the Write tool with the machine-readable index:

```json
{
  "onboarded_at": "[ISO datetime]",
  "last_mapped_commit": "[git HEAD sha or unknown]",
  "scope": { "mode": "full", "paths": [] },
  "file_count": 0,
  "tech_stack": {
    "language": "[language]",
    "framework": "[framework]",
    "test_framework": "[framework or NONE]",
    "orm": "[orm or NONE]",
    "bundler": "[bundler or NONE]"
  },
  "modules": [
    {
      "name": "[Module]",
      "owns": ["[path]"],
      "exports": ["[Symbol]"],
      "depends_on": ["[Module]"],
      "depended_on_by": ["[Module]"]
    }
  ],
  "features": [
    {
      "name": "[Feature]",
      "status": "implemented",
      "confidence": "high",
      "entry_points": ["[route or script]"],
      "owned_modules": ["[Module]"],
      "evidence": [{ "file": "[path]", "line": 0, "note": "[why]" }]
    }
  ],
  "local_support": {
    "status": "yes",
    "confidence": "high",
    "dev_scripts": ["[npm run dev / python manage.py runserver / go run . / etc.]"],
    "local_services": ["[docker-compose.dev.yml / etc.]"],
    "env_files": [".env.example"],
    "seed_or_fixture_files": [],
    "evidence": [{ "file": "[path]", "line": 0, "note": "[what it enables]" }],
    "gaps": []
  },
  "locale_support": {
    "status": "yes",
    "confidence": "high",
    "default_locale": "[en / UNKNOWN]",
    "supported_locales": ["[en]", "[fr]"],
    "detected_stacks": ["[TypeScript / Python / Java / Go / Ruby / PHP / .NET / Flutter / Swift / Kotlin / Scala]"],
    "catalog_files": ["[src/locales/en.json / messages_en.properties / Localizable.strings / etc.]"],
    "catalog_type": "[json / properties / po / mo / resx / arb / strings / xml]",
    "i18n_library": "[react-i18next / next-intl / django.utils.translation / I18n.t / ResourceBundle / NSLocalizedString / etc. / NONE]",
    "label_catalogs": ["[path to static label/copy JSON — or NONE]"],
    "localized_docs": ["[README.ja-JP.md / etc. — or NONE]"],
    "provider_files": ["[src/i18n/index.ts / etc.]"],
    "evidence": [
      { "file": "[path]", "line": 0, "note": "[catalog / library / config / provider]" }
    ],
    "gaps": ["[missing fallback locale / missing test coverage / etc. — or NONE]",
             "[if status is NO: confirmed no locale evidence found]"]
  },
  "load_bearing": [
    { "file": "[path]", "fan_in": 0, "risk": 0.0 }
  ],
  "hotspots": [
    { "file": "[path]", "risk": 0.0, "fan_in": 0, "lines": 0, "has_tests": false }
  ],
  "file_index": [
    {
      "path": "[path]",
      "module": "[Module]",
      "fan_in": 0,
      "fan_out": 0,
      "risk": 0.0,
      "has_tests": false,
      "exports": ["[Symbol]"],
      "imports": ["[path]"],
      "symbols": [
        {
          "name": "[Symbol]",
          "type": "function",
          "line": 0,
          "exported": true,
          "signature": "[signature]"
        }
      ]
    }
  ],
  "symbol_callers": {
    "[Symbol.method]": [
      { "file": "[path]", "line": 0 }
    ]
  },
  "security_surface": {
    "auth_files": ["[path]"],
    "secret_ref_files": [],
    "dangerous_patterns": []
  },
  "schema": {
    "orm": "[orm or null]",
    "schema_file": "[path or null]",
    "migration_count": 0
  },
  "testing": {
    "framework": "[framework or NONE]",
    "commands": ["[command]"],
    "test_file_patterns": ["[pattern]"],
    "gaps": []
  },
  "integrations": [],
  "structure": {
    "directories": [
      { "path": "[path]", "responsibility": "[role]", "module": "[Module]" }
    ],
    "entry_points": ["[path]"],
    "static_assets": []
  },
  "map_documents": {
    "CODEBASE.md": { "purpose": "module map, entry points, folder roles, tech stack, physical layout" },
    "PATTERNS.md": { "purpose": "code patterns, architectural style, feature inventory, locale support" },
    "DEPENDENCIES.md": { "purpose": "package dependencies, external integrations, import graph, fan-in/out" },
    "RISKS.md": { "purpose": "high-risk files, code quality concerns, debt, fragile flows" },
    "TESTING.md": { "purpose": "test framework, coverage, test patterns" }
  },
  "drift_baseline": {
    "recorded_at": "[ISO datetime]",
    "last_mapped_commit": "[git HEAD sha or unknown]",
    "structure_paths": ["src/", "app/"],
    "file_hashes": {},
    "module_file_counts": {},
    "load_bearing_exports": {}
  }
}
```

---

## Step 13: Secret Scan

Before declaring complete, scan generated files for accidentally included secrets:

```bash
grep -E "(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ)" .buildflow/codebase/*.md .buildflow/codebase/intel.json 2>/dev/null
```

If matches found: stop, show file:line references, ask user to confirm false positive or redact.

---

## Step 14: Update Memory

Update `.buildflow/MEMORY.md`:
```yaml
onboarded: true
onboarded_date: [today]
file_count: [N]
module_count: [N]
load_bearing_files: [N]
hotspot_count: [N]
codebase_summary: [2-line summary of what this codebase does]
intel_index: .buildflow/codebase/intel.json
```

---

## Step 15: Output Verification (MANDATORY)

Before printing the completion summary, verify every required file exists and is non-empty:

```bash
ls -la .buildflow/codebase/
```

Check for each file in the OUTPUT CONTRACT:
- CODEBASE.md ✓ / ✗
- PATTERNS.md ✓ / ✗
- DEPENDENCIES.md ✓ / ✗
- RISKS.md ✓ / ✗
- TESTING.md ✓ / ✗
- intel.json ✓ / ✗

**If any file is missing or empty: write it now.** Do not print "Onboarding Complete" if any file is missing.

---

## Step 16: Completion Summary

```
Onboarding Complete
───────────────────
Files analyzed:      [N]
Modules identified:  [N]
Features mapped:     [N]  ([N] implemented, [N] partial, [N] docs-only)
Load-bearing files:  [N]  (fan-in ≥ 5)
High-risk hotspots:  [N]  (risk ≥ 3.5)
Test coverage est.:  [N]% (files with co-located tests)
Local support:       YES / PARTIAL / NO
Locale support:      YES / PARTIAL / NO

Knowledge files written:
  .buildflow/codebase/CODEBASE.md
  .buildflow/codebase/PATTERNS.md
  .buildflow/codebase/DEPENDENCIES.md
  .buildflow/codebase/RISKS.md
  .buildflow/codebase/TESTING.md
  .buildflow/codebase/intel.json

⚠ Caution zones: [top 3 highest-risk files]
✓ Safe to modify:  [modules with low risk scores]
```

## Token cost report

Measure actual cost before printing:
1. Estimate input tokens per file: `Math.ceil((chars / (baseDivisor − densityPenalty)) × 1.05)` — prose/md=4.0, standard code=3.5, Go/Rust/C=3.2, JSON/YAML=3.2, minified=2.7; densityPenalty: symbol-dense=0.3, normal=0.1, sparse=0.0. Sum all files = input tokens.
2. Estimate output tokens (prose-heavy command): `Math.ceil((outputChars / 3.9) × 1.05)` = output tokens
3. Update `STATE.md → session_tokens_used`

Default output (minimal):
```
Onboard complete — [N] files · [N] modules · [N] hotspots · 6 knowledge files written
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in PREFERENCES.md):
```
Token Cost — /buildflow-onboard
────────────────────────────────
Files analyzed: [N]  Modules: [N]  Hotspots: [N]
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens  (CODEBASE.md + PATTERNS.md + DEPENDENCIES.md + RISKS.md + TESTING.md + intel.json)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

Update `MEMORY.md`: `last_onboard_tokens: ~[N]K`

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-spec  (or /buildflow-modify for a targeted change)
   Why:  Codebase is now fully indexed — spec your next phase or make surgical changes with full impact tracing
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

## Token Budget: ~45K (one-time — pays back on every subsequent session)
