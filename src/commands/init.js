import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { run as runInstall, registerProject, printBuildFlowBanner } from './install.js'

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

  // Java / Kotlin
  if (existsSync(join(cwd, 'pom.xml'))) {
    info.language = 'java'
    info.projectType = 'existing'
    try {
      const pom = readFileSync(join(cwd, 'pom.xml'), 'utf8')
      if (pom.includes('spring-boot')) info.framework = 'Spring Boot'
      else if (pom.includes('quarkus')) info.framework = 'Quarkus'
      else if (pom.includes('micronaut')) info.framework = 'Micronaut'
      else info.framework = 'Maven'
    } catch { info.framework = 'Maven' }
    info.hasTests = existsSync(join(cwd, 'src', 'test'))
  }
  if (existsSync(join(cwd, 'build.gradle')) || existsSync(join(cwd, 'build.gradle.kts'))) {
    const isKts = existsSync(join(cwd, 'build.gradle.kts'))
    info.language = isKts ? 'kotlin' : 'java'
    info.projectType = 'existing'
    try {
      const gradle = readFileSync(join(cwd, isKts ? 'build.gradle.kts' : 'build.gradle'), 'utf8')
      if (gradle.includes('org.springframework.boot')) info.framework = 'Spring Boot'
      else if (gradle.includes('io.quarkus')) info.framework = 'Quarkus'
      else if (gradle.includes('io.micronaut')) info.framework = 'Micronaut'
      else if (gradle.includes('com.android')) info.framework = 'Android'
      else info.framework = isKts ? 'Kotlin' : 'Gradle'
    } catch { info.framework = isKts ? 'Kotlin' : 'Gradle' }
    info.hasTests = existsSync(join(cwd, 'src', 'test'))
  }

  // C# / .NET
  const csprojFiles = (() => { try { return readdirSync(cwd).filter(f => f.endsWith('.csproj') || f.endsWith('.sln')) } catch { return [] } })()
  if (csprojFiles.length > 0) {
    info.language = 'csharp'
    info.projectType = 'existing'
    try {
      const csproj = readFileSync(join(cwd, csprojFiles[0]), 'utf8')
      if (csproj.includes('Microsoft.AspNetCore')) info.framework = 'ASP.NET Core'
      else if (csproj.includes('Microsoft.Maui')) info.framework = 'MAUI'
      else if (csproj.includes('Blazor')) info.framework = 'Blazor'
      else info.framework = '.NET'
    } catch { info.framework = '.NET' }
    info.hasTests = (() => { try { return readdirSync(cwd).some(f => f.toLowerCase().includes('test') && f.endsWith('.csproj')) } catch { return false } })()
  }

  // Ruby
  if (existsSync(join(cwd, 'Gemfile'))) {
    info.language = 'ruby'
    info.projectType = 'existing'
    try {
      const gemfile = readFileSync(join(cwd, 'Gemfile'), 'utf8')
      if (gemfile.includes("'rails'") || gemfile.includes('"rails"')) info.framework = 'Rails'
      else if (gemfile.includes('sinatra')) info.framework = 'Sinatra'
      else info.framework = 'Ruby'
    } catch { info.framework = 'Ruby' }
    info.hasTests = existsSync(join(cwd, 'spec')) || existsSync(join(cwd, 'test'))
  }

  // PHP
  if (existsSync(join(cwd, 'composer.json'))) {
    info.language = 'php'
    info.projectType = 'existing'
    try {
      const composer = JSON.parse(readFileSync(join(cwd, 'composer.json'), 'utf8'))
      const req = { ...composer.require, ...composer['require-dev'] }
      if (req?.['laravel/framework']) info.framework = 'Laravel'
      else if (req?.['symfony/framework-bundle']) info.framework = 'Symfony'
      else info.framework = 'PHP'
    } catch { info.framework = 'PHP' }
    info.hasTests = existsSync(join(cwd, 'tests'))
  }

  // Dart / Flutter
  if (existsSync(join(cwd, 'pubspec.yaml'))) {
    info.language = 'dart'
    info.projectType = 'existing'
    try {
      const pubspec = readFileSync(join(cwd, 'pubspec.yaml'), 'utf8')
      info.framework = pubspec.includes('flutter') ? 'Flutter' : 'Dart'
    } catch { info.framework = 'Dart' }
    info.hasTests = existsSync(join(cwd, 'test'))
  }

  // Swift
  if (existsSync(join(cwd, 'Package.swift'))) {
    info.language = 'swift'
    info.framework = 'Swift Package'
    info.projectType = 'existing'
    info.hasTests = existsSync(join(cwd, 'Tests'))
  }
  if (existsSync(join(cwd, 'project.pbxproj')) || existsSync(join(cwd, `${cwd.split('/').pop()}.xcodeproj`))) {
    info.language = 'swift'
    info.framework = 'Xcode / iOS'
    info.projectType = 'existing'
    info.hasTests = existsSync(join(cwd, `${cwd.split('/').pop()}Tests`))
  }

  // Scala
  if (existsSync(join(cwd, 'build.sbt'))) {
    info.language = 'scala'
    info.projectType = 'existing'
    try {
      const sbt = readFileSync(join(cwd, 'build.sbt'), 'utf8')
      if (sbt.includes('akka')) info.framework = 'Akka'
      else if (sbt.includes('play')) info.framework = 'Play'
      else info.framework = 'Scala / sbt'
    } catch { info.framework = 'Scala / sbt' }
    info.hasTests = existsSync(join(cwd, 'src', 'test'))
  }

  // Elixir
  if (existsSync(join(cwd, 'mix.exs'))) {
    info.language = 'elixir'
    info.projectType = 'existing'
    try {
      const mix = readFileSync(join(cwd, 'mix.exs'), 'utf8')
      if (mix.includes(':phoenix')) info.framework = 'Phoenix'
      else if (mix.includes(':nerves')) info.framework = 'Nerves'
      else info.framework = 'Elixir / Mix'
    } catch { info.framework = 'Elixir / Mix' }
    info.hasTests = existsSync(join(cwd, 'test'))
  }

  // C / C++
  if (existsSync(join(cwd, 'CMakeLists.txt'))) {
    info.language = 'cpp'
    info.framework = 'CMake'
    info.projectType = 'existing'
    info.hasTests = existsSync(join(cwd, 'tests')) || existsSync(join(cwd, 'test'))
  } else if (existsSync(join(cwd, 'Makefile')) && !existsSync(join(cwd, 'package.json'))) {
    try {
      const makefile = readFileSync(join(cwd, 'Makefile'), 'utf8')
      if (makefile.includes('.cpp') || makefile.includes('.cc') || makefile.includes('g++') || makefile.includes('clang++')) {
        info.language = 'cpp'
        info.framework = 'Make / C++'
        info.projectType = 'existing'
        info.hasTests = existsSync(join(cwd, 'tests')) || existsSync(join(cwd, 'test'))
      } else if (makefile.includes('.c ') || makefile.includes('gcc') || makefile.includes('clang ')) {
        info.language = 'c'
        info.framework = 'Make / C'
        info.projectType = 'existing'
        info.hasTests = existsSync(join(cwd, 'tests')) || existsSync(join(cwd, 'test'))
      }
    } catch {}
  }

  // Haskell
  if (existsSync(join(cwd, 'stack.yaml'))) {
    info.language = 'haskell'
    info.framework = 'Stack'
    info.projectType = 'existing'
    info.hasTests = existsSync(join(cwd, 'test'))
  } else if (existsSync(join(cwd, 'cabal.project')) || (() => { try { return readdirSync(cwd).some(f => f.endsWith('.cabal')) } catch { return false } })()) {
    info.language = 'haskell'
    info.framework = 'Cabal'
    info.projectType = 'existing'
    info.hasTests = existsSync(join(cwd, 'test'))
  }

  if (!existsSync(join(cwd, 'src')) && !existsSync(pkgPath) && !existsSync(join(cwd, 'requirements.txt'))) {
    info.projectType = 'greenfield'
  }

  return info
}

function scaffoldBuildflow(appName, projectInfo) {
  const base = join(process.cwd(), '.buildflow')

  const dirs = ['phases', 'codebase']
  for (const d of dirs) mkdirSync(join(base, d), { recursive: true })

  const today = new Date().toISOString().split('T')[0]
  const isExisting = projectInfo.projectType === 'existing'

  // ── VISION.md ────────────────────────────────────────────────────────────────
  writeFileSync(join(base, 'VISION.md'), isExisting
    ? `# Vision — ${appName}

> **Purpose:** Source of truth for what you're building.
> Every agent reads it at session start to stay aligned with your goals.
> Fill it in during your first \`/buildflow-start-epic\` session.

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

*Initialized: ${today} · BuildFlow v7.0*
`
    : `# Vision — ${appName}

> **Purpose:** Source of truth for what you're building.
> Every agent reads it at session start to stay aligned with your goals.
> Fill it in during your first \`/buildflow-start-epic\` session.

---

## What I'm Building

> One paragraph: what is this product, tool, or service?

*(fill in during /buildflow-start-epic)*

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

*Initialized: ${today} · BuildFlow v7.0*
`)

  // ── STATE.md ─────────────────────────────────────────────────────────────────
  writeFileSync(join(base, 'STATE.md'),
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
| **BuildFlow** | 7.0                    |
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

---

## Token Tracking

\`\`\`yaml
session_tokens_used: 0
session_start: ${today}
\`\`\`

> Updated by each command at completion. Reset to 0 at session start.
> Use \`/buildflow-status\` to see current session total.
`)

  // ── PREFERENCES.md ───────────────────────────────────────────────────────────
  writeFileSync(join(base, 'PREFERENCES.md'),
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
  enable_undo:     true   # /buildflow-back restores to restore points
  restore_points:  true   # Auto-snapshot before destructive operations
\`\`\`

---

## Git Permissions

\`\`\`yaml
git:
  permission:   ${projectInfo.gitPermission || 'approved'}   # approved | denied | denied_permanent | unavailable
  # approved          — BuildFlow uses git for commits, tags, restore points
  # denied            — using file snapshots; can re-enable with /buildflow-help git-enable
  # denied_permanent  — always use file snapshots, never ask again
  # unavailable       — git not installed on this system
\`\`\`

To change: edit \`permission\` above and restart your AI session.
To enable git after denying: set \`permission: approved\` and ensure git is installed.

---

## Folder Access Permissions

\`\`\`yaml
path_permissions:
  # Auto-populated as you approve or deny folder access during commands.
  # BuildFlow checks this before reading or writing any folder outside .buildflow/.
  #
  # approved — access allowed, never ask again for this folder
  # denied   — access blocked, skip silently
  #
  # Example after setup:
  #   src/: approved
  #   tests/: approved
  #   config/: approved
  #   secrets/: denied
\`\`\`

To manually allow a folder: add \`  [folder]/: approved\` under \`path_permissions\`.
To block a folder permanently: add \`  [folder]/: denied\`.

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

---

## Spec Coverage

\`\`\`yaml
spec_coverage:
  threshold:   70    # % of business-logic files that must have AC traceability
                     # When below this, /buildflow-check and /buildflow-ship prompt you
                     # They never hard-block — you always decide whether to proceed
  strict_mode: false # true = prompt on ANY coverage drop (even 1%)
                     # false = only prompt when below threshold
\`\`\`

---

## Strict Mode

\`\`\`yaml
strict_mode: false
# false (default) — standard spec-driven development:
#   • Files traced to ACs at file/symbol level
#   • Ship gates enforce AC compliance and test coverage
#
# true — structural spec-to-code mirroring (spec-kit style):
#   • Every exported symbol in critical modules must have an AC reference
#   • API response/request field names must match DESIGN.md contracts exactly
#   • Every error/edge-case AC must have a corresponding code branch
#   • Component map in DESIGN.md must match file structure
#   • Violations BLOCK ship — no override flag
#   • Use for: auth, payments, crypto, compliance, infrastructure
#   • Can also be set per-phase: /buildflow-plan --strict

strict_critical_modules:
  - auth
  - payment
  - crypto
  - migration
  - permission
  - role
  - token
  - secret
  - key
  - sign
  - verify
# Add paths that contain business-critical logic for your domain.
# Any file whose path contains one of these strings is a critical module.
# Example for a healthcare app: add 'dosage', 'prescription', 'patient'
\`\`\`

---

## Workflow

\`\`\`yaml
workflow:
  require_think:   false     # Require /buildflow-think before /buildflow-spec
  require_check:   true      # Require /buildflow-check before /buildflow-ship (recommended)
  research_depth:  standard  # quick | standard | thorough — default depth for /buildflow-think
  skip_prompts:    false     # true = autonomous mode — skip confirmation prompts (yolo)
  auto_wave_retry: true      # Auto-retry a failed wave once before surfacing error
\`\`\`

# research_depth controls how many Researcher agents spawn and how many sources each finds:
#   quick    = 1 researcher, 1–2 sources per topic (fastest, cheapest)
#   standard = 2–3 researchers in parallel, 2–3 sources each (default)
#   thorough = 3 researchers, 3–5 sources each, with a Synthesizer (most complete)

---

## Token Tracking

\`\`\`yaml
token_tracking:
  enabled:          true    # Track token usage per command and session
  report_at_end:    true    # Print token cost at end of each command
  session_running_total: true  # Accumulate session total in STATE.md

verbose_context: false
# false (default) — context management is invisible:
#   • MEMORY.md pruning happens silently, no report shown
#   • Token cost shows as one line: "Session: ~NK tokens"
#   • Drift detection only surfaces actionable warnings
# true — show full detail:
#   • "Context pruned: MEMORY.md X → Y tokens" reported
#   • Full token breakdown per command (context/output/this/total)
\`\`\`

---

`)

  // ── MEMORY.md ────────────────────────────────────────────────────────────────
  writeFileSync(join(base, 'MEMORY.md'),
    `# Memory

> **Purpose:** Persists essential project context across AI sessions.
> Loaded at the start of every BuildFlow session to avoid re-detecting things.
> **Keep this file under 5,000 tokens.** Distill insights — don't log events.
> The AI updates this automatically. You can edit it too.

---

## Session Data

\`\`\`yaml
app:               ${appName}
type:              ${projectInfo.projectType}
framework:         ${projectInfo.framework}
phase:             0
last_session:      ${today}
buildflow:         7.0
onboarded:         ${projectInfo.projectType === 'greenfield' ? 'n/a  # greenfield project — no onboarding needed' : 'false  # run /buildflow-onboard to analyze your codebase'}
git_permission:    ${projectInfo.gitPermission || 'approved'}
git_available:     ${projectInfo.gitPermission === 'approved' ? 'true' : 'false'}
parked_changes:    []   # files with un-pushed changes — checked before each new phase
container_runtime: none  # set by /buildflow-docker when Docker is intentionally initialized
language:          ${projectInfo.language}
\`\`\`

---

## Style Fingerprint

> Auto-populated by \`/buildflow-build\` after the first coding session.
> Captures naming conventions, import style, error handling patterns.

*(not yet populated)*

---

## Key Decisions

> Major architectural or technology decisions. Summarized here so agents
> don't relitigate them. Full details are in each phase's DECISIONS.md.

*(not yet populated)*

---

## Current Focus

> What you're working on right now. Updated by \`/buildflow-plan\` and \`/buildflow-ship\`.

Phase 0 — Initial setup complete. Run \`/buildflow-start-epic\` to begin.
`)

  // ── GLOSSARY.md ──────────────────────────────────────────────────────────────
  writeFileSync(join(base, 'GLOSSARY.md'),
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
| **memory** | The \`.buildflow/MEMORY.md\` file — essential project context kept under 5K tokens, loaded at every session start. |
| **wave** | A group of tasks that can run in parallel because they have no dependencies on each other. |
| **restore point** | A file snapshot, or a git checkpoint only when \`git.permission: approved\`, created before a destructive operation so \`/buildflow-back\` can undo it. |
| **blast radius** | The set of files affected by a code change — mapped before modifying anything in Surgeon mode. |
| **phase folder** | \`.buildflow/phases/N/\` — single source of truth for one phase: research, decisions, spec, plan, build, check, ship artifacts all live here. |

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

  return base
}

function patchGitignore() {
  const gitignorePath = join(process.cwd(), '.gitignore')
  const marker = '.buildflow/phases/*/SNAPSHOTS/'
  const entry = '\n# BuildFlow phase snapshots (restore points — not needed in version control)\n.buildflow/phases/*/SNAPSHOTS/\n'

  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, 'utf8')
    if (!existing.includes(marker)) {
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
  printBuildFlowBanner('Project Setup')

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
          hint: 'Enables /buildflow-start-epic, full new project workflow',
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

  // ── Git permission ──────────────────────────────────────────────────────────
  let gitPermission = 'approved' // default when --yes flag used
  const gitAvailable = (() => {
    try { execSync('git --version', { stdio: 'ignore' }); return true } catch { return false }
  })()

  if (!opts.yes) {
    if (!gitAvailable) {
      console.log(chalk.dim('  ℹ Git not found on this system.'))
      console.log(chalk.dim('    BuildFlow will use file snapshots for restore points and phase tracking.'))
      console.log(chalk.dim('    Install git later and re-run `npx buildflow-dev init` to enable git features.\n'))
      gitPermission = 'unavailable'
    } else if (projectInfo.hasGit) {
      console.log(chalk.green('  ✓ Git repository detected'))
      const { gitAccess } = await prompt({
        type: 'select',
        name: 'gitAccess',
        message: 'Allow BuildFlow to use git? (commits, tags, restore points)',
        choices: [
          {
            name: 'approved',
            message: 'Yes — use git for commits, wave tracking, and restore points',
            hint: 'Recommended',
          },
          {
            name: 'denied',
            message: 'No, not now — use file snapshots instead',
            hint: 'Can enable later with /buildflow-help git-enable',
          },
          {
            name: 'denied_permanent',
            message: 'No, never ask again — always use file snapshots',
            hint: 'Stored permanently in preferences',
          },
        ],
        initial: 0,
      })
      gitPermission = gitAccess
    } else {
      // No git repo exists — ask if they want one initialized
      const { initGit } = await prompt({
        type: 'select',
        name: 'initGit',
        message: 'No git repository found. Allow BuildFlow to initialize one?',
        choices: [
          {
            name: 'approved',
            message: 'Yes — initialize git and use it for tracking',
            hint: 'Recommended',
          },
          {
            name: 'denied',
            message: 'No, not now — use file snapshots instead',
            hint: 'Can enable later with /buildflow-help git-enable',
          },
          {
            name: 'denied_permanent',
            message: 'No, never ask again — always use file snapshots',
          },
        ],
        initial: 0,
      })
      gitPermission = initGit
    }
  }

  if (gitPermission === 'approved') {
    if (!projectInfo.hasGit) {
      try { execSync('git init -q', { cwd: process.cwd() }); console.log(chalk.green('  ✓ Git repository initialized')) } catch {}
    }
    console.log(chalk.dim('  Git: enabled — commits, tags, and restore points active'))
  } else if (gitPermission === 'denied') {
    console.log(chalk.yellow('  Git: declined for now — using file snapshots'))
    console.log(chalk.dim('  To enable later: run /buildflow-help git-enable in your AI tool'))
  } else if (gitPermission === 'denied_permanent') {
    console.log(chalk.yellow('  Git: permanently declined — using file snapshots'))
  } else if (gitPermission === 'unavailable') {
    // already messaged above
  }
  console.log('')

  const sp2 = ora('Setting up .buildflow/ folder...').start()
  scaffoldBuildflow(appName, { ...projectInfo, projectType, gitPermission })
  patchGitignore()
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
    console.log(chalk.cyan('    /buildflow-start-epic') + chalk.dim('    ← begin your project'))
    console.log(chalk.cyan('    /buildflow-think') + chalk.dim('    ← research and discuss'))
  }

  if (wantSecurity) {
    console.log(chalk.dim('\n  Security: Pre-ship gate enabled (/buildflow-ship auto-runs audit)'))
    console.log(chalk.dim('  Manual audit: /buildflow-audit'))
  }

  console.log('')
}
