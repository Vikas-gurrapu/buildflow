# BuildFlow

> Adaptive AI-powered development orchestration for Claude Code, Gemini CLI, Codex CLI, Cursor, Cline, and Continue.

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
- [Example: Full Greenfield Flow](#example-full-greenfield-flow-phases--waves)
- [How It Works](#how-it-works)
- [Package Source Structure](#package-source-structure)
- [The .buildflow/ Scaffold](#the-buildflow-scaffold)
- [Template System](#template-system)
- [9 Specialized Agents](#9-specialized-agents)
- [Examples](#examples)
- [Token Economics](#token-economics)
- [Contributing](#contributing)
- [Publishing](#publishing)
- [Roadmap](#roadmap)

---

## What is BuildFlow?

BuildFlow is a **CLI tool** that installs a structured AI workflow into any project. It does two things:

1. **Scaffolds `.buildflow/`** — a folder of markdown files that act as persistent memory, project state, and agent instructions for your AI tool
2. **Installs slash commands** — writes `/buildflow-*` command files into whichever AI tools you use (Claude Code, Cursor, etc.)

Once installed, you work entirely inside your AI tool using `/buildflow-*` commands. BuildFlow itself stays out of your way — it only runs when you use the CLI (`buildflow audit`, `buildflow fix`, etc.) from the terminal.

**The core idea:** AI tools lose context as conversations grow ("context rot"). BuildFlow prevents this by breaking work into phases, using fresh agent sessions per task, and persisting only essential context in `.buildflow/memory/light.md`.

---

## Quick Start

```bash
# Run once in any project directory
npx buildflow-dev init
```

This will:
1. Detect your project (framework, language, existing code vs. greenfield)
2. Ask you 3 questions (app name, mode, security layer)
3. Create `.buildflow/` with memory, state, and agent config files
4. Detect which AI tools you have installed
5. Write `/buildflow-*` slash commands into each detected tool

Then open your AI tool and type `/` to see the commands.

```bash
# Or install globally so you can use it in any project
npm install -g buildflow-dev
buildflow init
```

---

## Supported AI Tools

| Tool | Auto-detect Method | Global Install Path | Local Install Path | Trigger |
|------|-------------------|--------------------|--------------------|---------|
| **Claude Code** | `claude` CLI or `~/.claude/` directory | `~/.claude/commands/buildflow-*.md` | `.claude/commands/buildflow-*.md` | `/buildflow-*` |
| **Gemini CLI** | `gemini` CLI | `~/.gemini/commands/*.md` + `~/.gemini/GEMINI.md` | `.gemini/commands/*.md` + `GEMINI.md` | `/buildflow-*` |
| **Codex CLI** | `codex` CLI | `~/.codex/instructions/` + `~/.codex/skills/` | `.codex/instructions/` + `.codex/skills/` | `$buildflow-*` |
| **Cursor** | `~/.cursor/` or `/Applications/Cursor.app` | (falls back to local) | `.cursor/rules/buildflow.mdc` | `@buildflow-*` |
| **Cline** | VS Code extension `saoudrizwan.claude-dev` | (falls back to local) | `.clinerules` | `/buildflow-*` |
| **Continue** | `~/.continue/config.json` | `~/.continue/buildflow/*.md` + config patch | `.continue/buildflow/*.md` | `/buildflow-*` |

**Detection logic** is in [`src/commands/install.js`](src/commands/install.js) — each tool has a `detect()` method that checks for CLI binaries via `which` and known config directories.

---

## AI Slash Commands

These are installed into your AI tool and triggered by typing `/` (or `@` / `$` depending on the tool).

### Workflow — Greenfield Projects

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-start` | Strategist | Begin project: asks vision questions, detects mode, saves to `core/vision.md` | ~8K |
| `/buildflow-think [topic]` | Researcher × 3 + Synthesizer | Parallel web research on a topic, synthesized into a recommendation | ~30K |
| `/buildflow-plan [phase]` | Architect | Maps task dependencies, groups into parallel waves, writes `phases/N/PLAN.md` | ~20K |
| `/buildflow-build [wave]` | Builder × N + Reviewer | Executes the plan wave-by-wave — each wave auto-tests, auto-fixes failures, and only advances when fully green | ~50K/wave |
| `/buildflow-test [wave]` | Reviewer | Standalone test + fix loop — re-verify a wave or test a manual change outside of `/buildflow-build` | ~25K |
| `/buildflow-check` | Reviewer × 3 | Three parallel reviewers check correctness, quality, and security | ~20K |
| `/buildflow-ship` | Strategist + Security Auditor | Pre-ship security gate → retrospective → git tag | ~22K |

### Workflow — Existing Codebases

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-onboard` | Cartographer | One-time analysis: writes `MAP.md`, `PATTERNS.md`, `DEPENDENCIES.md`, `HOTSPOTS.md` | ~35K |
| `/buildflow-modify "description"` | Surgeon | Surgical change with blast-radius analysis and restore point — use for features **and bugfixes** | ~30K |
| `/buildflow-refactor [scope]` | Surgeon + Reviewer | Improve code quality without changing behavior | ~40K |

**`/buildflow-modify` works for both features and bugs.** Pass a plain-English description either way:

```
# Feature
/buildflow-modify "Add pagination to the GET /users endpoint"

# Bugfix
/buildflow-modify "Fix null pointer crash when user has no profile photo"
/buildflow-modify "Fix login redirect loop when session expires"
```

The Surgeon always runs a blast-radius analysis first (what files are affected, what calls them) and creates a git restore point before touching anything — making it especially safe for bugfixes where a wrong change can cause regressions.

If you're not sure where the bug is yet, use `/buildflow-help` first — it's a diagnostic mode that helps you locate the problem before you try to fix it.

| Situation | Command |
|-----------|---------|
| Know what needs to change | `/buildflow-modify "fix description"` |
| Don't know where the bug is | `/buildflow-help` first, then `/buildflow-modify` |
| Tests failing after a change | `/buildflow-debug` |

### Debugging & Deployment

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-debug ["error"]` | Surgeon | Root-cause analysis for failing tests or broken behavior — traces error to source, applies minimal fix | ~20K |
| `/buildflow-deploy [env]` | Strategist | Pre-flight checks then deploy to staging or production | ~15K |

### Security

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-audit` | Security Auditor | Full OWASP Top 10 scan, writes report to `security/reports/` | ~35K |
| `/buildflow-audit --quick` | Security Auditor | Scans only recently changed files | ~15K |
| `/buildflow-audit --pre-ship` | Security Auditor | Lightweight secrets + critical patterns check only | ~10K |

### Utility

| Command | Agent | Purpose | Token Cost |
|---------|-------|---------|-----------|
| `/buildflow-status` | Strategist | Shows current phase, progress, and recommends next action | ~3K |
| `/buildflow-explain <term/file>` | Strategist | Plain-language explanation of code, files, or concepts | ~2K |
| `/buildflow-back [n]` | Strategist | Undo to a git restore point, updates state.md | ~3K |
| `/buildflow-help` | Strategist | Diagnostic mode: detects what's wrong and offers recovery paths | ~15K |

Each command is a markdown file in [`templates/commands/`](templates/commands/). The AI tool reads the file when you trigger the command and follows the instructions inside it.

---

## CLI Commands

These run in your terminal, outside the AI tool. Useful for automation, CI, and quick checks.

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

## Example: Full Greenfield Flow (Phases & Waves)

Here's what a complete new project looks like end-to-end, showing how phases and waves are **auto-generated** by BuildFlow — you never define them manually.

### 1. Init and start

```bash
mkdir my-app && cd my-app
npx buildflow-dev init
```

```
/buildflow-start
```
> Strategist asks 4–5 questions. Writes answers to `.buildflow/core/vision.md`.

---

### 2. Research (optional)

```
/buildflow-think auth-strategy
```
> 3 Researcher agents run in parallel. Synthesizer combines results.  
> Output → `.buildflow/research/auth-strategy.md`

---

### 3. Plan — Architect auto-generates phases and waves

```
/buildflow-plan
```

The Architect reads `vision.md` and produces `.buildflow/phases/01/PLAN.md`:

```
Phase 1 — Foundation

Wave 1 (parallel — no dependencies):
  • Create database schema
  • Create project config files
  • Set up folder structure

Wave 2 (depends on Wave 1):
  • Create data models
  • Create auth middleware

Wave 3 (depends on Wave 2):
  • Create API routes
  • Create service layer

Wave 4 (depends on Wave 3):
  • Create UI components
  • Write integration tests
```

You didn't write any of this — the Architect derived it from your vision.

---

### 4. Build — testing is automatic inside every wave

```
/buildflow-build
```

Testing is **built into every wave** — you don't run `/buildflow-test` manually. For each wave, the cycle is:

```
Build wave tasks (parallel Builders)
        ↓
Review output (Reviewer)
        ↓
Run tests automatically
        ↓
  ┌─ Tests pass? ──────────────────────── Move to next wave
  └─ Tests fail? → Fix → Re-test → loop until green (max 5 attempts)
```

So `Wave 1` is fully green before `Wave 2` starts. `Wave 2` is fully green before `Wave 3` starts. And so on.

If a wave can't be fixed within 5 attempts, the build stops and reports exactly what failed — then you can use `/buildflow-debug` for deeper investigation.

```
/buildflow-debug "auth middleware not rejecting expired tokens"
```

**`/buildflow-test` standalone** is available if you want to re-verify a wave you already built, or test after a manual code change outside of `/buildflow-build`.

---

### 5. Check, ship, and deploy

```
/buildflow-check
```
> 3 Reviewers in parallel: correctness / quality / security

```
/buildflow-ship
```
> Security gate → retrospective written to `phases/01/retro.md` → git tag

```
/buildflow-deploy staging
```
> Pre-flight checks → deploy to staging → smoke test

```
/buildflow-deploy production
```
> Stricter gate (all tests + audit must pass) → deploy to production

---

**Key point:** `[phase]` and `[wave]` arguments are optional escape hatches for resuming or re-running specific parts. In a normal flow you just type `/buildflow-plan` and `/buildflow-build` with no arguments.

---

## How It Works

### The install flow

```
npx buildflow-dev init
        │
        ├─ detectProjectInfo()     Read package.json / requirements.txt / Cargo.toml
        │                          → framework, language, hasTests, hasGit
        │
        ├─ scaffoldBuildflow()     Create .buildflow/ folder tree
        │                          Write pre-filled markdown files for each subfolder
        │
        ├─ patchGitignore()        Add .buildflow/security/reports/ to .gitignore
        │
        ├─ ensureGit()             Run git init if no .git/ exists
        │
        └─ runInstall()            Detect AI tools → write command files per tool
```

### The fix flow

```
buildflow fix
        │
        ├─ walkFiles()             Recursively scan code files (skips node_modules etc.)
        │
        ├─ scanFile()              Test each line against SECRET_PATTERNS + VULN_PATTERNS
        │
        ├─ checkConfigIssues()     Check .env not in .gitignore, missing lockfile, etc.
        │
        ├─ Auto-fixable group      Show all, ask once "apply all?" — then apply silently
        │   ├─ .env → .gitignore
        │   ├─ Math.random() → crypto.randomUUID()
        │   └─ npm install (missing lockfile)
        │
        └─ Prompt-required group   Step through one at a time
            └─ Skip / Log to DEBT.md / Open in editor / Stop
```

---

## Package Source Structure

Every file in this package and why it exists:

```
buildflow-dev/
│
├── bin/
│   └── buildflow.js          Entry point. Parses CLI args with commander,
│                             lazy-loads command modules so startup is fast.
│                             Top-level await requires "type": "module" in package.json.
│
├── src/
│   ├── index.js              Library entry point. Re-exports all command run()
│                             functions so the package can also be used programmatically:
│                             import { init, audit } from 'buildflow-dev'
│
│   ├── commands/
│   │   ├── init.js           buildflow init
│   │   │                     → detectProjectInfo(): reads package.json, pyproject.toml,
│   │   │                       Cargo.toml, go.mod to detect language + framework
│   │   │                     → scaffoldBuildflow(): creates .buildflow/ folder tree
│   │   │                       with pre-filled markdown files
│   │   │                     → patchGitignore(): adds security reports to .gitignore
│   │   │                     → ensureGit(): runs git init if needed
│   │   │                     → calls install.js to wire up AI tools
│   │   │
│   │   ├── install.js        buildflow install
│   │   │                     Contains TOOLS object: one entry per supported AI tool.
│   │   │                     Each tool has: detect(), installGlobal(), installLocal()
│   │   │                     detect() checks for CLI binary (via which) or config dirs.
│   │   │                     install*() reads templates/commands/*.md and writes them
│   │   │                     to the tool-specific location.
│   │   │
│   │   ├── audit.js          buildflow audit
│   │   │                     Pattern-based scanner (no AI, runs in terminal).
│   │   │                     SECRET_PATTERNS: catches API keys, DB URLs, private keys.
│   │   │                     VULN_PATTERNS: catches SQL injection, eval(), Math.random()
│   │   │                       for tokens, sensitive data in logs.
│   │   │                     walkFiles(): recursive file iterator that skips
│   │   │                       node_modules, dist, .git, etc.
│   │   │                     Saves timestamped report to .buildflow/security/reports/
│   │   │                     Exits with code 1 if critical issues found (CI-friendly).
│   │   │
│   │   ├── fix.js            buildflow fix
│   │   │                     Runs the same scan as audit.js, then splits findings into:
│   │   │                     - autoFixable: has an autoFix.apply() function defined.
│   │   │                       Shows all upfront, applies with one confirmation prompt.
│   │   │                     - needsPrompt: no safe auto-fix. Steps through one at a
│   │   │                       time: Skip / Log to DEBT.md / Open in editor / Stop.
│   │   │                     logSecurityDebt(): appends to .buildflow/security/DEBT.md
│   │   │                     openInEditor(): tries $EDITOR env var, falls back to code
│   │   │
│   │   ├── status.js         buildflow status
│   │   │                     Reads .buildflow/core/state.md and memory/light.md
│   │   │                     Parses key: value lines with a regex helper.
│   │   │                     --verbose flag walks .buildflow/ and prints the tree.
│   │   │
│   │   └── update.js         buildflow update
│   │                         Re-runs install.js to refresh command files.
│   │                         --check flag reads package.json version and prints it.
│   │
│   └── utils/
│       └── welcome.js        Shown when buildflow is run with no arguments.
│                             Two modes:
│                             - Initialized: reads state.md, shows project info + commands
│                             - Not initialized: shows quick-start instructions
│
├── templates/
│   ├── CLAUDE.md             Written to the user's project root as CLAUDE.md when
│   │                         installing locally for Claude Code. Tells Claude to load
│   │                         .buildflow/memory/light.md at session start and lists
│   │                         all available /buildflow-* commands.
│   │                         {{APP_NAME}} is replaced with the detected project name.
│   │
│   └── commands/             17 markdown files — one per slash command.
│       │                     Each file is the full instruction set for that command.
│       │                     The AI reads and executes these when you trigger the command.
│       │                     Format: YAML frontmatter (name, description, agent, tools)
│       │                     followed by numbered steps the agent follows.
│       │
│       ├── start.md          Vision gathering, mode detection (greenfield vs existing)
│       ├── think.md          Parallel research with up to 3 Researcher agents
│       ├── plan.md           Dependency mapping → wave-based execution plan
│       ├── build.md          Wave-by-wave parallel Builder execution
│       ├── test.md           Run tests + UI verification after each wave
│       ├── check.md          3-reviewer parallel quality check
│       ├── ship.md           Pre-ship security gate → retro → git tag
│       ├── onboard.md        One-time codebase analysis → MAP/PATTERNS/DEPENDENCIES/HOTSPOTS
│       ├── modify.md         Surgical code change with blast-radius analysis
│       ├── refactor.md       Quality improvement without behavior change
│       ├── audit.md          OWASP Top 10 AI-powered scan
│       ├── debug.md          Root-cause analysis for failing tests or broken behavior
│       ├── deploy.md         Pre-flight checks → deploy to staging or production
│       ├── status.md         Current phase and recommended next action
│       ├── explain.md        Plain-language explanation of code, concepts, errors
│       ├── back.md           Undo to git restore point, update state
│       └── help.md           Diagnostic mode + full command reference
│
├── .gitignore
├── LICENSE                   MIT
├── README.md                 This file
└── package.json              "type": "module" required for ESM imports.
                              "bin" wires buildflow and bf to bin/buildflow.js.
                              "files" limits npm publish to bin/, src/, templates/ only.
```

---

## The .buildflow/ Scaffold

When a user runs `buildflow init`, this folder is created in their project:

```
their-project/
└── .buildflow/
    │
    ├── core/
    │   ├── vision.md         What the project is, who it's for, success criteria.
    │   │                     Filled during /buildflow-start. Read by every agent
    │   │                     at session start to maintain alignment.
    │   │
    │   └── state.md          Current phase number, status, detected framework.
    │                         Updated by /buildflow-ship, /buildflow-plan, /buildflow-back.
    │                         Also read by buildflow status (CLI).
    │
    ├── you/
    │   └── preferences.md    User's experience level, learning preferences, safety
    │                         settings, parallelization limits. The AI adapts its
    │                         explanation depth based on the experience: field.
    │
    ├── memory/
    │   └── light.md          The core of the memory system. Persists project essentials
    │                         across AI sessions: app name, framework, phase, last session
    │                         date, onboarding status, style fingerprint, recent decisions.
    │                         Kept under 5K tokens deliberately — costs less to load than
    │                         it saves in re-detection work.
    │
    ├── learnings/
    │   ├── glossary.md       Project-specific jargon and BuildFlow concepts. Grows as
    │   │                     /buildflow-explain is used. Agents reference it to stay
    │   │                     consistent with terminology across sessions.
    │   │
    │   └── decisions.md      Log of architectural decisions: what was decided, why,
    │                         and the confidence level at the time. Prevents relitigating
    │                         the same choices in future sessions.
    │
    ├── research/             Output from /buildflow-think sessions. One file per topic
    │                         with sources, trust scores, and the synthesized recommendation.
    │
    ├── codebase/             Generated by /buildflow-onboard (existing projects only).
    │   ├── MAP.md            Architecture overview, folder structure, entry points
    │   ├── PATTERNS.md       Code conventions: naming, imports, error handling, testing
    │   ├── DEPENDENCIES.md   Top dependencies with purpose and security status
    │   └── HOTSPOTS.md       High-complexity files to handle carefully
    │
    ├── phases/               One subfolder per phase (01/, 02/, etc.)
    │   └── 01/
    │       ├── PLAN.md       Task breakdown with dependency waves
    │       └── retro.md      Written during /buildflow-ship: what worked, what didn't
    │
    └── security/
        ├── DEBT.md           Deferred security issues with severity and date.
        │                     Populated by /buildflow-fix (log to debt option) and
        │                     /buildflow-ship when high-severity issues are found.
        ├── rules/            Custom security rules (future)
        ├── suppressions/     False-positive suppressions (future)
        └── reports/          Timestamped audit reports from buildflow audit CLI.
                              Gitignored by default — may contain sensitive findings.
```

---

## Template System

Templates in [`templates/commands/`](templates/commands/) follow this format:

```markdown
---
name: buildflow-start
description: One-line description shown in the AI tool's command menu
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-start

Steps the AI follows when this command is triggered...
```

The `agent:` field names the specialized agent persona the AI should adopt. The `allowed-tools:` field tells Claude Code which tools the command is permitted to use.

**How templates become commands per tool:**

| Tool | Where templates go | File naming |
|------|--------------------|-------------|
| Claude Code | `.claude/commands/` or `~/.claude/commands/` | `buildflow-start.md` |
| Gemini CLI | `.gemini/commands/` + appended to `GEMINI.md` | `start.md` |
| Codex CLI | `.codex/instructions/` + `.codex/skills/` | `buildflow-start.md` |
| Cursor | `.cursor/rules/buildflow.mdc` | Single combined file |
| Cline | `.clinerules` (project root) | Single combined file |
| Continue | `.continue/buildflow/` + `config.json` patch | `start.md` |

---

## 9 Specialized Agents

Each agent gets a fresh context window — this is how BuildFlow avoids context rot.

| Agent | Persona | Commands |
|-------|---------|----------|
| 🎯 **Strategist** | Vision, decisions, orientation | `start`, `status`, `explain`, `back`, `help` |
| 🔍 **Researcher** | Web research with source trust scores | `think` (parallel × 3) |
| 🔄 **Synthesizer** | Combines parallel research output | `think` |
| 🏗️ **Architect** | Dependency mapping, wave planning | `plan` |
| ⚒️ **Builder** | Style-matched code generation | `build` (parallel per wave) |
| 🔬 **Reviewer** | Correctness, quality, security checks | `check` (parallel × 3), `build` |
| 🗺️ **Cartographer** | One-time codebase analysis | `onboard` |
| 🩺 **Surgeon** | Minimal-footprint code modification | `modify`, `refactor` |
| 🔒 **Security Auditor** | OWASP Top 10 scanning | `audit`, `ship` (pre-ship gate) |

Parallelization example from `/buildflow-think`:
```
Sequential: 3 research topics × 60s = 180s total
Parallel:   3 researchers simultaneously = 60s total  (67% faster)
```

---

## Examples

### Starting a new project

```bash
mkdir my-saas && cd my-saas
npx buildflow-dev init
# → Detects: greenfield (no src/, no package.json)
# → Detects: Claude Code ✓, Cursor ✓
# → Installs 14 commands into both tools
```

In Claude Code:
```
/buildflow-start
# → Asks: What are you building? Who is it for? ...

/buildflow-think tech-stack
# → 3 parallel researchers compare options, Synthesizer recommends

/buildflow-plan phase-1
# → Architect maps dependencies, creates phases/01/PLAN.md

/buildflow-build
# → Parallel Builders execute wave-by-wave, matched to your style

/buildflow-check
# → 3 reviewers check correctness + quality + security in parallel

/buildflow-ship
# → Security gate runs → retrospective → git tag
```

### Adding to an existing project

```bash
cd my-next-app
npx buildflow-dev init
# → Detects: Next.js, TypeScript, Jest tests, git initialized
# → Detects: Claude Code ✓
# → Installs commands locally
```

In Claude Code:
```
/buildflow-onboard
# → Cartographer reads codebase, writes MAP.md + PATTERNS.md

/buildflow-modify "Add rate limiting to /api/auth/login"
# → Surgeon: blast-radius analysis → restore point → surgical change

/buildflow-audit --quick
# → Security Auditor scans changed files since last commit
```

### Terminal security check (CI-friendly)

```bash
buildflow audit
# → Exits with code 1 if critical issues found
# → Saves report to .buildflow/security/reports/

buildflow fix
# → Interactive: auto-fixes safe issues, prompts for everything else
```

---

## Token Economics

| Scenario | Tokens | Notes |
|----------|--------|-------|
| Greenfield full workflow | 130–160K | All phases, one session |
| Onboarding existing project | +35K | One-time, never again |
| Existing project after onboard | 130–160K | Same as greenfield |
| Security gate (per ship) | +10K | Always runs with `/buildflow-ship` |
| Light memory load (per session) | ~2K | **Saves** ~10K in re-detection |

Light memory pays for itself after one session — loading 2K to avoid re-detecting framework, phase, and preferences each time.

---

## Contributing

### Dev setup

```bash
git clone https://github.com/Vikas-gurrapu/buildflow.git
cd buildflow
npm install
node bin/buildflow.js --help    # verify it works
```

### Project conventions

- **ES Modules only** — `"type": "module"` in `package.json`. Use `import/export`, never `require()`.
- **Node 18+ compatibility** — avoid `import.meta.dirname` (Node 21+). Use `dirname(fileURLToPath(import.meta.url))` instead.
- **No TypeScript** — keeps the package zero-build, directly runnable. Types via JSDoc if needed.
- **No bundler** — source files run directly. What you write is what ships.
- **Lazy command imports** — `bin/buildflow.js` uses `() => import(...)` so startup time stays fast even as commands grow.

### Adding a new AI tool

1. Add an entry to the `TOOLS` object in [`src/commands/install.js`](src/commands/install.js)
2. Implement `detect()`, `installGlobal()`, `installLocal()`, and `triggerNote`
3. Add the tool to the supported tools table in this README

### Adding a new slash command

1. Create `templates/commands/<name>.md` with frontmatter + steps
2. Add the name to the `commandNames` array in `loadCommandTemplates()` in `install.js`
3. Document it in the AI Slash Commands table in this README

### Adding a new auto-fix to `buildflow fix`

Add an `autoFix` property to a pattern in `VULN_PATTERNS` or `checkConfigIssues()` in [`src/commands/fix.js`](src/commands/fix.js):

```js
{
  pattern: /somePattern/g,
  label: 'Description of the issue',
  severity: 'HIGH',
  owasp: 'A03',
  autoFix: {
    description: 'What the fix does (shown to user before applying)',
    apply: (content) => content.replace(/somePattern/g, 'saferAlternative'),
    note: 'Optional: shown after fix is applied (e.g. "review this change")',
  },
}
```

`apply` receives the file content as a string and must return the fixed content. For fixes that don't modify a single file (like writing to `.gitignore` or running `npm install`), call side effects directly and omit the `content` parameter.

---

## Publishing

```bash
# Bump version in package.json, then:
npm login
npm publish

# Or dry-run to see what gets published:
npm publish --dry-run
```

Only these paths are included in the npm package (`files` in `package.json`):
- `bin/` — CLI entry point
- `src/` — command and utility modules
- `templates/` — slash command markdown files and CLAUDE.md template
- `README.md`
- `LICENSE`

Everything else (`.claude/`, `node_modules/`, `.gitignore`, etc.) is excluded.

---

## Roadmap

### New AI Tools
- [ ] `buildflow install --tool windsurf` — Windsurf IDE support
- [ ] `buildflow install --tool aider` — Aider CLI support
- [ ] `buildflow install --tool zed` — Zed editor support

### New Slash Commands
- [ ] `/buildflow-perf` — performance profiling: detect slow queries, bundle size issues, render bottlenecks
- [ ] `/buildflow-docs` — auto-generate or update README, API docs, and inline comments from code
- [ ] `/buildflow-migrate` — guided database migration: generate migration files, verify rollback safety
- [ ] `/buildflow-seed` — generate realistic test data for the current schema

### CLI Improvements
- [ ] `buildflow audit` in GitHub Actions — CI-friendly exit codes already work, needs workflow template
- [ ] `buildflow fix --auto` — non-interactive mode for CI
- [ ] `buildflow test` — terminal wrapper that runs the project's test suite with BuildFlow context

### Platform
- [ ] Web dashboard for project status visualization
- [ ] Custom agent creation: `buildflow agent create`
- [ ] Team sync: shared `.buildflow/` across teammates

---

## License

MIT © 2026 [Vikas Gurrapu](https://github.com/Vikas-gurrapu)
