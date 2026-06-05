---
name: buildflow-workspace-workflow
max_context_kb: 50
model_tier: heavy
description: Module — workspace workflow subcommands (onboard, spec, discuss, build, check, ship, complete). Loaded by /buildflow-workspace.
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
---

# Workspace Workflow Module

Loaded by /buildflow-workspace when a workflow subcommand is invoked. Execute the relevant mode and return.
## Workspace Onboard Mode (`/buildflow-workspace onboard`)

Discovers all repos/packages in the workspace, presents a **multiselect list**, and runs `/buildflow-onboard` for each selected repo â€” so you never have to `cd` into each repo individually.

### Step O1: Discover & Select Repos

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
- `intel.json` exists at `[repo]/.buildflow/codebase/intel.json` â†’ **ONBOARDED** (show `onboarded_at` date)
- `.buildflow/` exists but no `intel.json` â†’ **PARTIAL**
- No `.buildflow/` â†’ **NOT ONBOARDED**

---

#### Multiselect Prompt

Present all discovered repos as a numbered multiselect list. User can pick multiple at once:

```
Workspace Onboard
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  â†³ Already-ONBOARDED repos will run --update mode unless [R] is selected.

Your selection (e.g. 1,3,5 or A or N):
```

Parse input:
- `1,3,5` â†’ onboard those repos
- `A` / `all` â†’ onboard all repos
- `N` â†’ onboard only NOT ONBOARDED repos
- `R` â†’ full re-onboard all repos (no --update)

If the user selects an ONBOARDED repo without `R`, run `--update` for it automatically.

---

### Step O2: Run Onboard & Report

For each selected repo, in order:

1. Print header: `Onboarding [N/total]: [repo-path]/ ([stack]) â”€â”€â”€â”€â”€â”€â”€â”€`
2. Set working context to `[repo-path]/`
3. Execute the **full `/buildflow-onboard` steps** scoped to `[repo-path]/` â€” this is not a lightweight scan. All 6 output files must be produced in `[repo-path]/.buildflow/codebase/`:
   ```
   [repo-path]/.buildflow/codebase/CODEBASE.md
   [repo-path]/.buildflow/codebase/PATTERNS.md
   [repo-path]/.buildflow/codebase/DEPENDENCIES.md
   [repo-path]/.buildflow/codebase/RISKS.md
   [repo-path]/.buildflow/codebase/TESTING.md
   [repo-path]/.buildflow/codebase/intel.json
   ```
   If the repo was already ONBOARDED and the user did not select [R] (full re-onboard): run `/buildflow-onboard --update` steps instead (refresh changed files only).
4. On completion: print the one-line summary from the onboard output
5. On failure:
   ```
   âœ— Onboard failed: [repo-path]/
   Error: [message]

     [C] Continue to next repo
     [R] Retry this repo
     [A] Abort remaining repos
   ```
6. Continue until all selected repos are processed

Each repo's onboard writes to **that repo's own** `.buildflow/codebase/` directory â€” they do not share a codebase folder. Do not reuse or copy files from another repo's `.buildflow/codebase/`.

---

#### Update WORKSPACE.md + Summary

After all selected repos complete, update `.buildflow/workspace/WORKSPACE.md` with the new onboard status and date for each repo.

Print final summary:

```
Workspace Onboard Complete
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  âœ“ repo-a/          ONBOARDED â€” 5 modules Â· 12 hotspots Â· 6 knowledge files
  âœ“ repo-b/          ONBOARDED â€” 8 modules Â· 4 hotspots  Â· 6 knowledge files
  âœ“ packages/shared/ ONBOARDED â€” 2 modules Â· 0 hotspots  Â· 6 knowledge files
  âœ— repo-c/          FAILED    â€” [reason]
  â”€ packages/ui/     SKIPPED   (already onboarded, not selected)

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace
   Why:  All repos onboarded â€” run workspace to map cross-repo dependencies and shared contracts
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

Write `.buildflow/workspace/WORKSPACE.md` if absent (one-time init â€” same format as Step 5).

If the command is run from inside a repo (not workspace root), detect it by checking if a `.buildflow/epics/` folder exists in the current directory:

```
âš  You appear to be inside a repo, not at workspace root.

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
current_xepic: 1-photo-upload    # slug â€” matches epics/ subfolder name
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

paused_xepics:
  - slug: 2-user-profiles
    paused_at: [ISO datetime]
    xepic_status: spec_ready
    build_order: [api-module, react-module]
    repos:
      api-module:
        path: ../api-module
        epic_slug: 2-user-profiles
        status: spec_ready
        last_command: /buildflow-workspace spec
    rollback_branches: []
```

### `.buildflow/workspace/epics/[slug]/XPLAN.md`

Cross-repo summary â€” NOT a full spec. Contains only what the workspace orchestrator needs.

→ **Format:** See `.buildflow/templates/tpl-workspace-formats.md` (XPLAN.md section).

### `.buildflow/workspace/epics/[slug]/STATUS.md`

Quick-glance status table, updated after every repo operation:

→ **Format:** See `.buildflow/templates/tpl-workspace-formats.md` (STATUS.md section).

---

## Workspace Spec Mode (`/buildflow-workspace spec "<feature>"`)

Generates scoped specs in each affected repo. Each repo gets its own SPEC.md, ACCEPTANCE.md, and PLAN.md. The workspace gets only XPLAN.md and STATUS.md as summary.

### Step S1: Impact Analysis & Generate Specs

Run the same analysis as `workspace impact` (Steps 1â€“4). Determine:
- Which repos need changes
- What each repo's scope is
- What the shared contract is (the interface that connects them)
- Build order (which repo must be specced first to define the contract)

Show:
```
Cross-Repo Scope: "[feature]"
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Repos affected:
  [1] api-module     â†’ new endpoint + DB migration (defines contract)
  [2] react-module   â†’ UI + API call (consumes contract)

Build order: api-module first (contract source), then react-module.

Proceed with workspace spec? [Y/n]
```

#### Generate Spec Per Repo

For each repo in build order:

1. Print: `Spec [N/total]: [repo-path]/ â”€â”€â”€â”€â”€â”€â”€â”€`
2. Set file context to that repo's root (read/write paths relative to `[repo-path]/`)
3. Load that repo's context packet:
   - `[repo-path]/.buildflow/VISION.md` (if exists)
   - `[repo-path]/.buildflow/codebase/CODEBASE.md` (if exists)
   - `[repo-path]/.buildflow/codebase/PATTERNS.md` (if exists)
   - `[repo-path]/.buildflow/MEMORY.md` (app_name, framework only)
4. Derive this repo's epic slug â€” scan `[repo-path]/.buildflow/epics/` for existing numbered folders; use next number + feature slug.
5. Run the spec generation steps from `/buildflow-spec` (Steps 2â€“15) scoped to **this repo's portion of the feature only** â€” not the full cross-repo feature.
   - For the contract-defining repo (first in build order): spec its full implementation scope
   - For consuming repos: include the contract output from the prior repo as an external constraint â€” "API endpoint POST /users/:id/photo returns `{ photo_url: string }` â€” treat as given, do not reimplement"
6. Write to `[repo-path]/.buildflow/epics/[slug]/`: SPEC.md, ACCEPTANCE.md, PLAN.md, waves/, CHECK.md
7. After spec is generated and approved, extract the cross-repo contract from this repo's API Contracts table (if it defines shared endpoints or types)
8. Update `[repo-path]/.buildflow/STATE.md`: `current_epic: [slug]`, `status: spec_ready`

### Step S2: Extract Contract & Write Workspace Files

After all repo specs are generated:
1. Collect API contracts, shared type exports, and event schemas from each repo's SPEC.md
2. Identify which are consumed cross-repo (defined in one repo, referenced in another)
3. Write these as the "Cross-Repo Contract" section of XPLAN.md

#### Write Workspace Files

Use the **Write tool**:
- `.buildflow/workspace/epics/[slug]/XPLAN.md` â€” feature summary + extracted contract + per-repo scope
- `.buildflow/workspace/epics/[slug]/STATUS.md` â€” all repos at `spec_ready`
- `.buildflow/workspace/STATE.md` â€” `current_xepic: [slug]`, `xepic_status: spec_ready`, per-repo status

Print:
```
Workspace Spec Complete â€” [feature]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Repos specced:
  âœ“ api-module     â€” [N] ACs Â· [N] waves
  âœ“ react-module   â€” [N] ACs Â· [N] waves

Cross-repo contract: [endpoint or type name]
Workspace summary:   .buildflow/workspace/epics/[slug]/XPLAN.md

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace discuss
   Why:  Review generated specs and clarify cross-repo design decisions before building
   Or:   /buildflow-workspace build â€” skip discuss and start executing
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---

## Workspace Discuss Mode (`/buildflow-workspace discuss`)

Clarifies doubts on the generated cross-repo specs. Updates each repo's SPEC.md where needed. If the cross-repo contract changes, updates XPLAN.md.

### Step D1: Load Context & Surface Ambiguities

Read:
- `.buildflow/workspace/STATE.md` â†’ current xepic, repos, build order
- `.buildflow/workspace/epics/[slug]/XPLAN.md` â†’ contract + per-repo scope summary
- For each repo: `[repo-path]/.buildflow/epics/[slug]/SPEC.md` (summary sections only â€” requirements and API contracts)

#### Surface Ambiguities

Check for ambiguities that span repo boundaries:
- Does the contract shape in repo A's SPEC.md match what repo B's SPEC.md expects to consume?
- Are there field name mismatches, missing error cases, or undefined edge behaviors at the contract boundary?
- Are there ACs in one repo that depend on behavior promised by another repo's ACs?

Show each ambiguity as a clarification question (one at a time, same format as `/buildflow-discuss`).

### Step D2: Apply Updates & Sync Contract

If clarification changes the cross-repo contract:
1. Update the affected repo's SPEC.md (contract-defining repo first)
2. Update the consuming repo's SPEC.md to match the updated contract
3. Update XPLAN.md â†’ Cross-Repo Contract section

If clarification only affects one repo's internal design: update that repo's SPEC.md only.

Print diff per repo as changes are applied.

#### Sync Workspace Files

Update `.buildflow/workspace/epics/[slug]/XPLAN.md` if contract changed.
Update `.buildflow/workspace/STATE.md` â†’ `last_updated`.

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
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Build order:
  [1] api-module     (status: spec_ready)  â† starting here
  [2] react-module   (status: pending)

Rollback plan: branches will be recorded as each repo completes.
Proceed? [Y/n]
```

### Step B2: Execute Per Repo & Report

For each repo in build order:

1. Print: `Building [N/total]: [repo-path]/ â”€â”€â”€â”€â”€â”€â”€â”€`
2. Set file context to that repo's root
3. Load that repo's context packet (same as `/buildflow-build` Step 1):
   - `[repo-path]/.buildflow/epics/[slug]/PLAN.md`
   - `[repo-path]/.buildflow/epics/[slug]/waves/wave-[N].md` (current wave only)
   - `[repo-path]/.buildflow/codebase/PATTERNS.md` (if exists)
   - `[repo-path]/.buildflow/epics/[slug]/STATE.md`
4. If this repo consumes the previous repo's contract: inject the **actual implementation output** as a constraint â€” not just the spec. Read the previous repo's SPEC.md API Contracts section post-build to confirm the real endpoint/type shape.
5. Run `/buildflow-build` execution steps (Steps 1â€“4) scoped to this repo.
6. On completion:
   - Update `[repo-path]/.buildflow/epics/[slug]/STATE.md`: `status: built`
   - Update `.buildflow/workspace/STATE.md`: `repos.[repo].status: built`
   - Update `.buildflow/workspace/epics/[slug]/STATUS.md`
   - Append to rollback manifest: `repo: [name], branch: buildflow/xepic-[slug]`
7. On failure:
   ```
   âœ— Build failed: [repo-path]/
   Error: [summary]

     [C] Continue to next repo (current repo has partial changes)
     [R] Retry this repo from last wave
     [A] Abort â€” show rollback instructions for completed repos
   ```

**Rollback instructions (on Abort):**
```
Cross-Repo Build Aborted â€” [N] of [M] repos completed

Rollback required for:
  api-module:   git checkout main && git branch -D buildflow/xepic-[slug]
  [list each completed repo]

react-module was not started â€” no rollback needed.
```

#### Post-Build Summary

```
Cross-Repo Build Complete â€” [feature]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  âœ“ api-module     â€” [N] waves Â· [N] ACs covered
  âœ“ react-module   â€” [N] waves Â· [N] ACs covered

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace check
   Why:  All repos built â€” verify ACs across repos before shipping
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---

## Workspace Check Mode (`/buildflow-workspace check`)

Runs AC verification per repo and shows aggregate status.

### Step C1: Load, Check & Report

Read `.buildflow/workspace/STATE.md` â†’ repos, build order, current xepic.

#### Per-Repo Check

For each repo:
1. Print: `Checking [N/total]: [repo-path]/ â”€â”€â”€â”€â”€â”€â”€â”€`
2. Set file context to that repo's root
3. Run `/buildflow-check` steps scoped to this repo's epic
4. Collect results: total ACs, PASS, FAIL, UNVERIFIED counts
5. Update `[repo-path]/.buildflow/epics/[slug]/CHECK.md`
6. Update `.buildflow/workspace/STATE.md`: `repos.[repo].status: checked` (if all PASS)

#### Aggregate Report

```
Cross-Repo Check â€” [feature]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
| Repo         | ACs | Pass | Fail | Unverified |
|--------------|-----|------|------|------------|
| api-module   | 8   | 8    | 0    | 0          |
| react-module | 6   | 5    | 1    | 0          |
| **Total**    | 14  | 13   | 1    | 0          |

Failing ACs:
  react-module / AC-005: [description]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace ship
   Why:  All ACs pass â€” ready to ship
   Or:   /buildflow-workspace debug  â€” triage AC failures across repos before shipping
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

Update `.buildflow/workspace/epics/[slug]/STATUS.md` with current AC counts.

---

## Workspace Ship Mode (`/buildflow-workspace ship`)

Ships each repo in dependency order. Runs each repo's ship gate (spec gate + security gate + context prune).

### Step SH1: Gate, Ship & Report

Read workspace STATE.md. For each repo: confirm `status: checked` or `status: built` with all ACs PASS in CHECK.md.

If any repo has unresolved FAIL ACs: block with list of failing ACs. Do not ship until resolved.

#### Per-Repo Ship

For each repo in build order:
1. Print: `Shipping [N/total]: [repo-path]/ â”€â”€â”€â”€â”€â”€â”€â”€`
2. Set file context to that repo's root
3. Run `/buildflow-ship` steps scoped to this repo's epic
4. On completion:
   - Update `[repo-path]/.buildflow/epics/[slug]/SHIPPED.md` (written by /buildflow-ship)
   - Update `.buildflow/workspace/STATE.md`: `repos.[repo].status: shipped`
   - Update `.buildflow/workspace/epics/[slug]/STATUS.md`
5. On failure: same [C]/[R]/[A] options as Build mode, with rollback instructions

#### Ship Summary

```
Cross-Repo Ship Complete â€” [feature]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  âœ“ api-module     â€” shipped Â· [tag if git]
  âœ“ react-module   â€” shipped Â· [tag if git]

Workspace STATE updated â†’ xepic_status: shipped

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace complete
   Why:  All repos shipped â€” archive milestone and reset for next cycle
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---

## Workspace Complete Mode (`/buildflow-workspace complete`)

Archives the cross-repo milestone, writes a workspace-level MILESTONE.md, resets state for the next xepic.

### Step CO1: Verify, Archive & Reset

Read `.buildflow/workspace/STATE.md`. For each repo, check `status: shipped`. Any repo not shipped â†’ show [S]/[I]/[X] options (same as `/buildflow-complete-epic` Step 1), but scoped to the workspace context.

#### Write MILESTONE.md

Use the **Write tool** to create `.buildflow/workspace/milestones/[slug]/MILESTONE.md`:

```markdown
# Cross-Repo Milestone: [Feature Name]
**Completed:** [today]
**Repos:** [N]
**Total ACs:** [N] / [N] PASS

## What Was Built
[3â€“6 bullets summarizing the cross-repo feature shipped]

## Repos Shipped
| Repo | Epic | ACs | Coverage | Shipped |
|------|------|-----|----------|---------|
| api-module   | [slug] | N/N | N% | [date] |
| react-module | [slug] | N/N | N% | [date] |

## Cross-Repo Contract Delivered
[Final contract shape as implemented â€” endpoint/type/event]

## Inherited Debt
[Any DEBT.md items from any repo â€” or "None"]
```

#### Reset Workspace State

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

#### Summary

```
Cross-Repo Milestone Complete â€” [Feature Name]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Repos:        [N]
ACs shipped:  [N] / [N]
Milestone:    .buildflow/workspace/milestones/[slug]/MILESTONE.md

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace spec "[next feature]"
   Why:  Milestone archived. Workspace ready for next cross-repo epic.
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---




