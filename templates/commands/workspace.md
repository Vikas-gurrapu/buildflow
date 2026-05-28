---
name: buildflow-workspace
description: Multi-repo awareness — map cross-repo dependencies, detect interface contracts, coordinate changes across services
allowed-tools: Read, Write, Bash, Grep, Glob
agent: cartographer
---

# /buildflow-workspace

Multi-repo coordination for monorepos and polyrepos. Maps cross-service dependencies, detects shared interface contracts, and identifies which repos must change together when you modify a shared API or type.

Use this when:
- You have a frontend + backend in separate repos
- You're working in a monorepo with multiple packages/services
- A change in one service may break another
- You need to understand the blast radius of a shared library change

## Usage
- `/buildflow-workspace` — discover and map all repos/packages in the workspace
- `/buildflow-workspace onboard` — discover repos, multiselect which to onboard, run /buildflow-onboard for each selected
- `/buildflow-workspace onboard --update` — same discovery, but run --update for already-onboarded repos
- `/buildflow-workspace add <path>` — register an additional repo path
- `/buildflow-workspace impact <change-description>` — cross-repo impact analysis
- `/buildflow-workspace contracts` — show all shared API contracts between repos
- `/buildflow-workspace sync` — refresh all repo intel indexes

## Context Packet
- `.buildflow/workspace/WORKSPACE.md` (if exists)
- `.buildflow/workspace/contracts.json` (if exists)
- Each registered repo's `.buildflow/codebase/intel.json`

---

## Step 1: Workspace Discovery

Detect repo/package layout:

```bash
# Monorepo with packages/
ls packages/ apps/ services/ libs/ 2>/dev/null

# Multiple repos as siblings (polyrepo)
ls ../  # look for sibling directories with their own package.json / go.mod / Cargo.toml

# Turborepo / Nx / pnpm workspaces
cat package.json | grep -E "workspaces"
cat pnpm-workspace.yaml 2>/dev/null
cat turbo.json 2>/dev/null
cat nx.json 2>/dev/null
```

**Workspace types:**

| Type | Detection | Structure |
|------|-----------|-----------|
| pnpm/npm workspaces | `workspaces` in package.json | `packages/*` |
| Turborepo | `turbo.json` | `apps/*` + `packages/*` |
| Nx | `nx.json` | `libs/*` + `apps/*` |
| Go workspace | `go.work` | multiple modules |
| Rust workspace | `[workspace]` in Cargo.toml | `crates/*` |
| Polyrepo | sibling dirs with own manifests | no shared root |

---

## Step 2: Per-Repo Intel

For each discovered repo/package:
1. Check if `.buildflow/codebase/intel.json` exists
   - YES: load it (fast path — already onboarded)
   - NO: run a lightweight scan (not full onboard):
     ```bash
     # Quick scan — entry point, exports, tech stack only
     find [repo]/ -name "package.json" -o -name "go.mod" -o -name "Cargo.toml" | head -1
     find [repo]/src -name "index.*" -o -name "main.*" | head -3
     ```

Build a per-repo summary:
```
Repo: frontend (apps/web)
  Tech:     Next.js / TypeScript
  Entry:    apps/web/src/app/layout.tsx
  Onboarded: YES (intel.json exists)
  Last seen: 2024-01-15

Repo: api (apps/api)
  Tech:     Node.js / Express / TypeScript
  Entry:    apps/api/src/main.ts
  Onboarded: YES
  Last seen: 2024-01-15

Repo: shared (packages/types)
  Tech:     TypeScript (types only)
  Entry:    packages/types/src/index.ts
  Onboarded: NO — lightweight scan only
```

---

## Step 3: Contract Detection

Identify shared contracts — interfaces, types, and API specs consumed across repo boundaries.

### Shared TypeScript types/packages:
```bash
# Find imports that cross repo boundaries
grep -rn "from '@[workspace-name]/" apps/ packages/ --include="*.ts" | head -30
grep -rn "from '../../packages/" apps/ --include="*.ts" | head -20
```

### REST API contracts:
```bash
# OpenAPI specs
find . -name "openapi.yml" -o -name "openapi.json" -o -name "swagger.yml" | grep -v node_modules
# tRPC routers
grep -rn "createTRPCRouter\|publicProcedure\|protectedProcedure" --include="*.ts" | head -10
# GraphQL schemas
find . -name "schema.graphql" -o -name "*.graphql" | grep -v node_modules | head -5
```

### gRPC / Protobuf:
```bash
find . -name "*.proto" | head -10
```

For each contract found, record:
```json
{
  "contract_id": "UserType",
  "type": "typescript-export",
  "defined_in": "packages/types/src/user.ts",
  "consumed_by": ["apps/web/src/components/UserCard.tsx", "apps/api/src/routes/users.ts"],
  "breaking_change_risk": "HIGH"
}
```

---

## Step 4: Cross-Repo Dependency Graph

Build a directed graph of which repos consume which:
```
packages/types  ──exports──►  apps/web
                ──exports──►  apps/api

apps/api  ──REST API──►  apps/web (fetch calls to /api/*)
          ──REST API──►  apps/mobile

packages/ui  ──components──►  apps/web
             ──components──►  apps/mobile
```

Identify **cross-repo hotspots**: packages with fan-in ≥ 3 (consumed by 3+ repos). Changes here have maximum blast radius.

---

## Step 5: Write Workspace Files

### `.buildflow/workspace/WORKSPACE.md`
```markdown
# Workspace Map
**Type:** [monorepo / polyrepo]  **Repos:** [N]  **Mapped:** [date]

## Repos
| Name | Path | Tech | Onboarded | Entry |
|------|------|------|-----------|-------|
| frontend | apps/web | Next.js | YES | src/app/layout.tsx |

## Cross-Repo Hotspots
| Package | Fan-in | Risk |
|---------|--------|------|
| packages/types | 4 | HIGH |

## Dependency Graph
[text diagram from Step 4]
```

### `.buildflow/workspace/contracts.json`
Full contract list from Step 3 as JSON. Queried by `/buildflow-workspace impact`.

---

## Step 6: Impact Analysis Mode (`/buildflow-workspace impact <change>`)

When run with a change description:

1. Identify which file/function/type is changing
2. Look up that file in each repo's `intel.json` and in `contracts.json`
3. Trace the impact chain across repos:

```
Cross-Repo Impact: "Add `profilePhotoUrl` field to UserType"
────────────────────────────────────────────────────────────
Origin:
  packages/types/src/user.ts  (defines UserType)

Direct consumers (repos that import UserType):
  apps/web  → src/components/UserCard.tsx, src/pages/profile.tsx
  apps/api  → src/routes/users.ts, src/services/user.service.ts

Indirect consumers:
  apps/mobile  → imports from apps/api's REST response shape

Action required per repo:
  packages/types:   Add field to UserType interface
  apps/web:         Update UserCard to show photo, update profile page
  apps/api:         Add field to DB schema + migration, update serializer
  apps/mobile:      Update user type local copy (if not using shared types)

Suggested build order:
  1. packages/types  (define contract first)
  2. apps/api        (implement + migrate)
  3. apps/web        (consume)
  4. apps/mobile     (consume)
```

---

## Step 7: Sync Mode (`/buildflow-workspace sync`)

Re-runs lightweight intel collection for all repos that have changed since last map:
```bash
git log --since="[last workspace map date]" --name-only --format="" | grep -E "^(apps|packages|services)/" | cut -d/ -f1-2 | sort -u
```

For each changed repo: update its summary in WORKSPACE.md and refresh `contracts.json`.

---

---

## Workspace Onboard Mode (`/buildflow-workspace onboard`)

Discovers all repos/packages in the workspace, presents a **multiselect list**, and runs `/buildflow-onboard` for each selected repo — so you never have to `cd` into each repo individually.

### Step O1: Discover Repos

Scan for subdirectories containing a recognizable project manifest:

```bash
find . -maxdepth 3 -type f \( \
  -name "package.json" \
  -o -name "go.mod" \
  -o -name "Cargo.toml" \
  -o -name "pom.xml" \
  -o -name "build.gradle" \
  -o -name "build.gradle.kts" \
  -o -name "pyproject.toml" \
  -o -name "requirements.txt" \
  -o -name "pubspec.yaml" \
  -o -name "Package.swift" \
  -o -name "build.sbt" \
  -o -name "Gemfile" \
  -o -name "composer.json" \
\) 2>/dev/null | grep -v node_modules | grep -v "\.buildflow" | grep -v "\.git" \
  | grep -v "dist/" | grep -v "build/" | grep -v "target/" | grep -v "\.next/" \
  | sed 's|/[^/]*$||' | sort -u
```

Exclude the workspace root itself (only include subdirectories).

For each discovered path, detect stack from which manifest was found:

| Manifest | Stack |
|---|---|
| `package.json` | Node.js / JS / TS |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml` / `build.gradle*` | Java / Kotlin |
| `pyproject.toml` / `requirements.txt` | Python |
| `pubspec.yaml` | Dart / Flutter |
| `Package.swift` | Swift |
| `Gemfile` | Ruby |
| `composer.json` | PHP |
| `build.sbt` | Scala |

Also include paths registered in `.buildflow/workspace/WORKSPACE.md` (if it exists) that are not yet in the discovered list.

Mark onboard status per repo:
- `intel.json` exists at `[repo]/.buildflow/codebase/intel.json` → **ONBOARDED** (show `onboarded_at` date)
- `.buildflow/` exists but no `intel.json` → **PARTIAL**
- No `.buildflow/` → **NOT ONBOARDED**

---

### Step O2: Multiselect Prompt

Present all discovered repos as a numbered multiselect list. User can pick multiple at once:

```
Workspace Onboard
──────────────────────────────────────────────────
Found [N] repo(s). Select which to onboard (comma-separated numbers, or shortcut):

  [1]  repo-a/           Node.js / TypeScript    NOT ONBOARDED
  [2]  repo-b/           Python                  NOT ONBOARDED
  [3]  repo-c/           Go                      ONBOARDED  (2026-01-15)
  [4]  packages/ui/      Node.js / TypeScript    PARTIAL
  [5]  packages/shared/  Node.js / TypeScript    NOT ONBOARDED

Shortcuts:
  [A] All repos
  [N] All NOT ONBOARDED only (skip already-onboarded)
  [R] Re-onboard all (full re-run, ignores existing data)

  ↳ Already-ONBOARDED repos will run --update mode unless [R] is selected.

Your selection (e.g. 1,3,5 or A or N):
```

Parse input:
- `1,3,5` → onboard those repos
- `A` / `all` → onboard all repos
- `N` → onboard only NOT ONBOARDED repos
- `R` → full re-onboard all repos (no --update)

If the user selects an ONBOARDED repo without `R`, run `--update` for it automatically.

---

### Step O3: Run Onboard Per Repo (Sequential)

For each selected repo, in order:

1. Print header: `Onboarding [N/total]: [repo-path]/ ([stack]) ────────`
2. Set working context to `[repo-path]/`
3. Run the equivalent of `/buildflow-onboard` (full) or `/buildflow-onboard --update` as determined in Step O2
4. On completion: print the one-line summary from the onboard output
5. On failure:
   ```
   ✗ Onboard failed: [repo-path]/
   Error: [message]

     [C] Continue to next repo
     [R] Retry this repo
     [A] Abort remaining repos
   ```
6. Continue until all selected repos are processed

Each repo's onboard writes to **that repo's own** `.buildflow/codebase/` directory — they do not share a codebase folder.

---

### Step O4: Update WORKSPACE.md + Summary

After all selected repos complete, update `.buildflow/workspace/WORKSPACE.md` with the new onboard status and date for each repo.

Print final summary:

```
Workspace Onboard Complete
──────────────────────────────────────────────────
  ✓ repo-a/          ONBOARDED — 5 modules · 12 hotspots · 6 knowledge files
  ✓ repo-b/          ONBOARDED — 8 modules · 4 hotspots  · 6 knowledge files
  ✓ packages/shared/ ONBOARDED — 2 modules · 0 hotspots  · 6 knowledge files
  ✗ repo-c/          FAILED    — [reason]
  ─ packages/ui/     SKIPPED   (already onboarded, not selected)

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace
   Why:  All repos onboarded — run workspace to map cross-repo dependencies and shared contracts
──────────────────────────────────────────────────
```

---

## Token Budget: ~25K (discovery + contract mapping)
