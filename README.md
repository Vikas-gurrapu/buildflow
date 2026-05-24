# BuildFlow

> Adaptive AI-powered development orchestration

[![npm version](https://badge.fury.io/js/buildflow-dev.svg)](https://www.npmjs.com/package/buildflow-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Install

```bash
# Interactive setup (recommended)
npx buildflow-dev init
```

```bash
# Or install globally
npm install -g buildflow-dev
buildflow init
```

---

## What It Does

`buildflow init` will:

1. **Detect your project** — existing codebase or greenfield, your framework, language, test setup
2. **Set up `.buildflow/`** — agents, memory, security rules, codebase knowledge
3. **Detect installed AI tools** — Claude Code, Gemini CLI, Codex CLI, Cursor, Cline, Continue
4. **Install `/buildflow-*` slash commands** into each detected tool
5. **You type `/` in your AI tool** to see and use the commands

---

## Supported AI Tools

| Tool | Detection | Global Install | Local Install | Slash Commands |
|------|-----------|----------------|---------------|----------------|
| **Claude Code** | ✓ Auto-detect | `~/.claude/commands/` | `.claude/commands/` | `/buildflow-*` |
| **Gemini CLI** | ✓ Auto-detect | `~/.gemini/commands/` | `.gemini/commands/` | `/buildflow-*` |
| **Codex CLI** | ✓ Auto-detect | `~/.codex/instructions/` | `.codex/instructions/` | `/buildflow-*` |
| **Cursor** | ✓ Auto-detect | (local only) | `.cursor/rules/` | `@buildflow-*` |
| **Cline** | ✓ Auto-detect | (local only) | `.clinerules` | `/buildflow-*` |
| **Continue** | ✓ Auto-detect | `~/.continue/` | `.continue/` | `/buildflow-*` |

---

## Commands (type `/` in your AI tool)

### Workflow

| Command | Purpose | Tokens |
|---------|---------|--------|
| `/buildflow-start` | Begin project (smart mode detection) | ~8K |
| `/buildflow-think` | Discuss & research (parallel agents) | ~30K |
| `/buildflow-plan` | Create execution plan | ~20K |
| `/buildflow-build` | Execute plan (parallel waves) | ~50K/task |
| `/buildflow-check` | Verify quality | ~20K |
| `/buildflow-ship` | Finalize + **security gate** | ~22K |

### Existing Codebase

| Command | Purpose | Tokens |
|---------|---------|--------|
| `/buildflow-onboard` | Map codebase (run once) | ~35K |
| `/buildflow-modify` | Change existing code safely | ~30K |
| `/buildflow-refactor` | Improve existing code | ~40K |

### Security

| Command | Purpose | Tokens |
|---------|---------|--------|
| `/buildflow-audit` | Full OWASP Top 10 scan | ~35K |
| `/buildflow-audit --quick` | Recent changes only | ~15K |

### Utility

| Command | Purpose | Tokens |
|---------|---------|--------|
| `/buildflow-status` | Where am I? | ~3K |
| `/buildflow-explain <term>` | Define jargon or describe file | ~2K |
| `/buildflow-back` | Undo to safe restore point | ~3K |
| `/buildflow-help` | Diagnostic recovery | ~15K |

---

## CLI Commands (terminal, outside AI tool)

```bash
buildflow init          # Set up BuildFlow + install slash commands
buildflow install       # (Re)install into AI tools
buildflow install --tool claude  # Install into specific tool
buildflow install --tool all     # Install into all detected tools
buildflow audit         # Terminal-level security scan (pattern-based)
buildflow audit --quick # Scan recent changes only
buildflow status        # Show project state
buildflow update        # Update commands to latest version
```

---

## How It Works

### 9 Specialized Agents

Each agent gets a **fresh 200K context window** — no context rot.

| Agent | Role | Used In |
|-------|------|---------|
| 🎯 Strategist | Vision & decisions | `/buildflow-start`, `/buildflow-think` |
| 🔍 Researcher | Parallel web research with source confidence | `/buildflow-think` |
| 🔄 Synthesizer | Combines parallel research findings | `/buildflow-think` |
| 🏗️ Architect | Dependency-aware planning | `/buildflow-plan` |
| ⚒️ Builder | Code matching your style (parallel) | `/buildflow-build` |
| 🔬 Reviewer | Quality checks (parallel) | `/buildflow-check` |
| 🗺️ Cartographer | Maps existing codebases | `/buildflow-onboard` |
| 🩺 Surgeon | Precise code modification | `/buildflow-modify` |
| 🔒 Security Auditor | OWASP Top 10 scanning | `/buildflow-audit`, `/buildflow-ship` |

### Parallelization

Research and building run agents in parallel:

```
Sequential: 3 research topics × 60s = 180s
Parallel:   3 researchers simultaneously = 60s (67% faster)
```

### Light Memory

`.buildflow/memory/light.md` persists essentials across sessions (under 5K tokens). Saves more than it costs.

### Security Gate

Every `/buildflow-ship` runs a pre-ship security check:
- 🔴 Critical → **BLOCKED** (must fix)
- 🟡 High → WARNING (can ship, log to DEBT.md)
- ✅ Clean → Ship freely

---

## Project Structure

```
your-project/
├── .buildflow/
│   ├── core/
│   │   ├── vision.md          ← What you're building
│   │   └── state.md           ← Current position
│   ├── you/
│   │   ├── preferences.md     ← Your settings
│   │   └── style-guide.md     ← Auto-detected code style
│   ├── memory/
│   │   └── light.md           ← Persistent context (≤5K)
│   ├── codebase/              ← Existing project maps
│   │   ├── MAP.md
│   │   ├── PATTERNS.md
│   │   ├── DEPENDENCIES.md
│   │   └── HOTSPOTS.md
│   ├── security/
│   │   ├── DEBT.md
│   │   └── reports/
│   ├── phases/                ← Per-phase work
│   └── learnings/             ← Glossary, decisions
│
├── commands/buildflow/        ← Slash command definitions
│   ├── start.md
│   ├── think.md
│   └── ... (14 commands)
│
└── agents/                    ← Agent personalities
    ├── strategist.md
    └── ... (9 agents)
```

For AI tools with dedicated directories:

```
~/.claude/commands/buildflow-*.md   ← Global Claude Code
.claude/commands/buildflow-*.md     ← Local Claude Code
~/.gemini/commands/buildflow-*.md   ← Global Gemini CLI
.cursor/rules/buildflow.mdc         ← Cursor
.clinerules                          ← Cline
```

---

## Examples

### New project

```bash
mkdir my-app && cd my-app
npx buildflow-dev init

# → Detects: No existing code (greenfield)
# → Detects: Claude Code ✓, Cursor ✓
# → Installs commands into both
# → Opens Claude Code...

/buildflow-start
/buildflow-think tech-stack
/buildflow-plan phase-1
/buildflow-build phase-1
/buildflow-check
/buildflow-ship    ← security gate runs automatically
```

### Existing project

```bash
cd my-existing-app
npx buildflow-dev init

# → Detects: Next.js project
# → Detects: Claude Code ✓
# → Installs commands
# → Opens Claude Code...

/buildflow-onboard          ← one-time codebase analysis
/buildflow-modify "Add dark mode to settings page"
/buildflow-refactor src/components/Dashboard.tsx
/buildflow-audit --quick    ← security check on recent changes
```

---

## Token Economics

| Mode | Per Session | Notes |
|------|-------------|-------|
| Greenfield | 130-160K | Full workflow |
| Existing (first time) | +35K | One-time onboarding |
| Existing (after onboard) | 130-160K | Same as greenfield |
| Security gate (pre-ship) | +10K | Always runs with ship |

Light memory SAVES ~10K per session vs no memory (avoids re-detection).

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/new-agent`
3. Make changes
4. Run tests: `npm test`
5. Submit a PR

---

## License

MIT © 2026

---

## Roadmap

- [ ] `buildflow install --tool windsurf` (Windsurf IDE)
- [ ] `buildflow install --tool aider` (Aider CLI)
- [ ] Web dashboard for project status
- [ ] Team collaboration features
- [ ] GitHub Actions integration
- [ ] Custom agent creation wizard
