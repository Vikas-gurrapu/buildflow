# BuildFlow

> Spec-driven, multi-agent AI development orchestration — for Claude Code, Gemini CLI, Codex CLI, Cursor, Cline, and Continue.</p>
> **v7.0** — Decision workshops, UI design contracts, global learnings, yolo mode, 15 language runtimes, and full CI/CD tooling.

[![npm version](https://badge.fury.io/js/buildflow-dev.svg)](https://www.npmjs.com/package/buildflow-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

---

## Table of Contents

- [What is BuildFlow?](#what-is-buildflow)
- [Quick Start](#quick-start)
- [Supported AI Tools](#supported-ai-tools)
- [AI Slash Commands](#ai-slash-commands)
- [CLI Commands](#cli-commands)
- [Full Workflow Walkthrough](#full-workflow-walkthrough)
- [Git Permission System](#git-permission-system)
- [No-Git Mode](#no-git-mode)
- [Token Cost Tracking](#token-cost-tracking)
- [Spec Governance](#spec-governance)
<!-- Docker documentation is intentionally hidden from the default README flow.
     Docker is initialized only when `/buildflow-docker` is triggered. -->
- [Codebase Intelligence](#codebase-intelligence)
- [Post-Ship Feature Advisor](#post-ship-feature-advisor)
- [How It Works](#how-it-works)
- [Package Source Structure](#package-source-structure)
- [The .buildflow/ Scaffold](#the-buildflow-scaffold)
- [Template System](#template-system)
- [9 Specialized Agents](#9-specialized-agents)
- [v7.0: What's New](#v70-whats-new)
- [Token Economics](#token-economics)
- [Contributing](#contributing)
- [Publishing](#publishing)

---

## What is BuildFlow?

BuildFlow is a **CLI tool** that installs a spec-driven, multi-agent AI workflow into any project. It does two things:

1. **Scaffolds `.buildflow/`** — markdown files that act as persistent memory, formal specs, project state, and agent instructions
2. **Installs slash commands** — writes `/buildflow-*` command files into whichever AI tools you use (Claude Code, Cursor, Gemini CLI, etc.)

Once installed, you work entirely inside your AI tool using `/buildflow-*` commands.

**Five core ideas that separate BuildFlow from other tools:**

- **Spec-first:** Every epic starts with formal Requirements + Technical Design + Acceptance Criteria. Plans trace to ACs. Ship is blocked if any AC is unsatisfied.
- **Context isolation + resume:** Each agent receives a minimal context packet, and each epic keeps a compact `STATE.md` so fresh sessions can continue cleanly.
- **Auto-prune:** `MEMORY.md` is automatically compressed at session start and after each ship. Long sessions stay lean.
- **Measured token costs:** Every command reports actual token usage (context loaded + output generated) and accumulates a session total — not estimates.
- **Cross-project intelligence:** Global learnings written at every milestone completion surface relevant insights in future projects using the same framework.

---

## Quick Start

```bash
# Run once in any project directory
npx buildflow-dev init
```

This will:
1. Detect your project (framework, language, existing code vs. greenfield)
2. Ask for your app name and experience level
3. **Ask for git permission** (approve / deny / deny permanently)
4. Create `.buildflow/` with memory, state, preferences, and agent config files
5. Detect which AI tools you have installed
6. Write `/buildflow-*` slash commands into each detected tool

Then open your AI tool and type `/buildflow-start-epic` to begin.

```bash
# Or install globally
npm install -g buildflow-dev
buildflow init
```

---

## Supported AI Tools

| Tool | Auto-detect Method | Global Install Path | Local Install Path | Trigger |
|------|-------------------|--------------------|--------------------|---------|
| **Claude Code** | `claude` CLI or `~/.claude/` | `~/.claude/commands/buildflow-*.md` | `.claude/commands/buildflow-*.md` | `/buildflow-*` |
| **Gemini CLI** | `gemini` CLI | `~/.gemini/commands/*.md` + `GEMINI.md` | `.gemini/commands/*.md` + `GEMINI.md` | `/buildflow-*` |
| **Codex CLI** | `codex` CLI | `~/.codex/instructions/` + `skills/` | `.codex/instructions/` + `skills/` | `$buildflow-*` |
| **Cursor** | `~/.cursor/` or app dir | (falls back to local) | `.cursor/rules/buildflow.mdc` | `@buildflow-*` |
| **Cline** | VS Code extension `saoudrizwan.claude-dev` | (falls back to local) | `.clinerules` | `/buildflow-*` |
| **Continue** | `~/.continue/config.json` | `~/.continue/buildflow/*.md` + config patch | `.continue/buildflow/*.md` | `/buildflow-*` |

---

## AI Slash Commands

These are installed into your AI tool and triggered by typing `/buildflow-*`.

### Core Workflow

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-start-epic` | Strategist | Capture vision, detect drift vs last session, load epic history | ~8K |
| `/buildflow-think [topic]` | Researcher × 3 + Synthesizer | Parallel research. Modes: `--arch`, `--build-vs-buy`, `--debt`, `--complexity` | ~30K |
| `/buildflow-spec` | Architect | Generate Requirements + Technical Design + ACs + wave plan in one pass — versioning, approval audit trail, amendment gate, multi-cycle engineering review | ~40K |
| `/buildflow-discuss [topic]` | Strategist + Researcher | Post-spec clarification — review doubts about generated spec and plan, lock decisions, auto-updates artifacts on confirmation | ~20–35K |
| `/buildflow-build [wave]` | Builder x N + Reviewer | Wave execution with git worktree isolation, deviation handling, schema drift check, touched-file testing, STATE.md resume updates | ~50K/wave |
| `/buildflow-test [wave]` | Reviewer | Standalone test + fix loop — re-verify a wave or test a manual change | ~25K |
| `/buildflow-check` | Reviewer × 4 | Spec compliance + correctness + quality + security + schema drift + spec coverage traceability | ~26K |
| `/buildflow-ship` | Strategist + Security Auditor | 4 gates: spec version, security, tests + regression, build telemetry. Context pruning + SHIPPED.md + post-ship advisor | ~40K |

### Existing Codebases

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-onboard` | Cartographer | 5-lens analysis, focused codebase docs, scoped `--paths` remaps, **symbol-level import graph**, feature inventory, local/locale maps, risk scores, queryable `intel.json` | ~45K |
| `/buildflow-modify "desc"` | Surgeon | **Symbol-level** transitive impact (exact call sites), risk scores, test coverage map, API contract check | ~30K |
| `/buildflow-refactor [scope]` | Surgeon + Reviewer | Quality improvement without behavior change | ~40K |

### Debugging & Deployment

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-hotfix "desc"` | Surgeon | Fast-path: restore point → fix → test → commit. No spec, no plan, no waves | ~10K |
| `/buildflow-debug` | Surgeon | Root-cause analysis — traces error to source, applies minimal fix | ~20K |
| `/buildflow-deploy [env]` | Strategist | Pre-flight → build → migrate → smoke test. Docker path used only after `/buildflow-docker` initializes it | ~15K |
| `/buildflow-docker [cmd]` | Architect | On-demand Docker initialization: scaffold Dockerfile + Compose, build, run, push, scan | ~15K |

### Security

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-audit` | Security Auditor | OWASP Top 10 + language-specific dependency audit. Container scan runs only after `/buildflow-docker` initializes Docker | ~35K |
| `/buildflow-audit --quick` | Security Auditor | Recently changed files only | ~15K |
| `/buildflow-audit --pre-ship` | Security Auditor | Secrets + critical patterns only | ~10K |

### UI Design

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-ui-spec` | Strategist | Generate UI design contract — color system, typography, spacing scale, component inventory, responsive rules, accessibility requirements | ~12K |
| `/buildflow-ui-spec --existing` | Strategist | Detect and document the design system already in use | ~10K |
| `/buildflow-ui-review` | Strategist | Retroactive audit of UI implementation against design contract across 6 dimensions (color, typography, spacing, components, responsive, accessibility) | ~25K |
| `/buildflow-ui-review --quick` | Strategist | Color + component names only | ~5K |

### Multi-Repo & Workspace

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-workspace` | Architect | Monorepo / polyrepo mapping, cross-repo contract detection (TypeScript types, REST, tRPC, GraphQL, gRPC), blast-radius analysis | ~25K |
| `/buildflow-workspace impact <change>` | Architect | Which services are affected by a change, suggested build order | ~15K |

### Utility

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-status` | Strategist | Epic progress, AC bar, build quality, debt, session token total, next action | ~5K |
| `/buildflow-explain <term/file>` | Strategist | Plain-language explanation of code, concepts, or errors | ~2K |
| `/buildflow-back [n]` | Strategist | Undo to restore point (git stash or file snapshot), update state | ~3K |
| `/buildflow-revert [--epic N-slug]` | Strategist | revert current, last, or named epic's spec and plan artifacts; asks before code rollback | ~4K |
| `/buildflow-discuss [topic]` | Strategist + Researcher | Post-spec clarification — review doubts about generated spec and plan, auto-updates artifacts on confirmation | ~20–35K |
| `/buildflow-complete-epic` | Strategist | Archive shipped epics into named milestone, write global learnings, create release tag, reset for next cycle | ~12K |
| `/buildflow-settings` | Strategist | Interactive settings menu — 13 settings including workflow toggles, yolo mode, and spec coverage | ~3K |
| `/buildflow-help` | Strategist | Diagnostic mode, 12 recovery paths, git recovery, global learnings viewer, post-milestone feature advisor | ~15–35K |

---

## CLI Commands

Run these in your terminal, outside the AI tool.

```bash
buildflow init                      # Scaffold .buildflow/ and install slash commands
buildflow install                   # Re-install or add more AI tools
buildflow install --tool claude     # Install into a specific tool
buildflow install --tool all        # Install into all detected tools
buildflow install --global          # Install to home directory (all projects)
buildflow install --local           # Install to current project only (default)
buildflow uninstall --local         # Remove local BuildFlow tool integrations
buildflow uninstall --global        # Remove global BuildFlow tool integrations
buildflow uninstall --tool gemini   # Remove BuildFlow from one tool
buildflow uninstall --project-data  # Also remove .buildflow/ in this project
buildflow audit                     # Pattern-based security scan, saves report
buildflow audit --quick             # Scan recent changes only
buildflow audit --target src/api/   # Scan a specific directory
buildflow audit --report            # Print the most recent saved report
buildflow fix                       # Interactive issue scanner + auto-fixer
buildflow fix --target src/         # Fix issues in a specific directory
buildflow status                    # Print current epic and project state
buildflow status --verbose          # Also print .buildflow/ directory tree
buildflow update                    # Re-install slash commands (pick up new versions)
buildflow update --check            # Check current version without updating
```

---

## Full Workflow Walkthrough

### 1. Init

```bash
mkdir my-app && cd my-app
npx buildflow-dev init
npx buildflow-dev uninstall --global
npx buildflow-dev uninstall --local --project-data
```

BuildFlow will:
- Auto-detect language, framework, and existing tests
- Ask for git permission (stored permanently in `PREFERENCES.md`)
- Scaffold `.buildflow/` with all config files
- Install commands into detected AI tools

### 2. Start a session

```
/buildflow-start-epic
```

Loads vision, detects codebase drift vs last session (file count, schema changes, load-bearing symbol changes), prints epic history from previous SHIPPED.md files. Resets the session token counter.

### 3. Research (optional)

```
/buildflow-think auth-strategy
```

3 Researchers run in parallel. Synthesizer combines results. Output saved to `.buildflow/epics/[epic]/RESEARCH.md`.

### 4. Spec + Plan — formal artifacts and wave plan in one pass

```
/buildflow-spec
```

Generates five locked files in one pass:

```
.buildflow/epics/[epic]/
|-- REQUIREMENTS.md       Product Requirements
|-- DESIGN.md             Technical Design
|-- ACCEPTANCE.md         Acceptance Criteria with spec_version
|-- APPROVALS.md          Permanent approval audit trail
|-- PLAN.md               Wave plan traced to every AC
`-- VERIFICATION.md       AC verification ledger
```

After the spec is approved, the Architect auto-chains into planning:
- Every task traced to an AC
- **Thin-slice ordering** enforced: DB/schema → API/services → UI → integration
- **Exclusive file ownership** — each file owned by exactly one wave, conflicts detected and resolved
- **Post-change focused tests** — tests are written or updated after code changes, scoped to touched files
- **Multi-cycle engineering review** — loops until all 7 dimensions are APPROVED
- `spec_version` recorded in PLAN.md header for ship-time version check

If the spec changes mid-epic, an amendment gate requires explicit confirmation and marks PLAN.md stale. Run `/buildflow-spec --update` to regenerate affected waves.

### 4b. Discuss — clarify doubts after spec is generated (optional)

```
/buildflow-discuss database-choice
```

Post-spec clarification workshop. Reviews the generated requirements, design, and wave plan for doubts, gaps, or concerns. Resolves them as locked decisions, then automatically calls `/buildflow-spec --update` to patch affected artifacts on confirmation. Saved decisions go to `.buildflow/epics/[epic]/DECISIONS.md`.

```
# Discuss → confirm → auto-updates spec → proceed to build
/buildflow-discuss "wave ordering"
# > Are you happy with these decisions? [Y] Yes
# > Spec updated to v2 — 2 decisions applied · 3 ACs changed
```

### 5. Build — wave-by-wave execution with safety rails

```
/buildflow-build
```

For each wave:
- **Git worktree isolation** per Builder (no-git fallback: serialized execution)
- **Deviation handling**: HARD (must resolve) / SOFT (proceed with note) / SCOPE (escalate to user)
- **Schema drift check** at wave commit — unapplied migrations flagged immediately
- **Build telemetry** after each wave: type-check → lint → test coverage (F/P/S prompt, never hard-block) → bundle size
- **Focused tests first**: run tests for touched files and dependency neighborhoods, then ask the user before impacted-area or app smoke checks
- **AC status updates**: focused test results are written to `epics/[epic]/VERIFICATION.md` as PASS, IN PROGRESS, FAIL, BLOCKED, or DEFERRED
- **Parked-changes conflict check** before build start: warns if new epic touches files from a previous failed git commit
- **STATE.md update** after every wave so `/clear` + new session can continue from the correct wave

### 7. Check

```
/buildflow-check
```

4 parallel Reviewers: spec compliance, correctness, quality, security.
Also runs:
- **Schema drift detection** — unapplied migrations, schema-consumer mismatches
- **Spec coverage traceability** — reverse map of source files to ACs. Below configurable threshold → smart prompt (bugfix exception / incremental coverage exception / add ACs / proceed)

### 8. Ship — 4 mandatory gates

Before `/buildflow-ship`, `/buildflow-check` asks the user to manually confirm specific UAT use cases and records pass/fail/pending status in `epics/[epic]/VERIFICATION.md`.

```
/buildflow-ship
```

| Gate | What it checks | On failure |
|------|---------------|------------|
| **Gate 0a** | `spec_version` in PLAN.md matches current `ACCEPTANCE.md` | BLOCK |
| **Gate 0b** | Every AC is ✓ PASS | BLOCK |
| **Gate 1** | Security scan (changed files only) | CRITICAL → BLOCK, HIGH → WARN |
| **Gate 2a** | current epic tests pass | BLOCK |
| **Gate 2b** | Cross-epic regression (vs `last_ship_test_count` baseline) | BLOCK |
| **Gate 3** | Type-check BLOCK ? Lint errors BLOCK ? Compile BLOCK ? Coverage smart-prompt ? Bundle size alert ? Docker build only after `/buildflow-docker` initializes Docker | Type/compile/Docker -> BLOCK |

After gates pass:
- Retrospective written to `epics/[epic]/RETRO.md`
- `MEMORY.md` pruned to under 3K tokens
- `epics/[epic]/SHIPPED.md` written (≤500 tokens, loaded by future epics)
- Git tag OR file snapshot (no-git mode)
- **Post-ship feature advisor** auto-runs (market research + engineering standards gaps)

### 9. Deploy

```
/buildflow-deploy staging
/buildflow-deploy production
```

Detects deploy method (Vercel, Netlify, Fly, Railway, Docker, Compose, CI/CD).
For Docker: build → CVE scan → push to registry → remote pull → run migrations → health check.

---

## Git Permission System

At `init`, BuildFlow asks once:

```
? Git access for this project:
  ❯ Approve — use git for commits, tags, and restore points
    Deny — use file snapshots instead (can re-enable later)
    Deny permanently — always use file snapshots, never ask again
```

The choice is stored in `.buildflow/PREFERENCES.md` under `git.permission` and in `MEMORY.md` under `git_available`. It persists across all sessions.

**To re-enable git after denying:**
```
/buildflow-help git-enable
```

This verifies git is installed, initializes the repo if needed, updates preferences, and offers to commit any parked changes.

---

## No-Git Mode

When git is unavailable or denied, all BuildFlow features continue to work using file snapshots:

| Git feature | No-git equivalent |
|-------------|------------------|
| `git stash` | `.buildflow/epics/[epic]/SNAPSHOTS/` |
| Wave commit | Recorded in `PLAN.md` task file lists |
| Epic tag | `STATE.md` entry with snapshot path |
| Changed-file detection | PLAN.md task `Files to create/modify` fields |

**Parked changes**: If git fails mid-build, BuildFlow prompts:
- **Retry** — wait for git to recover
- **Park** — save a snapshot, continue working, commit later
- **Warn only** — proceed without committing

Parked entries are tracked in `MEMORY.md → parked_changes[]`. When a new epic touches files with parked changes, BuildFlow warns and offers to resolve or take a stack snapshot.

**To commit parked changes once git is restored:**
```
/buildflow-help git-resolve-parked
```

---

## Token Cost Tracking

Every command measures and reports its **actual** token usage — not estimates.

**How it works:**
1. At command start: sum character counts of all loaded files ÷ 4 = input tokens
2. At command end: measure generated text length ÷ 4 = output tokens
3. Add to `STATE.md → session_tokens_used` running total
4. Print the breakdown

**Token cost report (shown at end of every command):**
```
Token Cost — /buildflow-build
──────────────────────────────
Context loaded:    ~18K tokens   (3 context packets × 2 waves + 4 fix iterations)
Output generated:  ~12K tokens   (6 files written, 8 test runs)
This command:      ~30K tokens
Session total:     ~52K tokens   (since 2026-05-25 09:14)
```

**Session total** is reset at every `/buildflow-start-epic`. View anytime with `/buildflow-status`.

**Configure in `PREFERENCES.md`:**
```yaml
token_tracking:
  enabled: true
  report_at_end: true
  session_running_total: true
```

---

## Spec Governance

BuildFlow's spec layer is versioned, auditable, and enforced at every gate.

### Versioning
Every `ACCEPTANCE.md` has a frontmatter header:
```yaml
spec_version: 2
status: locked
approved_by: [user]
approved_at: 2026-05-25
changelog:
  - v1: Initial spec
  - v2: Added AC-007 (rate limiting) per security review
```

### Approval audit trail
Every approval is appended to `epics/[epic]/APPROVALS.md` — a permanent file that is **never pruned or deleted**, even after ship.

### Amendment gate
If you change the spec while a build is in progress:
1. BuildFlow requires typing `"amend"` to confirm
2. Shows which ACs changed and which plan tasks are affected
3. Marks `PLAN.md` as stale — `/buildflow-build` is blocked until you re-run `/buildflow-spec --update`

### Spec diff viewer
```
/buildflow-spec --review
```
Shows a side-by-side before/after of every changed AC between the current spec version and the version the plan was built against.

### Version consistency enforcement
At plan time, at build start, and at ship Gate 0a — the `spec_version` in `PLAN.md` is checked against the current `ACCEPTANCE.md`. Any mismatch blocks progression.

### Spec coverage threshold
Configure how strictly AC traceability is enforced:
```yaml
spec_coverage:
  threshold: 70      # % of business-logic files that must have AC traceability
  strict_mode: false # true = prompt on any drop
```

When below threshold, the prompt is **context-aware** — not a hard block:
- **[B] Bugfix phase** — coverage tracking less relevant for targeted fixes
- **[N] Building up coverage** — team is incrementally adding tests for this flow
- **[F] Fix now** — add ACs before shipping
- **[P] Proceed** — log to DEBT.md and continue

---

<!--
## Docker Integration

### Scaffold a complete Docker setup

```
/buildflow-docker scaffold
```

Generates for your detected language/framework:
- **Multi-stage Dockerfile** (deps → builder → minimal runner) for all 12 languages
- **`.dockerignore`** tuned per language (skips `node_modules`, `target`, `.venv`, etc.)
- **`docker-compose.yml`** with app + your choice of Postgres/MySQL/MongoDB/Redis
- **`docker-compose.dev.yml`** hot-reload overlay (mounts source, uses dev command)

### Manage containers

```
/buildflow-docker build          # docker compose build --no-cache
/buildflow-docker run            # docker compose up -d (waits for health checks)
/buildflow-docker stop           # docker compose down
/buildflow-docker logs [svc]     # tail logs for a service
/buildflow-docker shell [svc]    # exec bash/sh in a running container
```

### Push to any registry

```
/buildflow-docker push           # interactive: Docker Hub / ECR / GCR / GHCR / custom
```

Handles authentication, tagging, and push for all major registries.

### Security scan

```
/buildflow-docker scan
```

Runs `docker scout` (if available) or Trivy. Reports CVEs by severity, suggests base image improvements, appends critical findings to `epics/[epic]/DEBT.md`.

### Pipeline integration

| Stage | Docker hook |
|-------|------------|
| After each build wave | Non-blocking warning if `docker build` fails |
| `/buildflow-ship` Gate 3 | **Blocking** Docker build check — ship blocked if image fails |
| `/buildflow-deploy` | Full Docker path: build → scan → push → pull on host → migrate → health check |
| `/buildflow-audit` | Dockerfile misconfiguration scan (running as root, secrets in ENV/ARG, missing HEALTHCHECK) + image CVE scan |

**Configure in `PREFERENCES.md`:**
```yaml
docker:
  detected: true
  auto_build_check: true   # warn after each wave
  scan_before_push: true   # CVE scan before deploy push
```

---
-->

## Codebase Intelligence

### `/buildflow-onboard` — 5-Lens Analysis

Runs five parallel analyses on your codebase:

| Lens | What it produces |
|------|-----------------|
| **Architecture** | Entry points, layer pattern (MVC/hexagonal/feature-based), module boundaries |
| **Quality** | Largest files, test coverage estimate, TODO/FIXME density |
| **Security** | Auth surface, potential secret refs, dangerous API usage |
| **Data** | ORM/migration state, schema file locations, query patterns |
| **Features** | User-facing capabilities, local/offline/dev support, locale/i18n support across JS, Java, Go, Python, Ruby, PHP, .NET, mobile, static JSON/catalog files, label/copy catalogs, localized docs, scripts, routes, screens, tests |

### Symbol-Level Import Graph

`/buildflow-onboard` extracts exported symbols (functions, classes, methods) for every source file, then builds a reverse caller index:

```
AuthService.login      → routes/auth.ts:45, routes/auth.ts:89, tests/auth.test.ts:8
AuthService.register   → routes/auth.ts:62, tests/auth.test.ts:20
DBClient.query         → auth/service.ts:34, users/service.ts:18, orders/service.ts:7
```

This is stored in `.buildflow/codebase/intel.json` under `symbol_callers`.

Onboarding also writes focused maps: `STACK.md`, `STRUCTURE.md`, `INTEGRATIONS.md`, `TESTING.md`, `CONCERNS.md`, `FEATURES.md`, and `intel.json`. `intel.json.features[]`, `local_support`, and `locale_support` help planning preserve existing capabilities such as local dev workflows and locale/i18n support. Locale mapping checks static catalogs, label/copy metadata, localized docs such as `README.*.md`, and language-specific APIs/dependencies like Java `ResourceBundle`, Spring `MessageSource`, Go `golang.org/x/text`, Python `gettext`/Babel, Rails `I18n.t`, Laravel `trans()`, .NET `.resx`, Flutter `.arb`, iOS `Localizable.strings`, and Android `strings.xml`.

Scoped refresh is available when maps drift:

```bash
/buildflow-onboard --paths src/auth,packages/ui
/buildflow-onboard --query locale
```

### Symbol-Level Impact in `/buildflow-modify`

When you change a function, `/buildflow-modify` looks up the exact call sites:

```
Changed symbol: AuthService.login (src/auth/login.ts)

Direct call sites:
  src/routes/auth.routes.ts:45    risk: 3.1  ← update call
  src/routes/auth.routes.ts:89    risk: 3.1  ← update call
  src/tests/auth.test.ts:8        risk: 1.0  ← add test case
  src/middleware/session.ts:12    risk: 2.5  ← verify default
```

Falls back to file-level fan-in analysis if intel.json predates symbol tracking.

### Drift Detection

At every session start (`/buildflow-start-epic`), BuildFlow compares the current codebase against the `drift_baseline` recorded at onboard time:
- Schema file hash changed → WARN
- Load-bearing symbol removed or signature changed → WARN
- Module file count jumped >20% → INFO

---

## Post-Ship Feature Advisor

After every `/buildflow-ship`, two parallel Researchers automatically run:

**Researcher A** — Competitor feature analysis: what do the top 3–5 apps in your category offer that you haven't built yet?

**Researcher B** — Engineering standards check: what protocols and patterns are expected for your app type that are missing?

Output:
```
What to consider next:
─────────────────────
Standard features missing:
  → Rate limiting on auth endpoints  [Security standard — easy to add]
  → Recurring tasks                  [Expected in every task manager]

Engineering standards to address:
  → Health check endpoint (/health)  [Standard for any deployed service]
  → Structured logging               [Replace console.log — 1h]

Your debt right now: 3 items in DEBT.md

Suggested next: /buildflow-spec "Auth hardening + recurring tasks"
```

Saved to `.buildflow/epics/[epic]/SUGGESTIONS.md`. Also available anytime via `/buildflow-help next`.

---

## How It Works

### The install flow

```
npx buildflow-dev init
        │
        ├─ detectProjectInfo()     Reads package.json, pom.xml, build.gradle, Cargo.toml,
        │                          go.mod, Gemfile, composer.json, pubspec.yaml,
        │                          Package.swift, build.sbt, .csproj, mix.exs,
        │                          CMakeLists.txt, Makefile, stack.yaml, .cabal
        │                          → 15 language families: JS/TS, Python, Rust, Go,
        │                            Java, Kotlin, C#, Ruby, PHP, Dart/Flutter, Swift,
        │                            Scala, Elixir, C/C++, Haskell
        │
        ├─ Git permission prompt   approve / deny / deny_permanent
        │                          → stored in PREFERENCES.md + MEMORY.md
        │
        ├─ Folder access guard     path_permissions in PREFERENCES.md
        │                          commands ask once per folder, then remember
        │
        ├─ scaffoldBuildflow()     Creates .buildflow/ folder tree with pre-filled files:
        │                          epics/, debug/, hotfix/, codebase/
        │                          
        │
        ├─ patchGitignore()        Adds .buildflow/snapshots/
        │
        ├─ ensureGit()             Only if git.permission === 'approved'
        │
        └─ runInstall()            Detects AI tools → writes command files per tool
                                   Loads all 27 command templates from templates/commands/
                                   Installs shared update, folder access, and STATE.md rules
```

### Session start (CLAUDE.md checklist)

Every AI session runs this automatically:

1. Check for BuildFlow updates
2. Prune `MEMORY.md` if over 3K tokens
3. Load `STATE.md` for current epic
4. Load `.buildflow/epics/[epic]/STATE.md` if an epic is active
5. Detect git availability, set `git_available` in `MEMORY.md`
5b. Check `~/.buildflow/learnings/global.md` — surface matching insights for current framework
6. Run codebase drift check against `intel.json` baseline
7. Reset `session_tokens_used: 0` in `STATE.md`

### Epic resume contract

Every major epic command (`think`, `spec`, `plan`, `build`, `check`, `ship`) reads and updates:

```
.buildflow/epics/[epic]/STATE.md
```

That file is intentionally small and contains:
- current epic and wave
- status
- decisions
- files that matter
- next command
- risks/open questions
- test strategy

After a major command, BuildFlow updates `STATE.md`, checks current context usage, and may recommend:

```
/clear
```

Then the user can start a fresh AI session and run the suggested next BuildFlow command. The new session resumes from `STATE.md` instead of relying on old chat history.

---

## Package Source Structure

```
buildflow-dev/
│
├── bin/
│   └── buildflow.js              CLI entry point. Parses args with commander,
│                                 lazy-loads command modules for fast startup.
│
├── src/
│   ├── index.js                  Library entry point — re-exports all run() functions
│   │                             for programmatic use: import { init } from 'buildflow-dev'
│   │
│   ├── commands/
│   │   ├── init.js               Detects languages/frameworks. Docker is opt-in via /buildflow-docker.
│   │   │                         Git permission prompt. Scaffolds .buildflow/.
│   │   │                         Writes PREFERENCES.md, MEMORY.md, STATE.md, VISION.md, GLOSSARY.md
│   │   │                         scaffolds epics/, debug/, hotfix/, and codebase/ directories.
│   │   │                         Seeds path_permissions for Folder Access Guard.
│   │   │
│   │   ├── install.js            TOOLS object: one entry per supported AI tool.
│   │   │                         Each tool has: detect(), installGlobal(), installLocal().
│   │   │                         Adds update checks, Folder Access Guard, and STATE.md
│   │   │                         resume rules to Claude, Gemini, Codex, Cursor, Cline,
│   │   │                         and Continue command surfaces.
│   │   │                         loadCommandTemplates() reads all 27 .md files from
│   │   │                         templates/commands/ and returns them as a map.
│   │   │                         commandNames array drives which templates are installed.
│   │   │
│   │   ├── audit.js              Pattern-based terminal scanner (no AI required).
│   │   │                         SECRET_PATTERNS: API keys, DB URLs, private keys.
│   │   │                         VULN_PATTERNS: SQL injection, eval(), Math.random() tokens.
│   │   │                         Exits code 1 on critical findings (CI-friendly).
│   │   │
│   │   ├── fix.js                Same scan as audit.js, split into autoFixable vs needsPrompt.
│   │   │                         autoFix.apply() rewrites file content.
│   │   │                         logSecurityDebt() appends to epics/[epic]/DEBT.md.
│   │   │
│   │   ├── status.js             Reads STATE.md + MEMORY.md, prints project state.
│   │   │                         --verbose walks .buildflow/ tree.
│   │   │
│   │   └── update.js             Re-runs install.js to refresh command files.
│   │
│   └── utils/
│       └── welcome.js            Shown when buildflow runs with no arguments.
│
├── templates/
│   ├── CLAUDE.md                 Written to project root for Claude Code.
│   │                             Contains: session start checklist (6 steps including
│   │                             token counter reset), v7.0 workflow, STATE.md resume
│   │                             contract, context clear recommendation, token cost
│   │                             tracking explanation, core rules, agents table.
│   │
│   └── commands/                 27 markdown files — one per slash command.
│       ├── start-epic.md         Vision, drift detection, epic history load
│       ├── think.md              Parallel research + 5 analysis modes + global learnings context
│       ├── discuss.md            Pre-plan decision workshop — surface, research, lock decisions with confidence scores
│       ├── spec.md               REQUIREMENTS + DESIGN + ACs, versioning, approval audit trail, amendment gate
│       ├── plan.md               AC-traced waves, VERIFICATION.md ledger, thin-slice ordering, file ownership, focused post-change test plan, engineering review
│       ├── build.md              Wave execution, worktree isolation, deviation handling, schema drift, focused testing, scope-reduction detection
│       ├── test.md               Standalone test + fix loop
│       ├── check.md              4-reviewer parallel check, scope-reduction detection, schema drift, spec coverage
│       ├── ship.md               4 gates, SHIPPED.md, post-ship advisor, git/no-git tag
│       ├── hotfix.md             Fast-path fix with dual-mode restore point
│       ├── onboard.md            5-lens analysis, feature inventory, local/locale support maps, symbol-level import graph, intel.json, drift baseline
│       ├── modify.md             Symbol-level impact analysis, test coverage, surgical change
│       ├── refactor.md           Quality improvement without behavior change
│       ├── audit.md              OWASP Top 10 + container CVE scan + language dependency audit
│       ├── debug.md              Root-cause analysis, scientific method
│       ├── deploy.md             Pre-flight, Docker deployment path, migrations, health check
│       ├── docker.md             Scaffold, build, run, push, scan, shell, clean
│       ├── workspace.md          Monorepo mapping, cross-service contract detection, blast radius
│       ├── status.md             Epic, AC bar, token spend with session total, debt, suggestions
│       ├── explain.md            Plain-language explanation
│       ├── back.md               Undo with dual-mode restore point
│       ├── revert.md             Revert current, last, or named epic spec and plan artifacts
│       ├── complete-epic.md      Milestone archival, global learnings write, release tag, state reset
│       ├── settings.md           13-item interactive settings menu (git, workflow, yolo, coverage, security)
│       ├── ui-spec.md            UI design contract — color system, typography, spacing, components, a11y
│       ├── ui-review.md          6-dimension UI audit against design contract (PASS/WARN/FAIL per dimension)
│       └── help.md               Diagnostic, 12 recovery paths, git recovery, global learnings, feature advisor
│
├── .gitignore
├── LICENSE                       MIT
├── README.md                     This file
└── package.json                  type: module, bin: buildflow + bf, files: bin/ src/ templates/
```

---

## The .buildflow/ Scaffold

Global files are created at init. Epic-specific files are created on demand by the command that needs them.

```
.buildflow/
│
├── VISION.md           ← created at init — what we're building (global, all epics)
├── STATE.md            ← created at init — current epic, status, epic history
├── PREFERENCES.md      ← created at init — experience level, git permission, workflow
│                         toggles, spec coverage threshold, path_permissions
├── MEMORY.md           ← created at init — persistent context ≤3K tokens, auto-pruned
├── GLOSSARY.md         ← created at init — project terminology, grows with /buildflow-explain
│
├── debug/              ← created at init — /buildflow-debug records outside any active epic
│   └── DEBUG-001.md
├── hotfix/             ← created at init — /buildflow-hotfix records outside any active epic
│   └── HOTFIX-001.md
│
├── epics/              ← created at init (subdirs named N-slug, added per epic)
│   └── 1-auth/         ← single source of truth for epic "1-auth" — all workflow artifacts live here
│       ├── STATE.md        Compact resume contract — loaded at every session start
│       ├── RESEARCH.md     ← /buildflow-think output with source citations
│       ├── DECISIONS.md    ← /buildflow-discuss locked decisions log
│       ├── REQUIREMENTS.md ← /buildflow-spec product requirements
│       ├── DESIGN.md       ← /buildflow-spec technical design + API contracts
│       ├── ACCEPTANCE.md   ← /buildflow-spec acceptance criteria (AC-001…)
│       ├── APPROVALS.md    ← /buildflow-spec approval audit trail — never pruned
│       ├── PLAN.md         ← /buildflow-spec wave plan with spec_version + file ownership (generated in one pass)
│       ├── VERIFICATION.md ← /buildflow-build AC ledger with test evidence
│       ├── COVERAGE.md     ← /buildflow-check spec coverage traceability + decisions
│       ├── AUDIT.md        ← /buildflow-audit OWASP security scan report
│       ├── SHIPPED.md      ← /buildflow-ship ≤500-token cross-epic summary
│       ├── RETRO.md        ← /buildflow-ship archived MEMORY.md data after ship
│       ├── DEBT.md         ← deferred issues: CVEs accepted, coverage drops, parked debt
│       ├── SUGGESTIONS.md  ← /buildflow-ship post-ship feature advisor output
│       ├── UI-SPEC.md      ← /buildflow-ui-spec UI design contract
│       ├── debug/          ← /buildflow-debug session records during this epic
│       │   └── DEBUG-001.md    Root cause, hypothesis chain, fix, test evidence
│       └── hotfix/         ← /buildflow-hotfix records during this epic
│           └── HOTFIX-001.md   Problem, fix, files changed, restore point, test results
│
└── codebase/           ← /buildflow-onboard (existing projects only)
    ├── MAP.md, STACK.md, STRUCTURE.md, INTEGRATIONS.md, TESTING.md
    ├── CONCERNS.md, GRAPH.md, PATTERNS.md, FEATURES.md, HOTSPOTS.md
    └── intel.json          Machine-readable index with symbol-level data and drift baseline
```

---

## Template System

Templates follow this format:

```markdown
---
name: buildflow-build
description: Wave execution with auto-test, auto-fix, and PR-ready commits
allowed-tools: Read, Write, Bash, Grep, Glob
agents: builder, reviewer
---

# /buildflow-build

Steps the AI follows when this command is triggered...
```

The `agent:` / `agents:` field names the specialized persona(s). The `allowed-tools:` field limits which tools the agent can use, keeping the context surface minimal.

**How templates become commands per tool:**

| Tool | Where templates go | File naming |
|------|--------------------|-------------|
| Claude Code | `.claude/commands/` or `~/.claude/commands/` | `buildflow-build.md` |
| Gemini CLI | `.gemini/commands/` + appended to `GEMINI.md` | `build.md` |
| Codex CLI | `.codex/instructions/` + `.codex/skills/` | `buildflow-build.md` |
| Cursor | `.cursor/rules/buildflow.mdc` | Single combined file |
| Cline | `.clinerules` (project root) | Single combined file |
| Continue | `.continue/buildflow/` + `config.json` patch | `build.md` |

---

## 9 Specialized Agents

Each agent gets a fresh context window with a minimal context packet — no context rot, no wasted tokens.

| Agent | Persona | Commands |
|-------|---------|----------|
| 🎯 **Strategist** | Vision, decisions, orientation | `start`, `spec`, `ship`, `deploy`, `status`, `explain`, `back`, `help` |
| 🔍 **Researcher** | Web research with source trust scores | `think` (parallel × 3), `ship` (post-ship advisor) |
| 🔄 **Synthesizer** | Combines parallel research output | `think` |
| 🏗️ **Architect** | Dependency mapping, wave planning, Docker scaffolding | `plan`, `docker`, `workspace` |
| ⚒️ **Builder** | Style-matched code generation | `build` (parallel per wave) |
| 🔬 **Reviewer** | Spec compliance + quality checks | `check` (parallel × 4), `build`, `test` |
| 🗺️ **Cartographer** | Codebase analysis, symbol graph | `onboard` |
| 🩺 **Surgeon** | Minimal-footprint code modification | `modify`, `refactor`, `hotfix`, `debug` |
| 🔒 **Security Auditor** | OWASP Top 10 + container CVE scan | `audit`, `ship` (pre-ship gate) |

---

## v7.0: What's New

### `/buildflow-discuss` — Pre-Plan Decision Workshop

New command that captures key architectural decisions before speccing. Surfaces blocking and high-impact open decisions, optionally spawns parallel Researchers per option, produces a locked decision with confidence score (1–5), and saves it to `.buildflow/epics/[epic]/DECISIONS.md` as a spec constraint. Usage: `/buildflow-discuss`, `/buildflow-discuss "database choice"`, `/buildflow-discuss --review`.

### Scope-Reduction Detection

`/buildflow-build` and `/buildflow-check` now cross-reference every AC in `ACCEPTANCE.md` against tasks in `PLAN.md`. Dropped ACs surface as WARN (1–2 dropped) or BLOCK (3+ or >20%). Prevents the AI from silently shrinking the spec during planning.

### `/buildflow-ui-spec` — UI Design Contract

Generates a locked `.buildflow/epics/[epic]/UI-SPEC.md` before any frontend phase. Detects existing CSS framework (Tailwind, MUI, Chakra, etc.), documents color system, typography scale, spacing, component inventory with variants and states, responsive breakpoints, and accessibility requirements. Builder agents follow this contract automatically.

### `/buildflow-ui-review` — 6-Dimension UI Audit

Retroactive audit of UI implementation against the design contract. Scores 6 dimensions — color consistency, typography, spacing, component coverage, responsive behavior, accessibility — with PASS/WARN/FAIL verdicts and a prioritized fix list. Saves report to `.buildflow/epics/[epic]/AUDIT.md`.

### Global Learnings Store

`/buildflow-complete-epic` now extracts 2–4 cross-project insights at milestone completion and appends them to `~/.buildflow/learnings/global.md`. At every session start, BuildFlow reads this file and surfaces relevant entries (matched by framework/language). `/buildflow-think` includes matching global entries in each Researcher's context packet.

### Workflow Toggles + Yolo Mode

New `workflow` block in `PREFERENCES.md`: `require_think`, `require_check`, `research_depth` (quick/standard/thorough), `auto_wave_retry`, and `skip_prompts`. When `skip_prompts: true` (yolo mode), all non-destructive confirmation gates auto-proceed. Destructive gates still require explicit confirmation.

### Interactive Settings (`/buildflow-settings`)

13-item settings menu covering all preferences without manual markdown editing: experience level, git permission, token tracking, spec coverage threshold, strict mode, parallel agents, security gate, workflow toggles, and yolo mode.

### `/buildflow-complete-epic` — Milestone Archival

Replaces the removed `/buildflow-complete-milestone`. Archives all shipped epics, prompts for milestone name and version, writes `MILESTONE.md`, creates a git tag (`git.permission: approved`), deep-prunes memory, and resets state for the next cycle.

### 15-Language Runtime Support

`npx buildflow-dev init` now detects 15 language families: JavaScript/TypeScript (7 frameworks), Python, Rust, Go, Java (Maven), Kotlin (Gradle), C# / .NET, Ruby, PHP, Dart/Flutter, Swift, Scala, **Elixir** (Phoenix), **C/C++** (CMake/Make), and **Haskell** (Stack/Cabal).

### CI/CD Infrastructure (`.github/`)

Added `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, and `.github/workflows/ci.yml` (4 jobs: test on Node 18/20/22, lint, template validation, security audit).

### v6.0 Highlights (carried forward)

| Feature | Description |
|---------|-------------|
| **Epic STATE.md resume** | Each epic keeps a compact resume file — fresh sessions continue from it without chat history |
| **Spec governance** | Versioned specs, approval audit trail, amendment gate, spec diff viewer |
| **Git permission system** | Setup-time prompt, no-git mode with file snapshots, parked changes |
| **Build telemetry** | Type-check + lint + coverage + bundle size gates at every wave |
| **File ownership map** | Each file owned by exactly one wave, conflict detection |
| **Thin-slice ordering** | DB → API → UI enforced in every plan |
| **Multi-cycle plan review** | 7-dimension engineering review, loops until APPROVED |
| **Deviation handling** | HARD/SOFT/SCOPE tiers with structured records |
| **Schema drift detection** | Unapplied migrations flagged at wave commit and check |
| **Cross-epic regression** | Full suite run at ship, baseline from last ship |
| **Git worktree isolation** | Each Builder works in an isolated worktree |
| **5-lens onboarding** | Arch/Quality/Security/Data/Features lenses in parallel |
| **Queryable intel.json** | Machine-readable codebase index for agent lookups |
| **Auto-drift detection** | Schema and load-bearing file changes detected at session start |
| **Multi-repo workspace** | Cross-repo contract detection and blast-radius analysis |
| **Post-ship feature advisor** | Auto market research + engineering standards gaps after every ship |
| **SHIPPED.md cross-epic continuity** | ≤500-token epic summary loaded by future epics |

---

## Token Economics

| Scenario | Tokens | Notes |
|----------|--------|-------|
| Greenfield full workflow | 120–150K | All epics, one session |
| Onboarding existing project | +35–40K | One-time cost, pays back every session |
| `/buildflow-spec` | ~40K | Per epic — REQUIREMENTS + DESIGN + ACs + PLAN + VERIFICATION in one pass |
| `/buildflow-discuss` | ~20–35K | Optional post-spec clarification (no research: 20K, with parallel researchers: 35K) |
| `/buildflow-build` per wave | ~50K | Context packets keep Builders lean |
| `/buildflow-check` | ~26K | 4 reviewers + drift + coverage + scope-reduction check |
| `/buildflow-ship` | ~40K | 4 gates + post-ship market research |
| `/buildflow-ui-spec` | ~12K | One-time per frontend epic |
| `/buildflow-ui-review` | ~15–25K | --quick: 15K / full 6-dimension audit: 25K |
| `/buildflow-docker scaffold` | ~10K | One-time Dockerfile + Compose generation |
| `/buildflow-hotfix` | ~10K | 5× cheaper than a full build cycle |
| `/buildflow-complete-epic` | ~12K | Milestone archival + global learnings write |
| Light memory load per session | ~1.5K | Pruned to ≤3K — saves ~10K in re-detection |
| Context pruning savings | −5–15K | Stale epic data archived not reloaded |

**Token efficiency strategy:**
- `MEMORY.md` stays under 3K (auto-pruned at session start and after each ship)
- Each agent gets a minimal context packet: task spec + relevant files only
- Builders never load the full codebase — context packets have max 5 relevant files
- Old epic data archived to `epics/[epic]/RETRO.md`, never reloaded unless explicitly requested
- Symbol-level intel.json lookups replace loading full GRAPH.md (−10K per modify)

---

## Contributing

### Dev setup

```bash
git clone https://github.com/Vikas-gurrapu/buildflow.git
cd buildflow
npm install
node bin/buildflow.js --help
```

### Project conventions

- **ES Modules only** — `"type": "module"`. Use `import/export`, never `require()`.
- **Node 18+ compatibility** — use `dirname(fileURLToPath(import.meta.url))`, not `import.meta.dirname`.
- **No TypeScript, no bundler** — source files run directly. Zero build step.
- **Lazy command imports** — `bin/buildflow.js` uses `() => import(...)` for fast startup.
- **Keep epic commands resumable** - major epic templates must read/update `.buildflow/epics/[epic]/STATE.md`.
- **Respect user permissions** - template changes that read/write project folders must mention Folder Access Guard behavior.
- **Post-change testing only** - do not add failing-test-first or test-before-code flows. Add/update tests after implementation and keep first runs focused on touched files and dependencies.

### Adding a new AI tool

1. Add an entry to the `TOOLS` object in [`src/commands/install.js`](src/commands/install.js)
2. Implement `detect()`, `installGlobal()`, `installLocal()`, and `triggerNote`
3. Ensure install output includes update checks, Folder Access Guard instructions, and epic `STATE.md` resume rules
4. Add it to the Supported AI Tools table in this README

### Adding a new slash command

1. Create `templates/commands/<name>.md` with frontmatter + numbered steps
2. Add the name to `commandNames` in `loadCommandTemplates()` in [`install.js`](src/commands/install.js) **and** to `COMMAND_NAMES` in [`uninstall.js`](src/commands/uninstall.js)
3. If it is a major epic command, add an Epic State Resume step that reads and updates `.buildflow/epics/[epic]/STATE.md`
4. Add it to the quick reference table in [`templates/CLAUDE.md`](templates/CLAUDE.md)
5. Document it in the AI Slash Commands table in this README

### Adding a new auto-fix to `buildflow fix`

```js
{
  pattern: /somePattern/g,
  label: 'Description of the issue',
  severity: 'HIGH',
  owasp: 'A03',
  autoFix: {
    description: 'What the fix does (shown before applying)',
    apply: (content) => content.replace(/somePattern/g, 'saferAlternative'),
    note: 'Optional post-fix note',
  },
}
```

---

## Publishing

```bash
# Verify package contents before publishing:
npm test
npm publish --dry-run

# Bump version if needed:
npm version major --no-git-tag-version   # or minor/patch

# Then publish:
npm login
npm publish
```

Only these paths are included (`files` in `package.json`):
- `bin/` — CLI entry point
- `src/` — command and utility modules
- `templates/` — slash command markdown files and CLAUDE.md template
- `README.md` + `LICENSE`

Publishing notes:
- Update both `package.json` and `package-lock.json` when changing the version.
- Commit source changes before publishing so the npm package and repository match.
- After publish, run `npx buildflow-dev@latest update --check` from a sample project.
- If publishing fails with npm 404 for a new package name, confirm npm ownership/name availability and use `npm publish --access public` for a first public scoped package.

---

## License

MIT © 2026 [Vikas Gurrapu](https://github.com/Vikas-gurrapu)
