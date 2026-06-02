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
- `/buildflow-workspace spec "<feature>"` — generate scoped specs in each affected repo + write XPLAN.md summary at workspace level
- `/buildflow-workspace discuss` — cross-repo spec clarifications; updates each repo's SPEC.md and XPLAN.md contract
- `/buildflow-workspace build` — execute each repo's plan in dependency order; each repo's wave files stay local
- `/buildflow-workspace build --resume` — resume an interrupted cross-repo build from last incomplete repo
- `/buildflow-workspace check` — run AC verification per repo; show aggregate status across all repos
- `/buildflow-workspace ship` — ship each repo in dependency order; update workspace STATUS.md as each completes
- `/buildflow-workspace complete` — archive cross-repo milestone; deep-prune workspace state
- `/buildflow-workspace debug` — triage cross-repo failures; identify whether root cause is contract mismatch or repo-internal; run targeted debug per failing repo

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

## Workspace Root Auto-Detect & Init

Every workflow subcommand (`spec`, `discuss`, `build`, `check`, `ship`, `complete`) begins with this check:

```bash
# Confirm we are at workspace root (parent of all repos)
ls ../core-common ../api-module ../react-module 2>/dev/null   # example sibling repos
# Or more generally: count siblings with their own package.json
find .. -maxdepth 2 -name "package.json" -not -path "*/node_modules/*" | head -10
```

If `../.buildflow/workspace/` does not exist: create it silently.

```bash
mkdir -p .buildflow/workspace/epics/
```

Write `.buildflow/workspace/WORKSPACE.md` if absent (one-time init — same format as Step 5).

If the command is run from inside a repo (not workspace root), detect it by checking if a `.buildflow/epics/` folder exists in the current directory:

```
⚠ You appear to be inside a repo, not at workspace root.

For cross-repo orchestration, run from the workspace root:
  cd ..
  /buildflow-workspace [subcommand]

Or continue here for single-repo work.
```

---

## Workspace State File Formats

### `.buildflow/workspace/STATE.md`

Single file tracking the active cross-repo epic and per-repo status:

```yaml
# Workspace State
last_updated: [ISO datetime]
current_xepic: 1-photo-upload    # slug — matches epics/ subfolder name
xepic_status: build_in_progress  # spec_in_progress | spec_ready | build_in_progress | built | checked | shipped | complete

build_order:
  - api-module
  - react-module

repos:
  api-module:
    path: ../api-module
    epic_slug: 1-photo-upload     # epic folder name inside that repo's .buildflow/epics/
    status: built                 # pending | spec_ready | build_in_progress | built | checked | shipped
    last_command: /buildflow-workspace build
    last_updated: [ISO datetime]
  react-module:
    path: ../react-module
    epic_slug: 1-photo-upload
    status: build_in_progress
    last_command: /buildflow-workspace build
    last_updated: [ISO datetime]

rollback_branches:
  - repo: api-module
    branch: buildflow/xepic-1-photo-upload
    committed_at: [ISO datetime]
```

### `.buildflow/workspace/epics/[slug]/XPLAN.md`

Cross-repo summary — NOT a full spec. Contains only what the workspace orchestrator needs.

```markdown
# Cross-Repo Epic: [Feature Name]
**Slug:** [1-slug]
**Started:** [date]
**Status:** [spec_ready / build_in_progress / shipped]
**Repos:** [repo-a] → [repo-b] (build order, left to right)

---

## Feature Summary
[2–3 sentences — what the user can do after this is shipped]

---

## Cross-Repo Contract
[The shared interface that connects the repos — extracted from repo specs after generation]

Example (REST):
  POST /users/:id/photo
  Request:  multipart/form-data { file: File }
  Response: { photo_url: string, updated_at: string }
  Defined in: api-module
  Consumed by: react-module

Example (TypeScript shared type):
  interface UserProfile { ... }
  Defined in: core-common
  Consumed by: api-module, react-module

---

## Per-Repo Scope

### [api-module]
- What it implements: [2–4 bullets]
- AC count: [N]
- Spec: ../api-module/.buildflow/epics/[slug]/SPEC.md

### [react-module]
- What it implements: [2–4 bullets]
- AC count: [N]
- Spec: ../react-module/.buildflow/epics/[slug]/SPEC.md

---

## AC Summary
| Repo | Total ACs | Pass | Fail | Unverified |
|------|-----------|------|------|------------|
| api-module   | N | - | - | N |
| react-module | N | - | - | N |
| **Total**    | N | - | - | N |
```

### `.buildflow/workspace/epics/[slug]/STATUS.md`

Quick-glance status table, updated after every repo operation:

```markdown
# Cross-Repo Status: [Feature Name]
**Last updated:** [ISO datetime]

| Repo | Phase | Wave | ACs | Status |
|------|-------|------|-----|--------|
| api-module   | built   | 3/3 | 8/8 PASS | ✓ |
| react-module | build   | 2/3 | 4/6      | ⏳ |

**Rollback branches:** api-module: buildflow/xepic-1-photo-upload ✓
```

---

## Workspace Spec Mode (`/buildflow-workspace spec "<feature>"`)

Generates scoped specs in each affected repo. Each repo gets its own SPEC.md, ACCEPTANCE.md, and PLAN.md. The workspace gets only XPLAN.md and STATUS.md as summary.

### Step S1: Impact Analysis

Run the same analysis as `workspace impact` (Steps 1–4). Determine:
- Which repos need changes
- What each repo's scope is
- What the shared contract is (the interface that connects them)
- Build order (which repo must be specced first to define the contract)

Show:
```
Cross-Repo Scope: "[feature]"
────────────────────────────────────────
Repos affected:
  [1] api-module     → new endpoint + DB migration (defines contract)
  [2] react-module   → UI + API call (consumes contract)

Build order: api-module first (contract source), then react-module.

Proceed with workspace spec? [Y/n]
```

### Step S2: Generate Spec Per Repo (sequential, in build order)

For each repo in build order:

1. Print: `Spec [N/total]: [repo-path]/ ────────`
2. Set file context to that repo's root (read/write paths relative to `[repo-path]/`)
3. Load that repo's context packet:
   - `[repo-path]/.buildflow/VISION.md` (if exists)
   - `[repo-path]/.buildflow/codebase/CODEBASE.md` (if exists)
   - `[repo-path]/.buildflow/codebase/PATTERNS.md` (if exists)
   - `[repo-path]/.buildflow/MEMORY.md` (app_name, framework only)
4. Derive this repo's epic slug — scan `[repo-path]/.buildflow/epics/` for existing numbered folders; use next number + feature slug.
5. Run the spec generation steps from `/buildflow-spec` (Steps 2–15) scoped to **this repo's portion of the feature only** — not the full cross-repo feature.
   - For the contract-defining repo (first in build order): spec its full implementation scope
   - For consuming repos: include the contract output from the prior repo as an external constraint — "API endpoint POST /users/:id/photo returns `{ photo_url: string }` — treat as given, do not reimplement"
6. Write to `[repo-path]/.buildflow/epics/[slug]/`: SPEC.md, ACCEPTANCE.md, PLAN.md, waves/, CHECK.md
7. After spec is generated and approved, extract the cross-repo contract from this repo's API Contracts table (if it defines shared endpoints or types)
8. Update `[repo-path]/.buildflow/STATE.md`: `current_epic: [slug]`, `status: spec_ready`

### Step S3: Extract and Write Cross-Repo Contract

After all repo specs are generated:
1. Collect API contracts, shared type exports, and event schemas from each repo's SPEC.md
2. Identify which are consumed cross-repo (defined in one repo, referenced in another)
3. Write these as the "Cross-Repo Contract" section of XPLAN.md

### Step S4: Write Workspace Files

Use the **Write tool**:
- `.buildflow/workspace/epics/[slug]/XPLAN.md` — feature summary + extracted contract + per-repo scope
- `.buildflow/workspace/epics/[slug]/STATUS.md` — all repos at `spec_ready`
- `.buildflow/workspace/STATE.md` — `current_xepic: [slug]`, `xepic_status: spec_ready`, per-repo status

Print:
```
Workspace Spec Complete — [feature]
────────────────────────────────────────────────
Repos specced:
  ✓ api-module     — [N] ACs · [N] waves
  ✓ react-module   — [N] ACs · [N] waves

Cross-repo contract: [endpoint or type name]
Workspace summary:   .buildflow/workspace/epics/[slug]/XPLAN.md

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace discuss
   Why:  Review generated specs and clarify cross-repo design decisions before building
   Or:   /buildflow-workspace build — skip discuss and start executing
──────────────────────────────────────────────────
```

---

## Workspace Discuss Mode (`/buildflow-workspace discuss`)

Clarifies doubts on the generated cross-repo specs. Updates each repo's SPEC.md where needed. If the cross-repo contract changes, updates XPLAN.md.

### Step D1: Load Cross-Repo Context

Read:
- `.buildflow/workspace/STATE.md` → current xepic, repos, build order
- `.buildflow/workspace/epics/[slug]/XPLAN.md` → contract + per-repo scope summary
- For each repo: `[repo-path]/.buildflow/epics/[slug]/SPEC.md` (summary sections only — requirements and API contracts)

### Step D2: Surface Cross-Repo Ambiguities

Check for ambiguities that span repo boundaries:
- Does the contract shape in repo A's SPEC.md match what repo B's SPEC.md expects to consume?
- Are there field name mismatches, missing error cases, or undefined edge behaviors at the contract boundary?
- Are there ACs in one repo that depend on behavior promised by another repo's ACs?

Show each ambiguity as a clarification question (one at a time, same format as `/buildflow-discuss`).

### Step D3: Apply Updates

If clarification changes the cross-repo contract:
1. Update the affected repo's SPEC.md (contract-defining repo first)
2. Update the consuming repo's SPEC.md to match the updated contract
3. Update XPLAN.md → Cross-Repo Contract section

If clarification only affects one repo's internal design: update that repo's SPEC.md only.

Print diff per repo as changes are applied.

### Step D4: Update Workspace Files

Update `.buildflow/workspace/epics/[slug]/XPLAN.md` if contract changed.
Update `.buildflow/workspace/STATE.md` → `last_updated`.

---

## Workspace Build Mode (`/buildflow-workspace build [--resume]`)

Executes each repo's plan in dependency order. Each repo's wave files stay in that repo. The workspace tracks overall progress.

### Step B1: Load State

Read `.buildflow/workspace/STATE.md`. If `--resume`:
- Find the first repo where `status != shipped` and `status != built`
- Print: `Resuming from [repo-path]/ (status: [status], last: [last_command])`

If no `--resume`: confirm build order and start from first repo.

```
Cross-Repo Build: [feature]
────────────────────────────────────────
Build order:
  [1] api-module     (status: spec_ready)  ← starting here
  [2] react-module   (status: pending)

Rollback plan: branches will be recorded as each repo completes.
Proceed? [Y/n]
```

### Step B2: Execute Per Repo (sequential)

For each repo in build order:

1. Print: `Building [N/total]: [repo-path]/ ────────`
2. Set file context to that repo's root
3. Load that repo's context packet (same as `/buildflow-build` Step 1):
   - `[repo-path]/.buildflow/epics/[slug]/PLAN.md`
   - `[repo-path]/.buildflow/epics/[slug]/waves/wave-[N].md` (current wave only)
   - `[repo-path]/.buildflow/codebase/PATTERNS.md` (if exists)
   - `[repo-path]/.buildflow/epics/[slug]/STATE.md`
4. If this repo consumes the previous repo's contract: inject the **actual implementation output** as a constraint — not just the spec. Read the previous repo's SPEC.md API Contracts section post-build to confirm the real endpoint/type shape.
5. Run `/buildflow-build` execution steps (Steps 1–4) scoped to this repo.
6. On completion:
   - Update `[repo-path]/.buildflow/epics/[slug]/STATE.md`: `status: built`
   - Update `.buildflow/workspace/STATE.md`: `repos.[repo].status: built`
   - Update `.buildflow/workspace/epics/[slug]/STATUS.md`
   - Append to rollback manifest: `repo: [name], branch: buildflow/xepic-[slug]`
7. On failure:
   ```
   ✗ Build failed: [repo-path]/
   Error: [summary]

     [C] Continue to next repo (current repo has partial changes)
     [R] Retry this repo from last wave
     [A] Abort — show rollback instructions for completed repos
   ```

**Rollback instructions (on Abort):**
```
Cross-Repo Build Aborted — [N] of [M] repos completed

Rollback required for:
  api-module:   git checkout main && git branch -D buildflow/xepic-[slug]
  [list each completed repo]

react-module was not started — no rollback needed.
```

### Step B3: Post-Build Summary

```
Cross-Repo Build Complete — [feature]
────────────────────────────────────────────────
  ✓ api-module     — [N] waves · [N] ACs covered
  ✓ react-module   — [N] waves · [N] ACs covered

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace check
   Why:  All repos built — verify ACs across repos before shipping
──────────────────────────────────────────────────
```

---

## Workspace Check Mode (`/buildflow-workspace check`)

Runs AC verification per repo and shows aggregate status.

### Step C1: Load State

Read `.buildflow/workspace/STATE.md` → repos, build order, current xepic.

### Step C2: Per-Repo Check (sequential)

For each repo:
1. Print: `Checking [N/total]: [repo-path]/ ────────`
2. Set file context to that repo's root
3. Run `/buildflow-check` steps scoped to this repo's epic
4. Collect results: total ACs, PASS, FAIL, UNVERIFIED counts
5. Update `[repo-path]/.buildflow/epics/[slug]/CHECK.md`
6. Update `.buildflow/workspace/STATE.md`: `repos.[repo].status: checked` (if all PASS)

### Step C3: Aggregate Report

```
Cross-Repo Check — [feature]
────────────────────────────────────────────────
| Repo         | ACs | Pass | Fail | Unverified |
|--------------|-----|------|------|------------|
| api-module   | 8   | 8    | 0    | 0          |
| react-module | 6   | 5    | 1    | 0          |
| **Total**    | 14  | 13   | 1    | 0          |

Failing ACs:
  react-module / AC-005: [description]

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace ship
   Why:  All ACs pass — ready to ship
   Or:   /buildflow-workspace debug  — triage AC failures across repos before shipping
──────────────────────────────────────────────────
```

Update `.buildflow/workspace/epics/[slug]/STATUS.md` with current AC counts.

---

## Workspace Ship Mode (`/buildflow-workspace ship`)

Ships each repo in dependency order. Runs each repo's ship gate (spec gate + security gate + context prune).

### Step SH1: Pre-Ship Gate

Read workspace STATE.md. For each repo: confirm `status: checked` or `status: built` with all ACs PASS in CHECK.md.

If any repo has unresolved FAIL ACs: block with list of failing ACs. Do not ship until resolved.

### Step SH2: Per-Repo Ship (sequential)

For each repo in build order:
1. Print: `Shipping [N/total]: [repo-path]/ ────────`
2. Set file context to that repo's root
3. Run `/buildflow-ship` steps scoped to this repo's epic
4. On completion:
   - Update `[repo-path]/.buildflow/epics/[slug]/SHIPPED.md` (written by /buildflow-ship)
   - Update `.buildflow/workspace/STATE.md`: `repos.[repo].status: shipped`
   - Update `.buildflow/workspace/epics/[slug]/STATUS.md`
5. On failure: same [C]/[R]/[A] options as Build mode, with rollback instructions

### Step SH3: Workspace Ship Summary

```
Cross-Repo Ship Complete — [feature]
────────────────────────────────────────────────
  ✓ api-module     — shipped · [tag if git]
  ✓ react-module   — shipped · [tag if git]

Workspace STATE updated → xepic_status: shipped

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace complete
   Why:  All repos shipped — archive milestone and reset for next cycle
──────────────────────────────────────────────────
```

---

## Workspace Complete Mode (`/buildflow-workspace complete`)

Archives the cross-repo milestone, writes a workspace-level MILESTONE.md, resets state for the next xepic.

### Step CO1: Verify All Repos Shipped

Read `.buildflow/workspace/STATE.md`. For each repo, check `status: shipped`. Any repo not shipped → show [S]/[I]/[X] options (same as `/buildflow-complete-epic` Step 1), but scoped to the workspace context.

### Step CO2: Write Workspace MILESTONE.md

Use the **Write tool** to create `.buildflow/workspace/milestones/[slug]/MILESTONE.md`:

```markdown
# Cross-Repo Milestone: [Feature Name]
**Completed:** [today]
**Repos:** [N]
**Total ACs:** [N] / [N] PASS

## What Was Built
[3–6 bullets summarizing the cross-repo feature shipped]

## Repos Shipped
| Repo | Epic | ACs | Coverage | Shipped |
|------|------|-----|----------|---------|
| api-module   | [slug] | N/N | N% | [date] |
| react-module | [slug] | N/N | N% | [date] |

## Cross-Repo Contract Delivered
[Final contract shape as implemented — endpoint/type/event]

## Inherited Debt
[Any DEBT.md items from any repo — or "None"]
```

### Step CO3: Reset Workspace State

Use the **Write tool** to update `.buildflow/workspace/STATE.md`:
- Set `current_xepic: none`
- Set `xepic_status: none`
- Clear `build_order: []`
- Clear `repos: {}`
- Clear `rollback_branches: []`
- Append to milestone history:
  ```yaml
  milestone_history:
    - slug: [slug]
      name: [feature]
      completed: [today]
      repos: [list]
  ```

### Step CO4: Summary

```
Cross-Repo Milestone Complete — [Feature Name]
────────────────────────────────────────────────
Repos:        [N]
ACs shipped:  [N] / [N]
Milestone:    .buildflow/workspace/milestones/[slug]/MILESTONE.md

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace spec "[next feature]"
   Why:  Milestone archived. Workspace ready for next cross-repo epic.
──────────────────────────────────────────────────
```

---

## Workspace Debug Mode (`/buildflow-workspace debug`)

Triages cross-repo failures. Determines whether a failing AC is a repo-internal bug or a contract mismatch between repos. Runs targeted debug per failing repo with shared contract context injected.

Use this when:
- `/buildflow-workspace check` reports FAIL ACs in one or more repos
- A feature works in isolation in one repo but breaks when integrated with another
- You suspect the root cause is in a different repo than where the failure surfaces

### Step DB1: Load State & Identify Failures

Read:
- `.buildflow/workspace/STATE.md` → current xepic, repos, build order
- `.buildflow/workspace/epics/[slug]/XPLAN.md` → cross-repo contract
- `.buildflow/workspace/epics/[slug]/STATUS.md` → per-repo AC counts
- For each repo with `status != checked` or known failing ACs: `[repo-path]/.buildflow/epics/[slug]/CHECK.md`

Build a failure map:

```
Cross-Repo Debug: [feature]
────────────────────────────────────────
Failing repos:
  react-module   — AC-005: photo upload shows no preview after upload
  react-module   — AC-006: error toast missing on 413 response

Contract defined in: api-module
Contract status:     api-module built ✓

Triage starting...
```

### Step DB2: Cross-Repo Contract Triage

Before running per-repo debug, check whether the failure is a contract mismatch:

1. Load the contract from XPLAN.md (endpoint shape, response fields, error codes)
2. For each failing AC in a consuming repo: check if the failure description references a field, status code, or behavior that is defined in the contract
3. Load the contract-defining repo's actual implementation — read the relevant route/handler/type file to confirm what it actually returns (not just what the spec says)
4. Compare expected contract (XPLAN.md) vs. actual implementation (source file)

**Contract mismatch detected — example:**
```
Contract Triage
────────────────────────────────────────
XPLAN.md contract:
  POST /users/:id/photo → { photo_url: string, updated_at: string }

api-module actual (src/routes/photo.ts):
  returns { url: string, updatedAt: string }   ← field names differ

Root cause: api-module returns `url` not `photo_url`, `updatedAt` not `updated_at`
Affects: react-module AC-005, AC-006 (consuming `photo_url` from response)

Options:
  [A] Fix contract in api-module (rename fields to match spec)
  [B] Update react-module to consume actual field names (update XPLAN.md to match)
  [C] Investigate further before deciding
```

**No contract mismatch — example:**
```
Contract Triage
────────────────────────────────────────
api-module contract matches XPLAN.md ✓
  POST /users/:id/photo → { photo_url: string, updated_at: string } ✓

Failures are repo-internal to react-module.
Proceeding to per-repo debug.
```

### Step DB3: Per-Repo Debug (failing repos only, contract-defining repo first)

For each repo with failures, in build order (contract-defining repo first if it has a mismatch):

1. Print: `Debugging [N/total]: [repo-path]/ ────────`
2. Set file context to that repo's root
3. Load context packet:
   - `[repo-path]/.buildflow/epics/[slug]/SPEC.md` (API contracts + failing AC descriptions)
   - `[repo-path]/.buildflow/epics/[slug]/CHECK.md` (failing AC details)
   - `[repo-path]/.buildflow/codebase/PATTERNS.md` (if exists)
   - Relevant XPLAN.md contract section (cross-repo boundary context)
4. For contract mismatch root cause: fix the contract-defining repo first, then re-verify the consuming repo's ACs against the corrected output before debugging the consuming repo independently
5. Run `/buildflow-debug` steps scoped to this repo's failing ACs — inject the cross-repo contract as fixed context so the debug session doesn't treat contract fields as unknowns
6. On fix applied:
   - Update `[repo-path]/.buildflow/epics/[slug]/CHECK.md`
   - Update `.buildflow/workspace/epics/[slug]/STATUS.md`
   - Update `.buildflow/workspace/STATE.md` → `repos.[repo].status`

### Step DB4: Root Cause Report

After all failing repos are debugged:

```
Cross-Repo Debug Complete — [feature]
────────────────────────────────────────────────
Root cause summary:
  CONTRACT MISMATCH  api-module returned `url` instead of `photo_url`
                     Fixed: src/routes/photo.ts updated to match XPLAN.md contract
  REPO-INTERNAL      react-module AC-006: error toast not wired to 413 handler
                     Fixed: src/components/PhotoUpload.tsx

AC status after fixes:
| Repo         | ACs | Pass | Fail | Unverified |
|--------------|-----|------|------|------------|
| api-module   | 8   | 8    | 0    | 0          |
| react-module | 6   | 6    | 0    | 0          |
| **Total**    | 14  | 14   | 0    | 0          |

XPLAN.md contract: [updated if contract was corrected]

──────────────────────────────────────────────────
→ Next:  /buildflow-workspace check
   Why:  Fixes applied — re-run check to confirm all ACs pass before shipping
──────────────────────────────────────────────────
```

If contract was corrected during debug, XPLAN.md Cross-Repo Contract section is updated to reflect the actual implemented shape.

---
