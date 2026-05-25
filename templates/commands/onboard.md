---
name: buildflow-onboard
description: Deep codebase analysis — import graph, module boundaries, feature inventory, local support map, load-bearing files, risk scores
allowed-tools: Read, Write, Bash, Glob, Grep
agent: cartographer
---

# /buildflow-onboard

Deep one-time analysis of an existing codebase. Goes beyond folder structure — maps import graphs, identifies load-bearing modules, scores file risk, establishes module boundaries, and inventories user-facing/operator-facing features including local support. All other agents reference these outputs.

## When to Run
- First time using BuildFlow on an existing project
- After a major refactor or framework migration
- `--update` flag for incremental refresh after significant changes

## Usage
- `/buildflow-onboard` — full analysis
- `/buildflow-onboard --update` — refresh changed files, affected feature evidence, and local-support metadata
- `/buildflow-onboard --paths src/auth,packages/ui` — scoped remap of specific repo-relative paths
- `/buildflow-onboard --query locale` — search codebase map documents and `intel.json` for a term
- `/buildflow-onboard --depth imports` — focus on dependency graph only

---

## Step 1: Prior State Check
Ensure output directories exist before analysis:

```bash
mkdir -p .buildflow/codebase .buildflow/memory
```

If `.buildflow/` does not exist yet, create it. `/buildflow-onboard` is allowed to run before `/buildflow-start` or `/buildflow-init`; it must still write `.buildflow/codebase/*` outputs.

If `.buildflow/codebase/MAP.md` exists:
- `--update` flag: run the Incremental Refresh rules below, then continue with affected steps only
- `--paths` flag: validate path scope first, then run the same affected-step refresh only inside those paths
- `--query` flag: search `.buildflow/codebase/*.md` and `.buildflow/codebase/intel.json`; print matching file/section/line snippets and exit without rewriting maps
- Otherwise ask: "Full re-onboard or incremental update?"
- If running in a non-interactive context and no answer is available, default to incremental update when existing maps are present.

### Scoped Path Rules (`--paths`)

Use scoped remaps for structural drift, large monorepos, or focused updates after a feature area changes.

Accept only repo-relative paths that:
- Do not start with `/`, drive letters, or `~`
- Do not contain `..`
- Do not contain shell metacharacters: `;`, `` ` ``, `$`, `&`, `|`, `<`, `>`
- Use only path components made from letters, numbers, `_`, `-`, `.`

If all supplied paths are invalid, stop and ask for valid repo-relative paths. If some are invalid, ignore invalid paths and report which were skipped.

When scoped paths are active:
- Every scan command must restrict itself to those paths.
- Every generated document must state `Scope: [paths]`.
- `intel.json.scope` must record the paths refreshed.
- Only update feature/local/locale evidence that references the scoped paths, unless a scoped dependency proves a wider update is needed.

### Incremental Refresh Rules (`--update`)

Do not refresh only source files. Feature and local-support drift often lives in docs, scripts, config, test fixtures, generated command files, compose files, and package metadata.

For `--update`, first identify changed files since the last `drift_baseline.recorded_at` or last onboard commit:
- Source/runtime: `src/`, `app/`, `pages/`, `lib/`, `server/`, `api/`
- UI/route metadata: route files, page files, screen files, component entry files
- CLI/workflow metadata: `bin/`, command registries, scripts, task runners, CI workflows
- Local support: `package.json`, lockfiles, `.env*`, Docker/Compose files, devcontainer files, seed/fixture/mock directories, local DB config, emulator config
- Locale/i18n support: locale JSON/static catalogs, translation imports, message bundles, localized docs, label/copy metadata, language config, i18n middleware/providers
- Docs that describe runnable behavior: `README*`, `docs/**`, install/setup files
- Tests/specs that name user capabilities

Then refresh:
- Any module touched by changed source files
- Any feature whose evidence references a changed file
- The entire `local_support` block if any local-support file changed
- The entire `locale_support` block if any locale/i18n file changed
- `FEATURES.md`, `MAP.md` Feature Inventory Summary, and `intel.json.features[]` on every update
- `drift_baseline` after all refreshed data is written

If changed files include docs/config/scripts but no source files, still update `FEATURES.md`; those files may represent operator-facing or local-support capabilities.

### Structural Drift Categories

When deciding whether a map is stale, classify changed files before refreshing:

| Category | Examples | Refresh |
|----------|----------|---------|
| `new_dir` | new top-level or module directory not mentioned in `STRUCTURE.md` | `STRUCTURE.md`, `MAP.md`, `intel.json.modules` |
| `route` | new route/API/page/screen file | `FEATURES.md`, `MAP.md`, `GRAPH.md`, `intel.json.features[]` |
| `migration` | Prisma/Drizzle/Supabase/SQL migration or schema file | `DEPENDENCIES.md`, `STACK.md`, `HOTSPOTS.md`, schema drift baseline |
| `barrel` | new `index.ts/js` public export in `src/`, `apps/*/src`, `packages/*/src` | `GRAPH.md`, `STRUCTURE.md`, symbol exports |
| `dependency` | package/lock/build config changes | `STACK.md`, `DEPENDENCIES.md`, `INTEGRATIONS.md` |
| `integration` | API client, webhook, auth provider, env contract | `INTEGRATIONS.md`, `FEATURES.md`, security surface |
| `test` | test framework/config/fixture changes | `TESTING.md`, `PATTERNS.md` |
| `copy_locale` | labels, localized docs, locale catalogs | `FEATURES.md`, `locale_support` |

If 3 or more structural drift elements are found, recommend `/buildflow-onboard --paths [affected paths]`. This warning is non-blocking; do not interrupt build/check workflows unless the user asks for strict mapping freshness.

---

## Step 2: Structural Analysis — 5 Parallel Lenses

Run these five analyses in parallel. Each lens produces a focused view that the others don't cover.

### Lens A — Architecture (entry points, layers, module boundaries)
```bash
# Entry points
find . -name "main.*" -o -name "index.*" -o -name "app.*" | grep -v node_modules
# File count by type
find src/ -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn
# Layer markers
find . -path "*/controllers/*" -o -path "*/services/*" -o -path "*/models/*" -o -path "*/repositories/*" -o -path "*/routes/*" -o -path "*/components/*" | grep -v node_modules | head -20
```
Produce: entry points, top-level folder responsibilities, detected architectural pattern (MVC, layered, hexagonal, feature-based, flat).

### Lens B — Quality (size, complexity, test coverage signals)
```bash
# Largest files (complexity proxy)
find src/ -name "*.ts" -o -name "*.py" -o -name "*.go" | xargs wc -l 2>/dev/null | sort -rn | head -20
# Files with no co-located test
find src/ -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" | head -30
# TODO/FIXME/HACK density
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ | wc -l
```
Produce: top 10 largest files, estimated test coverage % (files with tests / total files), tech debt signal (TODO density).

### Lens C — Security (credential patterns, dangerous APIs, auth surface)
```bash
# Potential secrets
grep -rn "password\|secret\|api_key\|apikey\|token\|credential" src/ --include="*.ts" --include="*.py" --include="*.go" -i | grep -v "test\|spec\|mock" | head -20
# Dangerous patterns
grep -rn "eval(\|exec(\|shell_exec\|subprocess\|dangerouslySetInnerHTML\|innerHTML" src/ | head -10
# Auth surface
find . -path "*/auth*" -o -path "*/middleware*" -o -path "*/guard*" | grep -v node_modules | head -10
```
Produce: security surface area, potential secret exposure locations, dangerous API usage.

### Lens D — Data (schema definitions, migration state, ORM patterns)
```bash
# Schema files
find . -name "schema.prisma" -o -name "*.migration.*" -o -name "models.py" -o -name "*.entity.ts" | grep -v node_modules | head -10
# Migration count and newest
ls -lt migrations/ db/migrations/ prisma/migrations/ 2>/dev/null | head -5
# ORM / query patterns
grep -rn "findOne\|findMany\|query\|Model\.\|session\.query\|db\." src/ | wc -l
```
Produce: data layer pattern (Prisma/SQLAlchemy/GORM/raw SQL), migration count, schema file locations.

### Lens E — Feature Inventory (user-facing capabilities, local support, locale/i18n support, workflows)

This lens answers: **"What can this app do?"** Do not infer only from folder names. Use code evidence from routes, CLI commands, UI screens, handlers, tests, docs, config, and integration points.

Scan for feature entry points:
```bash
# Routes / APIs
grep -rn "router\.\|app\.\|Route\|Controller\|@Get\|@Post\|urlpatterns\|FastAPI\|Blueprint" src/ app/ pages/ api/ 2>/dev/null | head -80

# UI screens / pages / views
find src app pages screens views components lib -type f 2>/dev/null | grep -E "(page|screen|view|route|component)\.(ts|tsx|js|jsx|vue|svelte|dart|kt|swift)$" | head -80

# CLI commands / jobs / workflows
grep -rn "command(\|program\.\|commander\|click\.command\|argparse\|cobra.Command\|urfave/cli\|thor " . 2>/dev/null | head -80

# Local/offline/dev support signals
grep -rn "localhost\|127.0.0.1\|offline\|localStorage\|IndexedDB\|sqlite\|file://\|dev server\|hot reload\|watch\|docker-compose\|compose.dev\|mock\|fixture\|seed" . 2>/dev/null | grep -v node_modules | head -120

# Locale/i18n support signals
find . -type f \( -path "*/locales/*" -o -path "*/locale/*" -o -path "*/i18n/*" -o -path "*/messages/*" -o -path "*/translations/*" -o -name "*.locale.json" -o -name "*.messages.json" -o -name "README.*.md" -o -name "*.i18n.md" \) 2>/dev/null | grep -v node_modules | head -120
grep -rn "i18n\|locale\|locales\|translations\|messages\|language\|languages\|Intl\|useTranslation\|t(\|formatMessage\|next-intl\|react-i18next\|vue-i18n" src app pages lib components public docs README.md 2>/dev/null | head -120
grep -rn "import .*\\.json\|require(.*\\.json\|assert.*json\|with .*json" src app pages lib components 2>/dev/null | head -120

# UI copy, command labels, localized docs, and static label catalogs
find . -type f \( -name "README.*.md" -o -name "*.locale.md" -o -name "*.labels.json" -o -name "*labels*.json" -o -name "*copy*.json" -o -name "*strings*.json" -o -name "*messages*.json" \) 2>/dev/null | grep -v node_modules | head -120
grep -rn "\"label\"[[:space:]]*:\|label:[[:space:]]*['\"]\|labels:[[:space:]]*\\[\|displayName\|title:[[:space:]]*['\"]\|aria-label\|placeholder" src app pages lib components commands templates docs README*.md 2>/dev/null | head -120
grep -rn "English.*Português\|English.*日本語\|English.*한국어\|English.*中文\|language selector\|language switcher" README*.md docs 2>/dev/null | head -80

# Cross-language locale/i18n dependency and import signals
grep -rn "ResourceBundle\|MessageSource\|LocaleContextHolder\|spring.messages\|messages_.*\\.properties" src main app 2>/dev/null | head -80
grep -rn "golang.org/x/text\|language\\.Tag\|message\\.NewPrinter\|go-i18n\|i18n.Bundle" . --include="*.go" 2>/dev/null | head -80
grep -rn "gettext\|ngettext\|Babel\|flask_babel\|django.utils.translation\|LocaleMiddleware" . --include="*.py" 2>/dev/null | head -80
grep -rn "I18n\\.t\|config/locales\|rails-i18n" . --include="*.rb" --include="*.yml" 2>/dev/null | head -80
grep -rn "__([^_]\|trans(\|Lang::\|resources/lang\|symfony/translation" . --include="*.php" --include="*.yaml" --include="*.yml" 2>/dev/null | head -80
grep -rn "CultureInfo\|IStringLocalizer\|ResourceManager\|\\.resx" . --include="*.cs" --include="*.resx" 2>/dev/null | head -80
grep -rn "AppLocalizations\|Intl\\.message\|flutter_localizations\|arb-dir\|\\.arb" . --include="*.dart" --include="*.arb" --include="pubspec.yaml" 2>/dev/null | head -80
grep -rn "NSLocalizedString\|Localizable\\.strings\|Locale\\.current" . --include="*.swift" --include="*.strings" 2>/dev/null | head -80
grep -rn "getString(R\\.string\|strings\\.xml\|Locale\\.getDefault\|androidx.compose.ui.text.intl" . --include="*.kt" --include="*.java" --include="*.xml" 2>/dev/null | head -80
find . -type f \( -name "messages*.properties" -o -name "*.po" -o -name "*.mo" -o -name "*.resx" -o -name "*.arb" -o -name "Localizable.strings" -o -name "strings.xml" \) 2>/dev/null | grep -v node_modules | head -120

# Feature names in tests and docs
grep -rn "describe(\|it(\|test(\|Feature:\|Scenario:\|User can\|should " test tests spec specs docs README.md src app 2>/dev/null | head -120
```

Produce a **Feature Inventory** with one row per discovered capability:
```
Feature: Local development support
Aliases:
  - local mode
  - dev environment
  - offline/dev workflow
Evidence:
  - docker-compose.dev.yml: defines app + db + redis for local runs
  - src/config/env.ts: LOCAL_MODE flag
  - README.md: "Run locally" section
Entry points:
  - npm run dev
  - /api/health
Owned modules:
  - Config
  - Docker / runtime
Status:
  implemented / partial / docs-only / test-only
Confidence:
  high / medium / low
Risk:
  missed-by-architecture-scan if only config/docs touched
Blind spots:
  - runtime behavior not verified
  - feature may be hidden behind env flag
```

Feature discovery rules:
- Treat docs + config + scripts as feature evidence, not just `src/` code.
- Treat static JSON assets as feature evidence when they are imported, loaded by config, or stored under known feature directories such as `locales/`, `i18n/`, `messages/`, `translations/`, `fixtures/`, or `data/`.
- Treat static label/copy files as feature evidence when they define UI labels, command labels, option labels, placeholders, display names, accessibility labels, or translated documentation. These often live in JSON, Markdown, templates, command definitions, or framework metadata rather than route handlers.
- A feature is real if at least one of these exists: route/handler, UI entry point, CLI command, background job, config flag, documented workflow, test scenario.
- Always look for local support explicitly: local dev scripts, Docker Compose, seed data, mocks, offline mode, localhost callbacks, local file storage, emulator support, dev credentials placeholders, hot reload.
- Always look for locale/i18n support explicitly: locale catalogs, imported JSON translations, message bundles, language switchers, i18n providers/middleware, translation helper calls, route prefixes such as `/en` or `/fr`, and fallback/default locale config.
- Always look for localized documentation explicitly: `README.*.md`, translated docs, language link bars, language selector text, and docs that mirror the same product capability in multiple languages.
- Always look for label/copy catalogs explicitly: `label`, `labels`, `displayName`, `title`, `placeholder`, `aria-label`, command option labels, form labels, menu labels, and static JSON/Markdown files whose primary purpose is user-facing text.
- Detect locale/i18n dependencies and imports across stacks, not only JavaScript:
  - Java/Spring: `ResourceBundle`, `MessageSource`, `LocaleContextHolder`, `messages*.properties`, `spring.messages.*`
  - Go: `golang.org/x/text`, `language.Tag`, `message.Printer`, `go-i18n`
  - Python: `gettext`, `Babel`, `flask_babel`, `django.utils.translation`, `.po`, `.mo`
  - Ruby/Rails: `I18n.t`, `config/locales/*.yml`, `rails-i18n`
  - PHP/Laravel/Symfony: `__()`, `trans()`, `Lang::`, `resources/lang`, `symfony/translation`
  - .NET: `.resx`, `CultureInfo`, `IStringLocalizer`, `ResourceManager`
  - Flutter/Dart: `.arb`, `AppLocalizations`, `Intl.message`, `flutter_localizations`
  - Swift/iOS: `NSLocalizedString`, `Localizable.strings`, `Locale.current`
  - Android/Kotlin/Java: `strings.xml`, `getString(R.string...)`, `Locale.getDefault`
- Do not mark a feature complete unless there is executable code or runnable config behind it. Docs-only features must be marked `docs-only`.
- If a feature is expected by docs but missing in code, record it as `documented_missing`.
- Record aliases/synonyms when docs, tests, and code use different names for the same capability.
- Record confidence. Use `high` only when at least two evidence types agree (for example code + test, code + docs, config + runnable script). Use `medium` for one strong executable signal. Use `low` for docs/test-only signals.
- Record blind spots when static scanning cannot prove runtime behavior, permissions, environment-specific behavior, or generated routes.

**Lens Summary (printed after all 5 complete):**
```
5-Lens Analysis Complete
────────────────────────
Architecture:  [pattern detected — MVC / layered / flat / feature-based]
Quality:       [N files, ~N% have tests, N TODO/FIXME markers]
Security:      [N auth files, N potential secret refs, N dangerous patterns]
Data:          [ORM: Prisma/SQLAlchemy/GORM, N migrations, schema at: path]
Features:      [N implemented, N partial, N docs-only, local support: YES/NO/PARTIAL, locale support: YES/NO/PARTIAL]
```

---

## Step 3: Technology & Dependency Detection
Parse `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod`. For each major dependency:
- Purpose (what problem it solves)
- Criticality: CORE (app breaks without) / UTIL (convenience) / DEV (build-time only)
- Security status: check for known CVE patterns in version

### Test Framework Detection (captured here so all agents can reuse it)
```bash
# JS/TS — check deps and config
cat package.json | grep -E "jest|vitest|mocha|jasmine|@testing-library|supertest|cypress|playwright"
ls jest.config.* vitest.config.* .mocharc.* 2>/dev/null
find . -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" | head -5
find . -type d -name "__tests__" | head -3

# Python
cat requirements.txt pyproject.toml setup.cfg 2>/dev/null | grep -E "pytest|unittest|nose"
find . -name "test_*.py" -o -name "*_test.py" | head -5

# Go — test files use same package
find . -name "*_test.go" | head -5

# Rust — tests are inline
grep -rn "#\[cfg(test)\]" src/ | head -5
```

Record the **Test Profile** in `PATTERNS.md` under a `## Testing` section:
```
Framework:     [Jest / Vitest / pytest / go test / cargo test / NONE]
Config:        [jest.config.ts / vitest.config.ts / pytest.ini / N/A]
Test location: [co-located *.test.ts / __tests__/ / tests/ / inline]
Naming:        [describe/it / test() / def test_ / #[test]]
Mock library:  [jest.mock / vi.mock / pytest fixtures / mockall / NONE]
Coverage:      [jest --coverage / pytest-cov / go test -cover / NONE]
Existing tests:[N files, N cases]
Has tests:     [YES / NO — no framework detected]
```

If `Has tests: NO`: note in summary — "⚠ No test framework found. Tests cannot be written until one is installed."

---

## Step 4: Import Graph Analysis — Symbol Level (repo awareness core)

### 4a: File-Level Import Graph
For each source file, trace its imports and exports:

```bash
# JS/TS: find all import statements
grep -rn "^import\|^const.*require" src/ --include="*.ts" --include="*.js"
# Python
grep -rn "^import\|^from" src/ --include="*.py"
# Go
grep -rn "^import" --include="*.go" .
# Rust
grep -rn "^use " src/ --include="*.rs"
```

Build a dependency map:
```
file-a.ts  imports  [auth.service.ts, db.client.ts, types.ts]
auth.service.ts  imports  [db.client.ts, crypto.ts, config.ts]
db.client.ts  imports  [config.ts]
```

From this graph, calculate for each file:
- **Fan-in** (how many files import THIS file) — high = load-bearing
- **Fan-out** (how many files THIS file imports) — high = coupled
- **Depth** (longest import chain to reach this file from entry point)

### 4b: Symbol-Level Export Extraction
For each source file, extract its exported symbols (functions, classes, types, constants). This enables `/buildflow-modify` to trace impact at the function level, not just the file level.

```bash
# TypeScript / JavaScript — exported symbols
grep -rn "^export (async )?function\|^export class\|^export const\|^export type\|^export interface\|^export enum\|^export default" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Python — public functions and classes (no leading underscore)
grep -rn "^def [^_]\|^class [^_]\|^async def [^_]" src/ --include="*.py"

# Go — exported (uppercase) functions and types
grep -rn "^func [A-Z]\|^type [A-Z]" --include="*.go" .

# Rust — public functions, structs, enums
grep -rn "^pub fn\|^pub struct\|^pub enum\|^pub trait\|^pub type" src/ --include="*.rs"

# Java — public classes, methods, interfaces
grep -rn "^public class\|^public interface\|^public enum\|public [a-zA-Z].*(.*).*{" src/main/ --include="*.java" | head -50

# Kotlin — public/top-level functions, classes, data classes
grep -rn "^fun [A-Z]\|^class \|^data class \|^object \|^interface \|^enum class " src/main/ --include="*.kt" | grep -v "//\|private\|internal" | head -50

# C# — public classes, methods, interfaces, enums
grep -rn "public class \|public interface \|public enum \|public static.*\|public .*(" src/ --include="*.cs" | grep -v "//\|override\|abstract" | head -50

# Ruby — public methods and classes
grep -rn "^class \|^module \|^  def [^_]\|^def [^_]" app/ lib/ --include="*.rb" 2>/dev/null | grep -v "private\|protected" | head -50

# PHP — public classes, methods, functions
grep -rn "^class \|^interface \|^trait \|^function \|public function " app/ src/ --include="*.php" 2>/dev/null | head -50

# Dart / Flutter — public classes, functions (no leading underscore)
grep -rn "^class [^_]\|^mixin [^_]\|^extension [^_]\|^[A-Za-z].*[^_]([^_]" lib/ --include="*.dart" 2>/dev/null | grep -v "//\|_\b" | head -50

# Swift — public/open functions, classes, structs, protocols
grep -rn "^public class\|^public struct\|^public func\|^public protocol\|^open class\|^open func\|^func [A-Z]" Sources/ --include="*.swift" 2>/dev/null | head -50

# Scala — public defs, classes, objects, traits
grep -rn "^def \|^class \|^object \|^trait \|^case class " src/main/ --include="*.scala" 2>/dev/null | grep -v "private\|protected" | head -50
```

For each symbol, record:
- `name` — symbol name
- `type` — `function` | `class` | `type` | `const` | `interface` | `enum`
- `line` — line number in file
- `exported` — true (only track exported/public symbols)

### 4c: Symbol Caller Index
Build a reverse map of which files call each exported symbol:

```bash
# For each exported symbol "MyFunction" from "auth/service.ts":
# Find all files that reference it (not the defining file itself)
grep -rn "MyFunction\|AuthService\|DBClient" src/ --include="*.ts" --include="*.py" --include="*.go" | grep -v "auth/service.ts"
```

Build `symbol_callers` index:
```
AuthService.login()    called by: [routes/auth.ts:45, middleware/session.ts:12, tests/auth.test.ts:8]
AuthService.register() called by: [routes/auth.ts:62, tests/auth.test.ts:20]
DBClient.query()       called by: [auth/service.ts:34, users/service.ts:18, orders/service.ts:7]
```

This is the key input for `/buildflow-modify` — when a function signature changes, the caller index shows exactly which lines need updating, not just which files.

---

## Step 5: Load-Bearing Module Identification
Files with fan-in ≥ 5 are **load-bearing** — changes ripple widely.

```
Load-Bearing Modules
────────────────────
db.client.ts     fan-in: 12   ← CRITICAL — 12 files depend on this
auth.service.ts  fan-in: 8    ← HIGH
config.ts        fan-in: 15   ← CRITICAL
types.ts         fan-in: 20   ← CRITICAL (type-only, lower risk)
```

---

## Step 6: Module Boundary Mapping
Identify **bounded contexts** — groups of files that form a logical subsystem:

```
Module: Auth
  Owns:  src/auth/*.ts
  Exports: AuthService, AuthMiddleware, JWTUtil
  Depends on: Database, Config
  Depended on by: API routes, WebSocket handlers

Module: Database
  Owns:  src/db/*.ts
  Exports: DBClient, QueryBuilder, Migrations
  Depends on: Config
  Depended on by: Auth, Users, Orders (everything)

Module: API
  Owns:  src/routes/*.ts
  Exports: Router
  Depends on: Auth, Users, Orders
  Depended on by: main.ts (entry point only)
```

Flag **boundary violations**: files that import across module lines without going through the module's public export.

---

## Step 7: Pattern Recognition
Read 2–3 representative files per module. Document:
- Component/class structure conventions
- Naming patterns (PascalCase, camelCase, snake_case, kebab-case)
- Import organization order (stdlib → 3rd party → internal)
- Error handling approach (throw vs return, error types used)
- Async pattern (async/await, Promise chains, callbacks)
- Test file conventions (co-located vs `__tests__/`, naming)
- Comment style (JSDoc, inline, none)

---

## Step 8: Risk Scoring
Score each file on a 1–5 risk scale:

| Factor | Low (1) | High (5) |
|--------|---------|---------|
| Fan-in | 0–1 dependents | 10+ dependents |
| File size | < 100 lines | > 500 lines |
| Test coverage | Tests exist | No tests found |
| Complexity | Simple logic | Deep nesting, many branches |
| Change frequency | Rarely changed | Frequently changed |

Final risk score = average of applicable factors.

```
File Risk Map
─────────────
db.client.ts      risk: 4.8  ← touch with extreme care
auth.service.ts   risk: 4.2  ← high-impact changes
config.ts         risk: 4.0  ← high fan-in, usually stable
UserController.ts risk: 2.1  ← isolated, well-tested
utils/format.ts   risk: 1.0  ← pure functions, low coupling
```

---

## Step 9: Write Knowledge Files

This step is mandatory. Do not return only an analysis summary. Create or update the files listed below using the Write tool. If any write fails, report the exact file and error instead of saying onboarding is complete.

All `.buildflow/codebase/*.md` knowledge files must start with YAML frontmatter:

```yaml
---
generated_by: buildflow-onboard
last_mapped_at: [ISO date]
last_mapped_commit: [git HEAD sha or unknown]
scope: [full repo or comma-separated paths]
---
```

Preserve existing frontmatter keys when updating a document. This keeps the drift baseline attached to the document instead of only in `intel.json`.

### `.buildflow/codebase/MAP.md`
```markdown
# Codebase Map
**Project:** [name]  **Onboarded:** [date]  **Files analyzed:** [N]

## Feature Inventory Summary
[top-level user-facing capabilities from FEATURES.md, including local support status]

## Entry Points
- [file]: [purpose]

## Module Boundaries
[module table from Step 6]

## Load-Bearing Modules
[critical file list from Step 5]

## Folder Structure
[annotated tree — one line per folder explaining its role]

## Key Patterns
- [pattern name]: [brief description]
```

### `.buildflow/codebase/STACK.md`
Technology foundation. This is the human-readable stack map that complements `intel.json.tech_stack`.

```markdown
# Stack

## Languages & Runtimes
| Language/Runtime | Version | Evidence |
|------------------|---------|----------|

## Frameworks & Build Tools
| Tool | Purpose | Evidence |
|------|---------|----------|

## Package Managers & Lockfiles
- [npm/pnpm/yarn/pip/poetry/maven/gradle/go/cargo/etc.] — [evidence path]

## Critical Dependencies
| Dependency | Purpose | Runtime/Dev | Evidence |
|------------|---------|-------------|----------|

## Platform Requirements
- Development: [OS/tooling/runtime requirements]
- Production: [deployment/runtime requirements]
```

### `.buildflow/codebase/STRUCTURE.md`
Physical layout map used for structural drift detection.

```markdown
# Structure

## Directory Map
| Path | Responsibility | Owner Module | Notes |
|------|----------------|--------------|-------|

## Entry Points
- [path] — [why it starts or wires the system]

## Generated / Static Assets
- [path] — [locale labels, fixtures, generated clients, public assets, etc.]

## Path Conventions
- [source layout, test layout, route layout, package layout]
```

### `.buildflow/codebase/INTEGRATIONS.md`
External systems, runtime services, and environment contracts.

```markdown
# Integrations

## External Services
| Service | Purpose | SDK/Client | Auth/Env Contract | Evidence |
|---------|---------|------------|-------------------|----------|

## Data Stores
| Store | Client/ORM | Migrations | Evidence |
|-------|------------|------------|----------|

## Webhooks / Callbacks
| Direction | Service | Endpoint | Verification | Evidence |
|-----------|---------|----------|--------------|----------|

## Environment Contracts
- [ENV_VAR] — [purpose, required/optional, evidence path; never include secret values]
```

### `.buildflow/codebase/TESTING.md`
Dedicated test and validation map.

```markdown
# Testing

## Frameworks
| Framework | Type | Command | Evidence |
|-----------|------|---------|----------|

## Test Layout
- [path pattern] — [unit/integration/e2e/fixture]

## Targeted Test Strategy
- Source file → likely test file convention
- Dependency-neighborhood test command

## Gaps
- [missing test framework/coverage/e2e/fixtures]
```

### `.buildflow/codebase/CONCERNS.md`
Risk, debt, fragile flows, and map blind spots.

```markdown
# Concerns

## High-Risk Areas
| Area/File | Concern | Evidence | Suggested Guard |
|-----------|---------|----------|-----------------|

## Security / Performance / Reliability Concerns
- [concern] — [evidence]

## Mapping Blind Spots
- [generated routes, dynamic imports, runtime plugin loading, feature flags, missing tests]
```

### `.buildflow/codebase/GRAPH.md`
Full import dependency graph output from Steps 4a–4c.
Includes fan-in / fan-out counts per file (file-level) AND symbol caller index (symbol-level).

Structure:
```markdown
## File-Level Import Graph
[file dependency map with fan-in / fan-out counts]

## Symbol Caller Index
AuthService.login      → src/routes/auth.ts:45, src/routes/auth.ts:89, src/tests/auth.test.ts:8
AuthService.register   → src/routes/auth.ts:62, src/tests/auth.test.ts:20
createToken            → src/auth/service.ts:31, src/middleware/session.ts:18
DBClient.query         → src/auth/service.ts:34, src/users/service.ts:18, src/orders/service.ts:7
```

`/buildflow-modify` Step 2 uses `symbol_callers` from `intel.json` for precise call-site lookup (file:line pairs). GRAPH.md is the human-readable version of the same data.

### `.buildflow/codebase/PATTERNS.md`
All conventions from Step 7. Used by Builder and Surgeon agents to match style.
Each pattern has an example extracted from the actual codebase.

### `.buildflow/codebase/FEATURES.md`
User-facing and operator-facing capability map from Lens E. This is required output.

```markdown
# Feature Inventory

## Summary
| Feature | Status | Entry Points | Owned Modules | Evidence |
|---------|--------|--------------|---------------|----------|
| Local development support | implemented | npm run dev, docker-compose.dev.yml | Runtime, Config | README.md, package.json, docker-compose.dev.yml |

## Discovery Notes
- Confidence model: high = multiple evidence types, medium = one executable signal, low = docs/test-only signal
- Blind spots: [generated routes / dynamic plugins / feature flags / external services / runtime-only behavior]

## Local Support
Status: YES / PARTIAL / NO
Confidence: high / medium / low

Evidence:
- [path:line] local run script
- [path:line] Docker/dev compose
- [path:line] local env config
- [path:line] seed/mock fixture

Gaps:
- [missing item if any]

## Locale Support
Status: YES / PARTIAL / NO
Confidence: high / medium / low
Default locale: [locale code or UNKNOWN]
Supported locales: [en, fr, ... or UNKNOWN]
Detected stacks: [Java/Spring, Go, Python, Rails, Laravel, .NET, Flutter, iOS, Android, JS/TS, or UNKNOWN]
Localized docs: YES / PARTIAL / NO
Label/copy catalogs: YES / PARTIAL / NO

Evidence:
- [path:line] i18n provider/middleware/config
- [path:line] imported static JSON catalog
- [path:line] locale/message bundle
- [path:line] language switcher or route prefix
- [path:line] language-specific i18n dependency/import
- [path:line] localized README/docs language link or translated doc
- [path:line] label/copy catalog or command/UI label definition

Static assets:
- [path] [locale/catalog purpose]

Dependencies/imports:
- [dependency/import/API] [language/framework] [evidence path]

Labels and copy:
- [path:line] [label/copy purpose, e.g., "command option labels", "form labels", "menu labels"]

Localized docs:
- [path] [locale/language and purpose]

Gaps:
- [missing fallback/default locale/tests if any]

## Features
### [Feature name]
Aliases: [alternate names from docs/tests/code]
Status: implemented / partial / docs-only / documented_missing / test-only
Confidence: high / medium / low
User value: [what this enables]
Entry points:
- [route / screen / command / script]
Evidence:
- [path:line] [why this proves the feature exists]
Owned modules:
- [module names]
Tests:
- [test paths or NONE]
Risks:
- [risk or NONE]
Blind spots:
- [what static mapping could not prove, or NONE]
```

### `.buildflow/codebase/DEPENDENCIES.md`
All dependencies from Step 3 with purpose, criticality, and security status.

### `.buildflow/codebase/HOTSPOTS.md`
```markdown
# Hotspots — Handle With Care
Files scored 3.5+ risk. Review before any modification.

| File | Risk | Fan-in | Size | Tests | Notes |
|------|------|--------|------|-------|-------|
| db.client.ts | 4.8 | 12 | 380L | partial | Central DB abstraction |
```

### `.buildflow/codebase/intel.json` — Queryable Intel Index

Write a machine-readable JSON index alongside the markdown files. This enables `/buildflow-modify`, `/buildflow-build`, and `/buildflow-check` to query specific facts without loading all markdown files.

```json
{
  "onboarded_at": "[ISO date]",
  "last_mapped_commit": "[git HEAD sha or unknown]",
  "scope": {
    "mode": "full",
    "paths": []
  },
  "file_count": 0,
  "modules": [
    {
      "name": "Auth",
      "owns": ["src/auth/service.ts", "src/auth/middleware.ts"],
      "exports": ["AuthService", "AuthMiddleware"],
      "depends_on": ["Database", "Config"],
      "depended_on_by": ["API", "WebSocket"]
    }
  ],
  "features": [
    {
      "name": "Local development support",
      "aliases": ["local mode", "dev environment"],
      "status": "implemented",
      "confidence": "high",
      "user_value": "Run the application and dependencies locally for development and testing",
      "entry_points": ["npm run dev", "docker-compose.dev.yml"],
      "owned_modules": ["Runtime", "Config"],
      "evidence": [
        { "file": "package.json", "line": 12, "note": "dev script" },
        { "file": "docker-compose.dev.yml", "line": 1, "note": "local service stack" }
      ],
      "tests": [],
      "risks": [],
      "blind_spots": []
    }
  ],
  "local_support": {
    "status": "yes",
    "confidence": "high",
    "dev_scripts": ["npm run dev"],
    "local_services": ["docker-compose.dev.yml"],
    "env_files": [".env.example"],
    "seed_or_fixture_files": [],
    "evidence": [
      { "file": "README.md", "line": 10, "note": "local run instructions" }
    ],
    "gaps": [],
    "blind_spots": []
  },
  "locale_support": {
    "status": "yes",
    "confidence": "high",
    "default_locale": "en",
    "supported_locales": ["en"],
    "detected_stacks": ["TypeScript"],
    "localized_docs": ["README.ja-JP.md", "README.ko-KR.md"],
    "label_catalogs": ["src/labels.json"],
    "catalog_files": ["src/locales/en.json"],
    "importers": [
      { "file": "src/i18n/index.ts", "line": 3, "note": "imports locale JSON catalog" }
    ],
    "provider_files": ["src/i18n/index.ts"],
    "dependencies_or_apis": [
      { "name": "react-i18next", "language": "TypeScript", "evidence_file": "package.json" }
    ],
    "labels_or_copy": [
      { "file": "src/labels.json", "line": 1, "note": "static UI label catalog" }
    ],
    "evidence": [
      { "file": "src/locales/en.json", "line": 1, "note": "static translation catalog" }
    ],
    "gaps": [],
    "blind_spots": []
  },
  "load_bearing": [
    { "file": "src/db/client.ts", "fan_in": 12, "risk": 4.8 }
  ],
  "hotspots": [
    { "file": "src/db/client.ts", "risk": 4.8, "fan_in": 12, "lines": 380, "has_tests": false }
  ],
  "file_index": [
    {
      "path": "src/auth/service.ts",
      "module": "Auth",
      "fan_in": 8,
      "fan_out": 3,
      "risk": 4.2,
      "has_tests": true,
      "test_file": "src/auth/service.test.ts",
      "exports": ["AuthService", "createToken"],
      "imports": ["src/db/client.ts", "src/config.ts"],
      "symbols": [
        {
          "name": "AuthService",
          "type": "class",
          "line": 12,
          "exported": true
        },
        {
          "name": "AuthService.login",
          "type": "function",
          "line": 24,
          "exported": true,
          "signature": "login(email: string, password: string): Promise<AuthToken>"
        },
        {
          "name": "AuthService.register",
          "type": "function",
          "line": 45,
          "exported": true,
          "signature": "register(email: string, password: string, name: string): Promise<User>"
        },
        {
          "name": "createToken",
          "type": "function",
          "line": 78,
          "exported": true,
          "signature": "createToken(userId: string): string"
        }
      ]
    }
  ],
  "symbol_callers": {
    "AuthService.login": [
      { "file": "src/routes/auth.ts", "line": 45 },
      { "file": "src/tests/auth.test.ts", "line": 8 }
    ],
    "AuthService.register": [
      { "file": "src/routes/auth.ts", "line": 62 },
      { "file": "src/tests/auth.test.ts", "line": 20 }
    ],
    "createToken": [
      { "file": "src/auth/service.ts", "line": 31 },
      { "file": "src/middleware/session.ts", "line": 18 }
    ]
  },
  "tech_stack": {
    "language": "TypeScript",
    "framework": "Express",
    "test_framework": "Jest",
    "orm": "Prisma",
    "bundler": "esbuild"
  },
  "integrations": [
    {
      "name": "Stripe",
      "type": "external_api",
      "purpose": "payments",
      "sdk_or_client": "stripe",
      "env_contract": ["STRIPE_SECRET_KEY"],
      "evidence": [{ "file": "src/payments/stripe.ts", "line": 1 }]
    }
  ],
  "testing": {
    "framework": "Jest",
    "commands": ["npm test"],
    "test_file_patterns": ["*.test.ts"],
    "fixture_paths": ["test/fixtures"],
    "gaps": []
  },
  "structure": {
    "directories": [
      { "path": "src/routes", "responsibility": "HTTP route handlers", "module": "API" }
    ],
    "entry_points": ["src/main.ts"],
    "static_assets": ["public/"]
  },
  "map_documents": {
    "MAP.md": { "purpose": "summary", "last_mapped_commit": "[sha]" },
    "STACK.md": { "purpose": "tech stack", "last_mapped_commit": "[sha]" },
    "STRUCTURE.md": { "purpose": "physical layout", "last_mapped_commit": "[sha]" },
    "INTEGRATIONS.md": { "purpose": "external systems", "last_mapped_commit": "[sha]" },
    "TESTING.md": { "purpose": "test profile", "last_mapped_commit": "[sha]" },
    "CONCERNS.md": { "purpose": "risk and blind spots", "last_mapped_commit": "[sha]" }
  },
  "security_surface": {
    "auth_files": ["src/auth/middleware.ts"],
    "secret_ref_files": [],
    "dangerous_patterns": []
  },
  "schema": {
    "orm": "Prisma",
    "schema_file": "prisma/schema.prisma",
    "migration_count": 5,
    "last_migration": "20240101_add_users"
  },
  "drift_baseline": {
    "recorded_at": "[ISO date]",
    "last_mapped_commit": "[git HEAD sha or unknown]",
    "structure_paths": ["src/", "app/", "packages/ui/"],
    "drift_categories": ["new_dir", "route", "migration", "barrel", "dependency", "integration", "test", "copy_locale"],
    "file_hashes": {
      "prisma/schema.prisma": "[sha256]",
      "src/db/schema.ts": "[sha256]"
    }
  }
}
```

**Usage by other commands:**
- `/buildflow-modify` reads `file_index[].symbols` + `symbol_callers` to trace impact at function level — shows exactly which lines call a changing function
- `/buildflow-spec` and `/buildflow-plan` read `features[]`, `local_support`, and `locale_support` to avoid re-specing shipped capabilities and to preserve local/dev/i18n support during changes
- `/buildflow-modify` falls back to file-level `file_index` fan-in/fan-out if intel.json predates symbol tracking (built before this GAP-H version)
- `/buildflow-build` reads `hotspots` to warn before touching high-risk files
- `/buildflow-check` reads `schema.drift_baseline` to detect schema file changes
- `/buildflow-start` reads `tech_stack` to populate context packet fields
- `/buildflow-onboard --query` searches `intel.json` plus all `.buildflow/codebase/*.md` files for terms without loading the whole source tree
- `/buildflow-build` and `/buildflow-check` use `STRUCTURE.md` + frontmatter `last_mapped_commit` to warn about structural drift and suggest scoped remaps

Update `intel.json` on every `--update` or `--paths` run, not just full re-onboards.

### Secret Scan Generated Maps

Before declaring onboarding complete, scan generated map files for likely secrets:

```bash
grep -E "(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.)" .buildflow/codebase/*.md .buildflow/codebase/intel.json 2>/dev/null
```

If matches are found, stop and show the file/line references. Do not include secret values in summaries. Ask the user to confirm false positive or redact before continuing.

---

## Step 10: Drift Baseline

After onboarding (and after every `--update`), record a drift baseline in `intel.json` under `drift_baseline`:

1. Hash all schema-defining files: `schema.prisma`, `*.entity.ts`, `models.py`, `schema.sql`
2. Record file count per module
3. Record the set of exported **symbols** per load-bearing file (function names and signatures, not just file names) — this is the symbol-level drift baseline

This baseline is read by `/buildflow-start` at every session to detect silent drift.

```json
"drift_baseline": {
  "recorded_at": "[ISO date]",
  "file_hashes": {
    "prisma/schema.prisma": "[sha256 of file content]"
  },
  "module_file_counts": {
    "Auth": 4,
    "Database": 2
  },
  "load_bearing_exports": {
    "src/db/client.ts": {
      "symbols": ["DBClient", "QueryBuilder", "runMigration"],
      "signatures": {
        "DBClient.query": "query(sql: string, params?: any[]): Promise<Row[]>",
        "QueryBuilder.select": "select(table: string): QueryBuilder"
      }
    }
  }
}
```

**Drift signals from symbol-level baseline (detected by `/buildflow-start`):**
- New symbol added to a load-bearing file → INFO (new export, check callers)
- Symbol removed from a load-bearing file → WARN (callers may break)
- Signature changed for a load-bearing symbol → WARN (callers likely need updates)

These signals surface silent API breakage before build failures happen.

---

## Step 11: Update Memory
```yaml
onboarded: true
onboarded_date: [today]
file_count: [N]
module_count: [N]
load_bearing_files: [N]
hotspot_count: [N]
codebase_summary: [2-line summary]
intel_index: .buildflow/codebase/intel.json
```

---

## Step 12: Onboarding Summary
Report:
```
Onboarding Complete
───────────────────
Files analyzed:      [N]
Modules identified:  [N]
Load-bearing files:  [N]  (fan-in ≥ 5)
High-risk hotspots:  [N]  (risk score ≥ 3.5)
Boundary violations: [N]  (files importing across module lines)
Test coverage est.:  [N]% (files with co-located tests)
Patterns captured:   [N]

⚠ Caution zones: [top 3 highest-risk files]
✓ Safe to modify:  [modules with low risk scores]

Next steps:
  /buildflow-modify  — make targeted changes
  /buildflow-spec    — define a new phase
  /buildflow-refactor — improve code quality
```

## Token cost report (print at end of onboard)

Measure actual cost before printing:
1. Sum character counts of all files read during onboarding ÷ 4 = input tokens
2. Estimate output from text generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Onboard complete — [N] files · [N] modules · [N] hotspots · intel.json written
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in preferences.md):
```
Token Cost — /buildflow-onboard
────────────────────────────────
Files analyzed: [N]  Modules: [N]  Hotspots: [N]  Lenses: 5
Context loaded:    ~[N]K tokens   ([N] source files scanned)
Output generated:  ~[N]K tokens   (MAP.md + STACK.md + STRUCTURE.md + INTEGRATIONS.md + TESTING.md + CONCERNS.md + GRAPH.md + FEATURES.md + intel.json + HOTSPOTS.md)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

Update `light.md`: `last_onboard_tokens: ~[N]K`

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-modify  (or /buildflow-plan if starting a new phase)
   Why:  Codebase is now indexed — surgical changes have full impact tracing
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If this is a first-time onboard on an existing project: `→ Next: /buildflow-spec` to define what to build next.

## Acceptance Criteria for Onboarding Quality

Before declaring onboarding complete, verify:
- `FEATURES.md` exists and lists at least every route/screen/CLI command/workflow discovered in Lens E.
- `FEATURES.md` has a `## Local Support` section with status YES/PARTIAL/NO and evidence.
- `FEATURES.md` has a `## Locale Support` section when locale catalogs, i18n imports, or translation JSON files are present.
- `STACK.md`, `STRUCTURE.md`, `INTEGRATIONS.md`, `TESTING.md`, and `CONCERNS.md` exist with non-empty sections and YAML frontmatter.
- `intel.json.features[]` is non-empty unless the repo is a pure library; if pure library, explain why.
- `intel.json.local_support.status` is present.
- `intel.json.locale_support.status` is present when locale/i18n evidence exists.
- `intel.json.map_documents`, `structure`, `integrations`, and `testing` are present.
- Every feature has at least one evidence path or is explicitly marked `documented_missing`.
- MAP.md includes a Feature Inventory Summary.
- Secret scan over generated map files passed or user confirmed false positives.

If any item is missing, do not say "Onboarding Complete." Fix the map first.

## Token Budget: ~45K (one-time — pays back on every subsequent session)
