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

## Step 2: Structural Analysis
```bash
# Entry points
find . -name "main.*" -o -name "index.*" -o -name "app.*" | grep -v node_modules
# File count by type
find src/ -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

Map:
- Entry points (where execution begins)
- Top-level folder responsibilities (what each `src/` subdirectory owns)
- Configuration files and what they control
- Build/bundler setup

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

## Step 4: Import Graph Analysis (repo awareness core)
For each source file, trace its imports and exports:

```bash
# JS/TS: find all import statements
grep -rn "^import\|^const.*require" src/ --include="*.ts" --include="*.js"
# Python
grep -rn "^import\|^from" src/ --include="*.py"
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
Full import dependency graph output from Step 4.
Includes fan-in / fan-out counts per file.
This is what impact analysis reads during `/buildflow-modify`.

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

---

## Step 10: Update Memory
```yaml
onboarded: true
onboarded_date: [today]
file_count: [N]
module_count: [N]
load_bearing_files: [N]
hotspot_count: [N]
codebase_summary: [2-line summary]
```

---

## Step 11: Onboarding Summary
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

## Token Budget: ~40K (one-time — pays back on every subsequent session)
