import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { run as runInstall } from './install.js'

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

  writeFileSync(join(base, 'core', 'vision.md'),
    projectInfo.projectType === 'existing'
      ? `# Project Vision: ${appName}\n\n## Type\nExisting ${projectInfo.framework} project\n\n## Goals\n[Fill during /buildflow-start]\n\n---\nInitialized: ${today}\n`
      : `# Project Vision: ${appName}\n\n## What I'm Building\n[Fill during /buildflow-start]\n\n---\nInitialized: ${today}\n`
  )

  writeFileSync(join(base, 'core', 'state.md'),
    `# State\n\nProject: ${appName}\nType: ${projectInfo.projectType}\nFramework: ${projectInfo.framework}\nPhase: 0\nStatus: Initialized\nBuildFlow: 3.0\nDate: ${today}\n`
  )

  writeFileSync(join(base, 'you', 'preferences.md'),
    `# Preferences\n\nexperience: junior\nproject_type: ${projectInfo.projectType}\nframework: ${projectInfo.framework}\n\nlearning:\n  show_explanations: true\n  confidence_calibration: true\n  source_citations: true\n\nsafety:\n  enable_undo: true\n  restore_points: true\n\nmemory:\n  type: light\n  retention_days: 30\n\nparallel:\n  enabled: true\n  max_researchers: 3\n\nsecurity:\n  pre_ship_gate: true\n  auto_suggest_on_sensitive: true\n`
  )

  writeFileSync(join(base, 'memory', 'light.md'),
    `# Light Memory\n\napp: ${appName}\ntype: ${projectInfo.projectType}\nframework: ${projectInfo.framework}\nphase: 0\nlast_session: ${today}\nbuildflow: 3.0\nonboarded: ${projectInfo.projectType === 'greenfield' ? 'n/a' : 'false'}\n\n## Style Fingerprint\n[Auto-populated after first build]\n\n## Recent Decisions\n[Auto-populated]\n`
  )

  writeFileSync(join(base, 'learnings', 'glossary.md'),
    `# Glossary\n\n## context-rot\nAI quality degrades as conversation grows. Avoided by fresh agents.\n\n## confidence-calibration\nAsking 1-5 before locking decisions. Triggers explanations when low.\n\n## cartographer\nAgent that maps existing codebases for other agents to use.\n\n## surgeon\nAgent that makes precise modifications to existing code.\n\n## security-auditor\nAgent that runs OWASP Top 10 checks before shipping.\n`
  )

  writeFileSync(join(base, 'learnings', 'decisions.md'),
    `# Decision Log\n\n## ${today} — Initial Setup\nDecision: Use BuildFlow v3.0\nType: ${projectInfo.projectType} (${projectInfo.framework})\nConfidence: 5/5\n`
  )

  writeFileSync(join(base, 'security', 'DEBT.md'),
    `# Security Debt\n\nTrack deferred security issues.\n\n## Active\n[None]\n`
  )

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
