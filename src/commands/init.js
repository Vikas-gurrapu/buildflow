import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { run as runInstall, registerProject } from './install.js'

const { prompt } = enquirer

function detectProjectInfo() {
  const cwd = process.cwd()
  const info = {
    appName: 'my-project',
    projectType: 'greenfield',
    framework: 'none',
    hasGit: existsSync(join(cwd, '.git')),
    hasTests: false,
    hasSrc: existsSync(join(cwd, 'src')),
    language: 'unknown',
  }

  const pkgPath = join(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      info.appName = pkg.name || cwd.split('/').pop()
      info.language = 'javascript'
      info.projectType = 'existing'

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps?.next)         info.framework = 'Next.js'
      else if (deps?.react)   info.framework = 'React'
      else if (deps?.vue)     info.framework = 'Vue'
      else if (deps?.svelte)  info.framework = 'Svelte'
      else if (deps?.express) info.framework = 'Express'
      else if (deps?.fastify) info.framework = 'Fastify'
      else if (deps?.nestjs)  info.framework = 'NestJS'
      else                    info.framework = 'Node.js'

      info.hasTests = !!(deps?.jest || deps?.vitest || deps?.mocha || deps?.['@playwright/test'])
    } catch {}
  }

  if (existsSync(join(cwd, 'requirements.txt')) || existsSync(join(cwd, 'pyproject.toml'))) {
    info.language = 'python'
    info.projectType = 'existing'
    try {
      const req = readFileSync(join(cwd, 'requirements.txt'), 'utf8').toLowerCase()
      if (req.includes('django'))       info.framework = 'Django'
      else if (req.includes('fastapi')) info.framework = 'FastAPI'
      else if (req.includes('flask'))   info.framework = 'Flask'
      else                              info.framework = 'Python'
    } catch {}
    info.hasTests = existsSync(join(cwd, 'tests')) || existsSync(join(cwd, 'test'))
  }

  if (existsSync(join(cwd, 'Cargo.toml'))) {
    info.language = 'rust'
    info.framework = 'Rust'
    info.projectType = 'existing'
  }

  if (existsSync(join(cwd, 'go.mod'))) {
    info.language = 'go'
    info.framework = 'Go'
    info.projectType = 'existing'
  }

  if (!existsSync(join(cwd, 'src')) && !existsSync(pkgPath) && !existsSync(join(cwd, 'requirements.txt'))) {
    info.projectType = 'greenfield'
  }

  return info
}

function scaffoldBuildflow(appName, projectInfo) {
  const base = join(process.cwd(), '.buildflow')

  const dirs = [
    'core', 'you', 'memory', 'phases',
    'learnings', 'research', 'codebase',
    'security/reports', 'security/rules',
    'security/suppressions',
  ]
  for (const d of dirs) mkdirSync(join(base, d), { recursive: true })

  const today = new Date().toISOString().split('T')[0]
  const isExisting = projectInfo.projectType === 'existing'

  // ── core/vision.md ──────────────────────────────────────────────────────────
  writeFileSync(join(base, 'core', 'vision.md'), isExisting
    ? `# Vision — ${appName}

> **Purpose:** This file is the source of truth for what you're building.
> Every agent reads it at session start to stay aligned with your goals.
> Fill it in during your first \`/buildflow-start\` session.

---

## Project Type

**Existing ${projectInfo.framework} project** — language: ${projectInfo.language}

---

## Goals for This Project

> What do you want to achieve by using BuildFlow on this codebase?
> Examples: "Add auth system", "Migrate to TypeScript", "Improve performance"

- [ ] Goal 1 — *(fill in)*
- [ ] Goal 2 — *(fill in)*

---

## What NOT to Change

> Any areas of the codebase that are off-limits or need special care?

*(fill in or delete this section)*

---

## Success Criteria

> How will you know the work is done and done well?

- [ ] *(fill in)*

---

*Initialized: ${today} · BuildFlow v3.0*
`
    : `# Vision — ${appName}

> **Purpose:** This file is the source of truth for what you're building.
> Every agent reads it at session start to stay aligned with your goals.
> Fill it in during your first \`/buildflow-start\` session.

---

## What I'm Building

> One paragraph: what is this product, tool, or service?

*(fill in during /buildflow-start)*

---

## Who It's For

> Describe the target user. Be specific — "developers using Node.js" beats "developers".

*(fill in)*

---

## Problem It Solves

> What exists today that's painful, broken, or missing?

*(fill in)*

---

## Success Criteria

> How will you know it's working? Measurable outcomes are better than vague goals.

- [ ] *(fill in)*

---

## Simplest Useful Version (MVP)

> What's the smallest thing you can ship that delivers real value?

*(fill in)*

---

## Constraints

| Constraint    | Value         |
|---------------|---------------|
| Target date   | —             |
| Team size     | —             |
| Stack         | ${projectInfo.language !== 'unknown' ? projectInfo.language : '—'} |

---

*Initialized: ${today} · BuildFlow v3.0*
`)

  // ── core/state.md ───────────────────────────────────────────────────────────
  writeFileSync(join(base, 'core', 'state.md'),
    `# Project State

> **Purpose:** Tracks where you are in the BuildFlow workflow.
> Updated automatically by \`/buildflow-plan\`, \`/buildflow-ship\`, and \`/buildflow-back\`.
> Also read by \`buildflow status\` in the terminal.

---

## Current State

| Field         | Value                  |
|---------------|------------------------|
| **Project**   | ${appName}             |
| **Type**      | ${projectInfo.projectType} |
| **Framework** | ${projectInfo.framework} |
| **Phase**     | 0                      |
| **Status**    | Initialized            |
| **BuildFlow** | 3.0                    |
| **Updated**   | ${today}               |

---

## Phase History

| Phase | Description | Status     | Date |
|-------|-------------|------------|------|
| 0     | Setup       | ✅ Complete | ${today} |

---

## Status Reference

| Status        | Meaning                                      |
|---------------|----------------------------------------------|
| Initialized   | BuildFlow set up, ready to start             |
| In Progress   | Actively building a phase                    |
| Shipped       | Phase complete and committed to git          |
| Blocked       | Waiting on a decision or external dependency |
`)

  // ── you/preferences.md ──────────────────────────────────────────────────────
  writeFileSync(join(base, 'you', 'preferences.md'),
    `# Your Preferences

> **Purpose:** BuildFlow reads this at session start to adapt its behavior to you.
> Edit any value — changes take effect in the next AI session.

---

## Experience Level

\`\`\`yaml
experience: junior   # junior | mid | senior
\`\`\`

| Value    | What it changes                                                  |
|----------|------------------------------------------------------------------|
| \`junior\` | More explanations, analogies, LEARN: comments in generated code  |
| \`mid\`    | Balanced — assumes framework knowledge, skips basics             |
| \`senior\` | Concise — assumes full-stack knowledge, no hand-holding          |

---

## Project Context

\`\`\`yaml
project_type: ${projectInfo.projectType}   # greenfield | existing
framework:    ${projectInfo.framework}
\`\`\`

---

## Learning Aids

\`\`\`yaml
learning:
  show_explanations:      true   # Explain WHY, not just WHAT
  confidence_calibration: true   # Ask confidence (1-5) before big decisions
  source_citations:       true   # Cite research sources with trust scores (1-5)
\`\`\`

---

## Safety

\`\`\`yaml
safety:
  enable_undo:     true   # /buildflow-back restores to git checkpoints
  restore_points:  true   # Auto-commit before destructive operations
\`\`\`

---

## Memory

\`\`\`yaml
memory:
  type:            light   # light (≤5K tokens) | full (more context, more cost)
  retention_days:  30      # Discard session data older than this
\`\`\`

---

## Parallelization

\`\`\`yaml
parallel:
  enabled:         true   # Run multiple agents simultaneously
  max_researchers: 3      # Max parallel Researcher agents in /buildflow-think
\`\`\`

---

## Security

\`\`\`yaml
security:
  pre_ship_gate:           true   # Run security audit before every /buildflow-ship
  auto_suggest_on_sensitive: true # Flag sensitive files (auth, payments) automatically
\`\`\`
`)

  // ── memory/light.md ─────────────────────────────────────────────────────────
  writeFileSync(join(base, 'memory', 'light.md'),
    `# Light Memory

> **Purpose:** Persists essential project context across AI sessions.
> Loaded at the start of every BuildFlow session to avoid re-detecting things.
> **Keep this file under 5,000 tokens.** Distill insights — don't log events.
> The AI updates this automatically. You can edit it too.

---

## Session Data

\`\`\`yaml
app:          ${appName}
type:         ${projectInfo.projectType}
framework:    ${projectInfo.framework}
phase:        0
last_session: ${today}
buildflow:    3.0
onboarded:    ${projectInfo.projectType === 'greenfield' ? 'n/a  # greenfield project — no onboarding needed' : 'false  # run /buildflow-onboard to analyze your codebase'}
\`\`\`

---

## Style Fingerprint

> Auto-populated by \`/buildflow-build\` after the first coding session.
> Captures naming conventions, import style, error handling patterns.

*(not yet populated)*

---

## Key Decisions

> Major architectural or technology decisions. Summarized here so agents
> don't relitigate them. Full details are in \`learnings/decisions.md\`.

*(not yet populated)*

---

## Current Focus

> What you're working on right now. Updated by \`/buildflow-plan\` and \`/buildflow-ship\`.

Phase 0 — Initial setup complete. Run \`/buildflow-start\` to begin.
`)

  // ── learnings/glossary.md ───────────────────────────────────────────────────
  writeFileSync(join(base, 'learnings', 'glossary.md'),
    `# Glossary

> **Purpose:** Defines terms used across BuildFlow sessions.
> Agents reference this to stay consistent with terminology.
> Grows automatically when you use \`/buildflow-explain\`.
> Add your own project-specific terms below the BuildFlow section.

---

## BuildFlow Terms

| Term | Definition |
|------|------------|
| **context-rot** | AI quality degrades as conversation grows long. BuildFlow avoids this by using fresh agent sessions per task. |
| **confidence-calibration** | Asking for a 1–5 confidence score before locking major decisions. Score below 3 triggers alternatives or research. |
| **light memory** | The \`memory/light.md\` file — essential project context kept under 5K tokens, loaded at every session start. |
| **wave** | A group of tasks that can run in parallel because they have no dependencies on each other. |
| **restore point** | A git commit created before a destructive operation so \`/buildflow-back\` can undo it. |
| **blast radius** | The set of files affected by a code change — mapped before modifying anything in Surgeon mode. |

---

## Agent Roles

| Agent | Role |
|-------|------|
| **Strategist** | Vision, decisions, project orientation |
| **Researcher** | Web research with source trust scores (1–5) |
| **Synthesizer** | Combines parallel research into a recommendation |
| **Architect** | Maps task dependencies, creates wave-based plans |
| **Builder** | Writes code matched to your existing style |
| **Reviewer** | Quality, correctness, and security checks |
| **Cartographer** | One-time existing codebase analysis |
| **Surgeon** | Precise, minimal-footprint code modifications |
| **Security Auditor** | OWASP Top 10 scanning, pre-ship gate |

---

## Project Terms

> Add your project-specific jargon here so all agents use consistent language.

*(add terms as your project evolves)*
`)

  // ── learnings/decisions.md ──────────────────────────────────────────────────
  writeFileSync(join(base, 'learnings', 'decisions.md'),
    `# Decision Log

> **Purpose:** Records major architectural and technology decisions.
> Prevents relitigating the same choices in future sessions.
> Each decision includes what was decided, why, and how confident you were.
> Updated by agents during \`/buildflow-think\` and \`/buildflow-plan\`.

---

## How to Read This Log

| Field | Meaning |
|-------|---------|
| **Decision** | What was chosen |
| **Alternatives** | What else was considered |
| **Rationale** | Why this option won |
| **Confidence** | 1–5 at time of decision (5 = very sure) |
| **Revisit if** | Conditions that would make this worth reconsidering |

---

## Log

### ${today} — Initial Setup

| Field | Value |
|-------|-------|
| **Decision** | Use BuildFlow v3.0 for development orchestration |
| **Type** | ${projectInfo.projectType} · ${projectInfo.framework} |
| **Confidence** | 5/5 |
| **Revisit if** | — |

---

*New decisions are appended below by \`/buildflow-think\` and \`/buildflow-plan\`.*
`)

  // ── security/DEBT.md ────────────────────────────────────────────────────────
  writeFileSync(join(base, 'security', 'DEBT.md'),
    `# Security Debt

> **Purpose:** Tracks security issues that were found but not immediately fixed.
> Populated by \`buildflow fix\` (log to debt option) and \`/buildflow-ship\`
> when high-severity issues are found but you choose to ship anyway.
> Review this before every major release.

---

## Severity Reference

| Level | Icon | Action Required |
|-------|------|-----------------|
| Critical | 🔴 | Fix before next commit. Blocks \`/buildflow-ship\`. |
| High | 🟡 | Fix this sprint. Logged here when shipping despite warning. |
| Medium | 🟠 | Fix when in the area. Won't block shipping. |
| Low | 🔵 | Fix opportunistically. |

---

## Active Issues

> Issues that need to be addressed.

*None — clean slate.*

---

## Resolved Issues

> Move items here (with resolution date and fix description) when addressed.

*None yet.*
`)

  return base
}

function patchGitignore() {
  const gitignorePath = join(process.cwd(), '.gitignore')
  const entry = '\n# BuildFlow security reports (may contain sensitive findings)\n.buildflow/security/reports/\n'

  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, 'utf8')
    if (!existing.includes('.buildflow/security/reports')) {
      writeFileSync(gitignorePath, existing + entry)
    }
  } else {
    writeFileSync(gitignorePath, entry)
  }
}

function ensureGit() {
  if (!existsSync(join(process.cwd(), '.git'))) {
    try {
      execSync('git init -q', { cwd: process.cwd() })
      return true
    } catch {
      return false
    }
  }
  return false
}

export async function run(opts = {}) {
  console.log('\n' + chalk.bold.white('  BuildFlow v3.0 — Project Setup') + '\n')

  const spinner = ora('Analyzing project...').start()
  const projectInfo = detectProjectInfo()
  await new Promise(r => setTimeout(r, 500))
  spinner.stop()

  if (projectInfo.projectType === 'existing') {
    console.log(chalk.green(`  ✓ Detected: ${projectInfo.framework} project`))
    console.log(chalk.dim(`    Language: ${projectInfo.language}`))
    console.log(chalk.dim(`    Tests: ${projectInfo.hasTests ? 'Yes' : 'Not found'}`))
    console.log(chalk.dim(`    Git: ${projectInfo.hasGit ? 'Initialized' : 'Not found'}`))
  } else {
    console.log(chalk.cyan('  Starting fresh (greenfield project)'))
  }
  console.log('')

  let appName = projectInfo.appName

  if (!opts.yes) {
    const { confirmedName } = await prompt({
      type: 'input',
      name: 'confirmedName',
      message: 'App name:',
      initial: appName,
    })
    appName = confirmedName || appName
  }

  let projectType = projectInfo.projectType
  if (!opts.yes && !opts.greenfield && !opts.existing) {
    const { type } = await prompt({
      type: 'select',
      name: 'type',
      message: 'Project mode:',
      choices: [
        {
          name: 'existing',
          message: 'Existing codebase — Add BuildFlow to current code',
          hint: 'Enables /buildflow-onboard, /buildflow-modify, /buildflow-refactor',
        },
        {
          name: 'greenfield',
          message: 'Greenfield — Starting from scratch',
          hint: 'Enables /buildflow-start, full new project workflow',
        },
      ],
      initial: projectType === 'existing' ? 0 : 1,
    })
    projectType = type
  }

  let wantSecurity = true
  if (!opts.yes) {
    const { security } = await prompt({
      type: 'confirm',
      name: 'security',
      message: 'Enable security layer? (Recommended — OWASP Top 10 + pre-ship gate)',
      initial: true,
    })
    wantSecurity = security
  }

  const sp2 = ora('Setting up .buildflow/ folder...').start()
  scaffoldBuildflow(appName, { ...projectInfo, projectType })
  patchGitignore()
  ensureGit()
  registerProject(process.cwd())
  await new Promise(r => setTimeout(r, 300))
  sp2.succeed(chalk.green('  ✓ .buildflow/ scaffold created'))

  console.log('')
  await runInstall({ ...opts })

  console.log(chalk.bold.green('\n  ✓ BuildFlow initialized!\n'))

  if (projectType === 'existing') {
    console.log(chalk.white('  Start here:'))
    console.log(chalk.cyan('    /buildflow-onboard') + chalk.dim('  ← analyze your codebase (one-time)'))
    console.log(chalk.cyan('    /buildflow-modify') + chalk.dim('   ← change existing code safely'))
  } else {
    console.log(chalk.white('  Start here:'))
    console.log(chalk.cyan('    /buildflow-start') + chalk.dim('    ← begin your project'))
    console.log(chalk.cyan('    /buildflow-think') + chalk.dim('    ← research and discuss'))
  }

  if (wantSecurity) {
    console.log(chalk.dim('\n  Security: Pre-ship gate enabled (/buildflow-ship auto-runs audit)'))
    console.log(chalk.dim('  Manual audit: /buildflow-audit'))
  }

  console.log('')
}
