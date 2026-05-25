---
name: buildflow-onboard
description: Deep codebase analysis — import graph, module boundaries, load-bearing files, risk scores
allowed-tools: Read, Bash, Glob, Grep
agent: cartographer
---

# /buildflow-onboard

Deep one-time analysis of an existing codebase. Goes beyond folder structure — maps import graphs, identifies load-bearing modules, scores file risk, and establishes module boundaries. All other agents reference these outputs.

## When to Run
- First time using BuildFlow on an existing project
- After a major refactor or framework migration
- `--update` flag for incremental refresh after significant changes

## Usage
- `/buildflow-onboard` — full analysis
- `/buildflow-onboard --update` — refresh changed files only
- `/buildflow-onboard --depth imports` — focus on dependency graph only

---

## Step 1: Prior State Check
If `.buildflow/codebase/MAP.md` exists:
- `--update` flag: skip to Step 6 (incremental refresh)
- Otherwise ask: "Full re-onboard or incremental update?"

---

## Step 2: Structural Analysis — 4 Parallel Lenses

Run these four analyses in parallel. Each lens produces a focused view that the others don't cover.

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

**Lens Summary (printed after all 4 complete):**
```
4-Lens Analysis Complete
────────────────────────
Architecture:  [pattern detected — MVC / layered / flat / feature-based]
Quality:       [N files, ~N% have tests, N TODO/FIXME markers]
Security:      [N auth files, N potential secret refs, N dangerous patterns]
Data:          [ORM: Prisma/SQLAlchemy/GORM, N migrations, schema at: path]
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

### `.buildflow/codebase/MAP.md`
```markdown
# Codebase Map
**Project:** [name]  **Onboarded:** [date]  **Files analyzed:** [N]

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
    "file_hashes": {
      "prisma/schema.prisma": "[sha256]",
      "src/db/schema.ts": "[sha256]"
    }
  }
}
```

**Usage by other commands:**
- `/buildflow-modify` reads `file_index[].symbols` + `symbol_callers` to trace impact at function level — shows exactly which lines call a changing function
- `/buildflow-modify` falls back to file-level `file_index` fan-in/fan-out if intel.json predates symbol tracking (built before this GAP-H version)
- `/buildflow-build` reads `hotspots` to warn before touching high-risk files
- `/buildflow-check` reads `schema.drift_baseline` to detect schema file changes
- `/buildflow-start` reads `tech_stack` to populate context packet fields

Update `intel.json` on every `--update` run, not just full re-onboards.

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
Files analyzed: [N]  Modules: [N]  Hotspots: [N]  Lenses: 4
Context loaded:    ~[N]K tokens   ([N] source files scanned)
Output generated:  ~[N]K tokens   (MAP.md + GRAPH.md + intel.json + HOTSPOTS.md)
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

## Token Budget: ~40K (one-time — pays back on every subsequent session)
