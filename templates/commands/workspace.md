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

## Token Budget: ~25K (discovery + contract mapping)
