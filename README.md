# BuildFlow

> Spec-driven, multi-agent AI development orchestration — for Claude Code, Gemini CLI, Codex CLI, Cursor, Cline, and Continue.

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
- [Docker Integration](#docker-integration)
- [Codebase Intelligence](#codebase-intelligence)
- [Post-Ship Feature Advisor](#post-ship-feature-advisor)
- [How It Works](#how-it-works)
- [Package Source Structure](#package-source-structure)
- [The .buildflow/ Scaffold](#the-buildflow-scaffold)
- [Template System](#template-system)
- [9 Specialized Agents](#9-specialized-agents)
- [v5.0: What Changed](#v50-what-changed)
- [Token Economics](#token-economics)
- [Contributing](#contributing)
- [Publishing](#publishing)

---

## What is BuildFlow?

BuildFlow is a **CLI tool** that installs a spec-driven, multi-agent AI workflow into any project. It does two things:

1. **Scaffolds `.buildflow/`** — markdown files that act as persistent memory, formal specs, project state, and agent instructions
2. **Installs slash commands** — writes `/buildflow-*` command files into whichever AI tools you use (Claude Code, Cursor, Gemini CLI, etc.)

Once installed, you work entirely inside your AI tool using `/buildflow-*` commands.

**Four core ideas that separate BuildFlow from other tools:**

- **Spec-first:** Every phase starts with a formal PRD + Technical Design + Acceptance Criteria. Plans trace to ACs. Ship is blocked if any AC is unsatisfied.
- **Context isolation:** Each agent receives a minimal context packet — only what it needs. No context rot, no wasted tokens.
- **Auto-prune:** `light.md` is automatically compressed at session start and after each ship. Long sessions stay lean.
- **Measured token costs:** Every command reports actual token usage (context loaded + output generated) and accumulates a session total — not estimates.

---

## Quick Start

```bash
# Run once in any project directory
npx buildflow-dev init
```

This will:
1. Detect your project (framework, language, Docker, existing code vs. greenfield)
2. Ask for your app name and experience level
3. **Ask for git permission** (approve / deny / deny permanently)
4. Create `.buildflow/` with memory, state, preferences, and agent config files
5. Detect which AI tools you have installed
6. Write `/buildflow-*` slash commands into each detected tool

Then open your AI tool and type `/buildflow-start` to begin.

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
| `/buildflow-start` | Strategist | Capture vision, detect drift vs last session, load phase history | ~8K |
| `/buildflow-think [topic]` | Researcher × 3 + Synthesizer | Parallel research. Modes: `--arch`, `--build-vs-buy`, `--debt`, `--complexity` | ~30K |
| `/buildflow-spec` | Strategist | Generate PRD + TDD + ACs with versioning, approval audit trail, and amendment gate | ~20K |
| `/buildflow-plan` | Architect | AC-traced waves, thin-slice ordering, exclusive file ownership, [TF] failing-test-first, multi-cycle engineering review | ~22K |
| `/buildflow-build [wave]` | Builder × N + Reviewer | Wave execution with git worktree isolation, deviation handling, schema drift check, cross-phase regression | ~50K/wave |
| `/buildflow-test [wave]` | Reviewer | Standalone test + fix loop — re-verify a wave or test a manual change | ~25K |
| `/buildflow-check` | Reviewer × 4 | Spec compliance + correctness + quality + security + schema drift + spec coverage traceability | ~26K |
| `/buildflow-ship` | Strategist + Security Auditor | 4 gates: spec version, security, tests + regression, build telemetry. Context pruning + SHIPPED.md + post-ship advisor | ~40K |

### Existing Codebases

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-onboard` | Cartographer | 4-lens analysis (arch/quality/security/data), **symbol-level import graph**, load-bearing files, risk scores, queryable `intel.json` | ~40K |
| `/buildflow-modify "desc"` | Surgeon | **Symbol-level** transitive impact (exact call sites), risk scores, test coverage map, API contract check | ~30K |
| `/buildflow-refactor [scope]` | Surgeon + Reviewer | Quality improvement without behavior change | ~40K |

### Debugging & Deployment

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-hotfix "desc"` | Surgeon | Fast-path: restore point → fix → test → commit. No spec, no plan, no waves | ~10K |
| `/buildflow-debug` | Surgeon | Root-cause analysis — traces error to source, applies minimal fix | ~20K |
| `/buildflow-deploy [env]` | Strategist | Pre-flight → build → image scan → push → migrate → smoke test. Full Docker path included | ~15K |
| `/buildflow-docker [cmd]` | Architect | Scaffold Dockerfile + Compose, build, run, push to registry, image CVE scan | ~15K |

### Security

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-audit` | Security Auditor | OWASP Top 10 + **container CVE scan** (docker scout / Trivy) + Dockerfile misconfiguration check + language-specific dependency audit | ~35K |
| `/buildflow-audit --quick` | Security Auditor | Recently changed files only | ~15K |
| `/buildflow-audit --pre-ship` | Security Auditor | Secrets + critical patterns only | ~10K |

### Multi-Repo & Workspace

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-workspace` | Architect | Monorepo / polyrepo mapping, cross-repo contract detection (TypeScript types, REST, tRPC, GraphQL, gRPC), blast-radius analysis | ~25K |
| `/buildflow-workspace impact <change>` | Architect | Which services are affected by a change, suggested build order | ~15K |

### Utility

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-status` | Strategist | Phase progress, AC bar, build quality, debt, session token total, next action | ~5K |
| `/buildflow-explain <term/file>` | Strategist | Plain-language explanation of code, concepts, or errors | ~2K |
| `/buildflow-back [n]` | Strategist | Undo to restore point (git stash or file snapshot), update state | ~3K |
| `/buildflow-help` | Strategist | Diagnostic mode, 12 recovery paths, git recovery, post-milestone feature advisor | ~15–35K |

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
buildflow audit                     # Pattern-based security scan, saves report
buildflow audit --quick             # Scan recent changes only
buildflow audit --target src/api/   # Scan a specific directory
buildflow audit --report            # Print the most recent saved report
buildflow fix                       # Interactive issue scanner + auto-fixer
buildflow fix --target src/         # Fix issues in a specific directory
buildflow status                    # Print current phase and project state
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
```

BuildFlow will:
- Auto-detect language, framework, Docker, existing tests
- Ask for git permission (stored permanently in `preferences.md`)
- Scaffold `.buildflow/` with all config files
- Install commands into detected AI tools

### 2. Start a session

```
/buildflow-start
```

Loads vision, detects codebase drift vs last session (file count, schema changes, load-bearing symbol changes), prints phase history from previous SHIPPED.md files. Resets the session token counter.

### 3. Research (optional)

```
/buildflow-think auth-strategy
```

3 Researchers run in parallel. Synthesizer combines results. Output saved to `.buildflow/research/`.

### 4. Spec — formal artifacts required before planning

```
/buildflow-spec
```

Generates three locked files with frontmatter versioning:

```
.buildflow/specs/
├── PRD.md          ← What, for whom, success criteria, out of scope
├── TDD.md          ← Architecture, API contracts, component breakdown
└── acceptance.md   ← Testable AC-001, AC-002... with spec_version: 1
```

Approval is written to `specs/approvals.md` (permanent audit trail, never pruned).
If the spec changes mid-phase, an amendment gate requires explicit confirmation and marks PLAN.md stale.

### 5. Plan — waves with AC tracing and safety checks

```
/buildflow-plan
```

The Architect produces `phases/N/PLAN.md` with:
- Every task traced to an AC
- **Thin-slice ordering** enforced: DB/schema → API/services → UI → integration
- **Exclusive file ownership** — each file owned by exactly one wave, conflicts detected and resolved
- **[TF] failing-test-first** tags on new/modified tasks — Builder must confirm test fails before implementing
- **Multi-cycle engineering review** — plan loops until all 7 dimensions are APPROVED
- `spec_version` recorded in PLAN.md header for ship-time version check

### 6. Build — wave-by-wave execution with safety rails

```
/buildflow-build
```

For each wave:
- **Git worktree isolation** per Builder (no-git fallback: serialized execution)
- **Deviation handling**: HARD (must resolve) / SOFT (proceed with note) / SCOPE (escalate to user)
- **Schema drift check** at wave commit — unapplied migrations flagged immediately
- **Build telemetry** after each wave: type-check → lint → test coverage (F/P/S prompt, never hard-block) → bundle size
- **Cross-phase regression** at wave 4: full suite run, baseline from `last_ship_test_count`
- **Parked-changes conflict check** before build start: warns if new phase touches files from a previous failed git commit

### 7. Check

```
/buildflow-check
```

4 parallel Reviewers: spec compliance, correctness, quality, security.
Also runs:
- **Schema drift detection** — unapplied migrations, schema-consumer mismatches
- **Spec coverage traceability** — reverse map of source files to ACs. Below configurable threshold → smart prompt (bugfix exception / incremental coverage exception / add ACs / proceed)

### 8. Ship — 4 mandatory gates

```
/buildflow-ship
```

| Gate | What it checks | On failure |
|------|---------------|------------|
| **Gate 0a** | `spec_version` in PLAN.md matches current `acceptance.md` | BLOCK |
| **Gate 0b** | Every AC is ✓ PASS | BLOCK |
| **Gate 1** | Security scan (changed files only) | CRITICAL → BLOCK, HIGH → WARN |
| **Gate 2a** | Current phase tests pass | BLOCK |
| **Gate 2b** | Cross-phase regression (vs `last_ship_test_count` baseline) | BLOCK |
| **Gate 3** | Type-check BLOCK · Lint errors BLOCK · Compile BLOCK · Coverage smart-prompt · Bundle size alert · **Docker build** (if Dockerfile) | Type/compile/Docker → BLOCK |

After gates pass:
- Retrospective written to `phases/N/retro.md`
- `light.md` pruned to under 3K tokens
- `phases/N/SHIPPED.md` written (≤500 tokens, loaded by future phases)
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

The choice is stored in `.buildflow/you/preferences.md` under `git.permission` and in `light.md` under `git_available`. It persists across all sessions.

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
| `git stash` | `.buildflow/snapshots/pre-modify-[timestamp]/` |
| Wave commit | Recorded in `PLAN.md` task file lists |
| Phase tag | `state.md` entry with snapshot path |
| Changed-file detection | PLAN.md task `Files to create/modify` fields |

**Parked changes**: If git fails mid-build, BuildFlow prompts:
- **Retry** — wait for git to recover
- **Park** — save a snapshot, continue working, commit later
- **Warn only** — proceed without committing

Parked entries are tracked in `light.md → parked_changes[]`. When a new phase touches files with parked changes, BuildFlow warns and offers to resolve or take a stack snapshot.

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
3. Add to `state.md → session_tokens_used` running total
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

**Session total** is reset at every `/buildflow-start`. View anytime with `/buildflow-status`.

**Configure in `preferences.md`:**
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
Every `acceptance.md` has a frontmatter header:
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
Every approval is appended to `specs/approvals.md` — a permanent file that is **never pruned or deleted**, even after ship.

### Amendment gate
If you change the spec while a build is in progress:
1. BuildFlow requires typing `"amend"` to confirm
2. Shows which ACs changed and which plan tasks are affected
3. Marks `PLAN.md` as stale — `/buildflow-build` is blocked until you re-run `/buildflow-plan`

### Spec diff viewer
```
/buildflow-spec --review
```
Shows a side-by-side before/after of every changed AC between the current spec version and the version the plan was built against.

### Version consistency enforcement
At plan time, at build start, and at ship Gate 0a — the `spec_version` in `PLAN.md` is checked against the current `acceptance.md`. Any mismatch blocks progression.

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

Runs `docker scout` (if available) or Trivy. Reports CVEs by severity, suggests base image improvements, appends critical findings to `security/DEBT.md`.

### Pipeline integration

| Stage | Docker hook |
|-------|------------|
| After each build wave | Non-blocking warning if `docker build` fails |
| `/buildflow-ship` Gate 3 | **Blocking** Docker build check — ship blocked if image fails |
| `/buildflow-deploy` | Full Docker path: build → scan → push → pull on host → migrate → health check |
| `/buildflow-audit` | Dockerfile misconfiguration scan (running as root, secrets in ENV/ARG, missing HEALTHCHECK) + image CVE scan |

**Configure in `preferences.md`:**
```yaml
docker:
  detected: true
  auto_build_check: true   # warn after each wave
  scan_before_push: true   # CVE scan before deploy push
```

---

## Codebase Intelligence

### `/buildflow-onboard` — 4-Lens Analysis

Runs four parallel analyses on your codebase:

| Lens | What it produces |
|------|-----------------|
| **Architecture** | Entry points, layer pattern (MVC/hexagonal/feature-based), module boundaries |
| **Quality** | Largest files, test coverage estimate, TODO/FIXME density |
| **Security** | Auth surface, potential secret refs, dangerous API usage |
| **Data** | ORM/migration state, schema file locations, query patterns |

### Symbol-Level Import Graph

`/buildflow-onboard` extracts exported symbols (functions, classes, methods) for every source file, then builds a reverse caller index:

```
AuthService.login      → routes/auth.ts:45, routes/auth.ts:89, tests/auth.test.ts:8
AuthService.register   → routes/auth.ts:62, tests/auth.test.ts:20
DBClient.query         → auth/service.ts:34, users/service.ts:18, orders/service.ts:7
```

This is stored in `.buildflow/codebase/intel.json` under `symbol_callers`.

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

At every session start (`/buildflow-start`), BuildFlow compares the current codebase against the `drift_baseline` recorded at onboard time:
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

Saved to `.buildflow/learnings/feature-suggestions.md`. Also available anytime via `/buildflow-help next`.

---

## How It Works

### The install flow

```
npx buildflow-dev init
        │
        ├─ detectProjectInfo()     Reads package.json, pom.xml, build.gradle, Cargo.toml,
        │                          go.mod, Gemfile, composer.json, pubspec.yaml,
        │                          Package.swift, build.sbt, .csproj
        │                          → language, framework, hasDocker, hasTests, hasGit
        │
        ├─ Git permission prompt   approve / deny / deny_permanent
        │                          → stored in preferences.md + light.md
        │
        ├─ scaffoldBuildflow()     Creates .buildflow/ folder tree with pre-filled files:
        │                          core/, specs/, you/, memory/, codebase/, phases/,
        │                          snapshots/, security/, learnings/
        │
        ├─ patchGitignore()        Adds .buildflow/security/reports/ and snapshots/
        │
        ├─ ensureGit()             Only if git.permission === 'approved'
        │
        └─ runInstall()            Detects AI tools → writes command files per tool
                                   Loads all 21 command templates from templates/commands/
```

### Session start (CLAUDE.md checklist)

Every AI session runs this automatically:

1. Check for BuildFlow updates
2. Prune `light.md` if over 3K tokens
3. Load `state.md` for current phase
4. Detect git availability, set `git_available` in `light.md`
5. Run codebase drift check against `intel.json` baseline
6. Reset `session_tokens_used: 0` in `state.md`

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
│   │   ├── init.js               Detects 12 languages/frameworks + Docker.
│   │   │                         Git permission prompt. Scaffolds .buildflow/.
│   │   │                         Writes preferences.md, light.md, state.md, vision.md,
│   │   │                         approvals.md, feature-suggestions.md scaffolds.
│   │   │
│   │   ├── install.js            TOOLS object: one entry per supported AI tool.
│   │   │                         Each tool has: detect(), installGlobal(), installLocal().
│   │   │                         loadCommandTemplates() reads all 21 .md files from
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
│   │   │                         logSecurityDebt() appends to security/DEBT.md.
│   │   │
│   │   ├── status.js             Reads state.md + light.md, prints project state.
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
│   │                             token counter reset), v5.0 workflow, full quick reference,
│   │                             token cost tracking explanation, core rules, agents table.
│   │
│   └── commands/                 21 markdown files — one per slash command.
│       ├── start.md              Vision, drift detection, phase history load
│       ├── think.md              Parallel research + 5 analysis modes
│       ├── spec.md               PRD + TDD + ACs, versioning, approval audit trail, amendment gate
│       ├── plan.md               AC-traced waves, thin-slice ordering, file ownership, [TF] tags, engineering review
│       ├── build.md              Wave execution, worktree isolation, deviation handling, schema drift, build telemetry
│       ├── test.md               Standalone test + fix loop
│       ├── check.md              4-reviewer parallel check, schema drift, spec coverage with smart prompt
│       ├── ship.md               4 gates, SHIPPED.md, post-ship advisor, git/no-git tag
│       ├── hotfix.md             Fast-path fix with dual-mode restore point
│       ├── onboard.md            4-lens analysis, symbol-level import graph, intel.json, drift baseline
│       ├── modify.md             Symbol-level impact analysis, test coverage, surgical change
│       ├── refactor.md           Quality improvement without behavior change
│       ├── audit.md              OWASP Top 10 + container CVE scan + language dependency audit
│       ├── debug.md              Root-cause analysis, scientific method
│       ├── deploy.md             Pre-flight, Docker deployment path, migrations, health check
│       ├── docker.md             Scaffold, build, run, push, scan, shell, clean
│       ├── workspace.md          Monorepo mapping, cross-service contract detection, blast radius
│       ├── status.md             Phase, AC bar, token spend with session total, debt, suggestions
│       ├── explain.md            Plain-language explanation
│       ├── back.md               Undo with dual-mode restore point
│       └── help.md               Diagnostic, 12 recovery paths, git recovery, feature advisor
│
├── .gitignore
├── LICENSE                       MIT
├── README.md                     This file
└── package.json                  type: module, bin: buildflow + bf, files: bin/ src/ templates/
```

---

## The .buildflow/ Scaffold

```
.buildflow/
│
├── core/
│   ├── vision.md           Project purpose, target users, success criteria. Read by all agents.
│   └── state.md            Phase, status, phase history table, token tracking counter.
│
├── you/
│   └── preferences.md      Experience level, learning aids, safety settings, git permission,
│                           spec coverage threshold, token tracking config, Docker config.
│
├── specs/                  Generated by /buildflow-spec
│   ├── PRD.md              Product Requirements with versioned frontmatter
│   ├── TDD.md              Technical Design Document
│   ├── acceptance.md       Acceptance Criteria (AC-001…) with spec_version, changelog
│   └── approvals.md        Permanent approval audit trail — never pruned
│
├── memory/
│   └── light.md            Persistent context ≤3K tokens. Auto-pruned at session start
│                           and after each ship. Tracks: phase, framework, git_available,
│                           container_runtime, parked_changes, last build/test metrics.
│
├── phases/
│   └── N/
│       ├── PLAN.md         Wave plan with spec_version, file ownership map, [TF] column
│       ├── SHIPPED.md      ≤500-token cross-phase summary loaded by future /buildflow-start
│       ├── retro.md        Retrospective + archived light.md data
│       └── COVERAGE-MAP.md Spec coverage traceability + exception decisions
│
├── codebase/               Generated by /buildflow-onboard
│   ├── MAP.md              Architecture, module boundaries, load-bearing files
│   ├── GRAPH.md            File-level import graph + symbol caller index
│   ├── PATTERNS.md         Code conventions, test framework profile, build toolchain profile
│   ├── DEPENDENCIES.md     Dependencies with purpose, criticality, CVE status
│   ├── HOTSPOTS.md         Files with risk score ≥ 3.5
│   └── intel.json          Machine-readable index: file_index with symbol-level data,
│                           symbol_callers map, tech_stack, security_surface,
│                           schema, drift_baseline
│
├── snapshots/              File-based restore points (used when git unavailable)
│   ├── pre-modify-[ts]/    Files backed up before /buildflow-modify
│   ├── pre-hotfix-[ts]/    Files backed up before /buildflow-hotfix
│   ├── phase-N-wave-M-parked/    Parked wave snapshot (git commit failed)
│   └── phase-N-shipped/   Full src/ snapshot at ship time (no-git mode)
│
├── learnings/
│   ├── glossary.md         Project-specific terminology. Grows with /buildflow-explain.
│   ├── decisions.md        Architectural decisions with confidence levels
│   └── feature-suggestions.md   Post-ship market + standards gap analysis (auto-updated)
│
├── research/               Output from /buildflow-think sessions
│
└── security/
    ├── DEBT.md             Deferred issues: coverage drops, CVEs accepted, parked debt
    ├── reports/            Timestamped audit reports (gitignored)
    ├── rules/              Custom security rules
    └── suppressions/       False-positive suppressions
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

## v5.0: What Changed

### Multi-Language Support

Added full toolchain support for Java, Kotlin, C# / .NET, Ruby, PHP, Dart / Flutter, Swift, and Scala — alongside the existing TypeScript, Python, Go, and Rust. All 12 languages get correct type-check, lint, build, and test commands automatically detected at `init`.

### Docker Command (`/buildflow-docker`)

Full Docker lifecycle: scaffold multi-stage Dockerfiles for all 12 languages, Compose with services, image build/run/push/scan, hot-reload dev overlay. Integrated with ship gate, deploy, and audit.

### Symbol-Level Import Graph (GAP-H)

`/buildflow-onboard` now extracts exported functions/classes/types per file and builds a symbol caller index. `/buildflow-modify` uses exact call-site line numbers instead of file-level fan-in.

### Smart Spec Coverage

Configurable threshold in `preferences.md`. Context-aware prompt at check and ship time — bugfix exception, incremental coverage exception, never a hard block. Exception decisions in `COVERAGE-MAP.md` inherited at ship time.

### Measured Token Costs

Token costs are now measured from actual loaded file sizes and generated output length — not fixed estimates. Session running total in `state.md` reset at every session start.

### Earlier (v4.x) Highlights

| Feature | Description |
|---------|-------------|
| **Spec governance** | Versioned specs, approval audit trail, amendment gate, spec diff viewer |
| **Git permission system** | Setup-time prompt, no-git mode with file snapshots, parked changes |
| **Build telemetry** | Type-check + lint + coverage + bundle size gates at every wave |
| **File ownership map** | Each file owned by exactly one wave, conflict detection |
| **Thin-slice ordering** | DB → API → UI enforced in every plan |
| **[TF] failing-test-first** | Builder must confirm test fails before implementing |
| **Multi-cycle plan review** | 7-dimension engineering review, loops until APPROVED |
| **Deviation handling** | HARD/SOFT/SCOPE tiers with structured records |
| **Schema drift detection** | Unapplied migrations flagged at wave commit and check |
| **Cross-phase regression** | Full suite run at ship, baseline from last ship |
| **Git worktree isolation** | Each Builder works in an isolated worktree |
| **4-lens onboarding** | Arch/Quality/Security/Data lenses in parallel |
| **Queryable intel.json** | Machine-readable codebase index for agent lookups |
| **Auto-drift detection** | Schema and load-bearing file changes detected at session start |
| **Multi-repo workspace** | Cross-repo contract detection and blast-radius analysis |
| **Post-ship feature advisor** | Auto market research + engineering standards gaps after every ship |
| **SHIPPED.md cross-phase continuity** | ≤500-token phase summary loaded by future phases |

---

## Token Economics

| Scenario | Tokens | Notes |
|----------|--------|-------|
| Greenfield full workflow | 130–160K | All phases, one session |
| Onboarding existing project | +35–40K | One-time cost, pays back every session |
| `/buildflow-spec` | ~20K | Per phase — PRD + TDD + ACs |
| `/buildflow-plan` | ~22K | Per phase |
| `/buildflow-build` per wave | ~50K | Context packets keep Builders lean |
| `/buildflow-check` | ~26K | 4 reviewers + drift + coverage |
| `/buildflow-ship` | ~40K | 4 gates + post-ship market research |
| `/buildflow-docker scaffold` | ~10K | One-time Dockerfile + Compose generation |
| `/buildflow-hotfix` | ~10K | 5× cheaper than a full build cycle |
| Light memory load per session | ~1.5K | Pruned to ≤3K — saves ~10K in re-detection |
| Context pruning savings | −5–15K | Stale phase data archived not reloaded |

**Token efficiency strategy:**
- `light.md` stays under 3K (auto-pruned at session start and after each ship)
- Each agent gets a minimal context packet: task spec + relevant files only
- Builders never load the full codebase — context packets have max 5 relevant files
- Old phase data archived to `phases/N/retro.md`, never reloaded unless explicitly requested
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

### Adding a new AI tool

1. Add an entry to the `TOOLS` object in [`src/commands/install.js`](src/commands/install.js)
2. Implement `detect()`, `installGlobal()`, `installLocal()`, and `triggerNote`
3. Add it to the Supported AI Tools table in this README

### Adding a new slash command

1. Create `templates/commands/<name>.md` with frontmatter + numbered steps
2. Add the name to `commandNames` in `loadCommandTemplates()` in `install.js`
3. Document it in the AI Slash Commands table in this README

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
# Bump version in package.json, then:
npm login
npm publish

# Dry-run to see what gets published:
npm publish --dry-run
```

Only these paths are included (`files` in `package.json`):
- `bin/` — CLI entry point
- `src/` — command and utility modules
- `templates/` — slash command markdown files and CLAUDE.md template
- `README.md` + `LICENSE`

---

## License

MIT © 2026 [Vikas Gurrapu](https://github.com/Vikas-gurrapu)
