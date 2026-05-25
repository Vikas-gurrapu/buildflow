import chalk from 'chalk'
import enquirer from 'enquirer'
import { existsSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const { prompt } = enquirer

const COMMAND_NAMES = [
  'start', 'think', 'spec', 'plan', 'build', 'test', 'check', 'ship',
  'onboard', 'modify', 'refactor', 'hotfix', 'audit',
  'debug', 'deploy', 'docker', 'workspace',
  'status', 'explain', 'back', 'help',
]

const TOOL_IDS = ['claude', 'gemini', 'codex', 'cursor', 'cline', 'continue']

function readFileSafe(filePath) {
  try { return readFileSync(filePath, 'utf8') } catch { return '' }
}

function removePath(filePath, removed) {
  if (!existsSync(filePath)) return
  rmSync(filePath, { recursive: true, force: true })
  removed.push(filePath)
}

function removeBuildFlowBlock(filePath, heading, removed) {
  const existing = readFileSafe(filePath)
  if (!existing.includes(heading)) return

  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const updated = existing
    .replace(new RegExp(`\\n*${escaped}[\\s\\S]*?(?=\\n## |\\n# |$)`, 'g'), '')
    .trimStart()

  if (updated.trim() === '') {
    removePath(filePath, removed)
  } else {
    writeFileSync(filePath, updated.endsWith('\n') ? updated : `${updated}\n`)
    removed.push(`${filePath} (BuildFlow block)`)
  }
}

function removeGeminiUpdateBlocks(filePath, removed) {
  const existing = readFileSafe(filePath)
  if (!existing.includes('## BuildFlow Update Check')) return

  const updated = existing
    .replace(/\n*## BuildFlow Update Check \(Run Every Session\)[\s\S]*?(?=\n## |\n# |$)/g, '')
    .trimStart()

  if (updated.trim() === '') {
    removePath(filePath, removed)
  } else {
    writeFileSync(filePath, updated.endsWith('\n') ? updated : `${updated}\n`)
    removed.push(`${filePath} (BuildFlow update block)`)
  }
}

function uninstallClaude(scope, removed) {
  const base = scope === 'global' ? homedir() : process.cwd()
  const dir = join(base, '.claude', 'commands')
  for (const name of COMMAND_NAMES) {
    removePath(join(dir, `buildflow-${name}.md`), removed)
  }
}

function uninstallGemini(scope, removed) {
  const base = scope === 'global' ? homedir() : process.cwd()
  const dir = join(base, '.gemini', 'commands')
  for (const name of COMMAND_NAMES) {
    removePath(join(dir, `buildflow-${name}.toml`), removed)
    removePath(join(dir, `${name}.md`), removed)
  }
  const contextPath = scope === 'global' ? join(base, '.gemini', 'GEMINI.md') : join(base, 'GEMINI.md')
  removeBuildFlowBlock(contextPath, '## BuildFlow Commands', removed)
  removeGeminiUpdateBlocks(contextPath, removed)
}

function uninstallCodex(scope, removed) {
  const base = scope === 'global' ? homedir() : process.cwd()
  const instructionsDir = join(base, '.codex', 'instructions')
  const skillsDir = join(base, '.codex', 'skills')
  for (const name of COMMAND_NAMES) {
    removePath(join(instructionsDir, `buildflow-${name}.md`), removed)
    removePath(join(skillsDir, `buildflow-${name}`), removed)
  }
  const agentsPath = scope === 'global' ? join(base, '.codex', 'AGENTS.md') : join(base, 'AGENTS.md')
  removeBuildFlowBlock(agentsPath, '## BuildFlow Instructions', removed)
}

function uninstallCursor(scope, removed) {
  if (scope === 'global') return
  removePath(join(process.cwd(), '.cursor', 'rules', 'buildflow.mdc'), removed)
}

function uninstallCline(scope, removed) {
  if (scope === 'global') return
  const rulesPath = join(process.cwd(), '.clinerules')
  if (readFileSafe(rulesPath).includes('BuildFlow')) {
    removePath(rulesPath, removed)
  }
}

function uninstallContinue(scope, removed) {
  const base = scope === 'global' ? homedir() : process.cwd()
  removePath(join(base, '.continue', 'buildflow'), removed)

  if (scope !== 'global') return
  const configPath = join(base, '.continue', 'config.json')
  if (!existsSync(configPath)) return

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    if (!Array.isArray(config.slashCommands)) return
    const before = config.slashCommands.length
    config.slashCommands = config.slashCommands.filter(c => !String(c.name || '').startsWith('buildflow-'))
    if (config.slashCommands.length !== before) {
      writeFileSync(configPath, JSON.stringify(config, null, 2))
      removed.push(`${configPath} (BuildFlow slash commands)`)
    }
  } catch {}
}

function uninstallProjectData(removed) {
  removePath(join(process.cwd(), '.buildflow'), removed)
}

function pruneEmptyDirs(root) {
  if (!existsSync(root)) return
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(root, entry.name))
  }
  try {
    if (readdirSync(root).length === 0) rmSync(root, { recursive: true, force: true })
  } catch {}
}

function selectedTools(toolOption) {
  if (!toolOption || toolOption === 'all') return TOOL_IDS
  return toolOption.split(',').map(t => t.trim()).filter(Boolean)
}

function selectedScopes(opts) {
  if (opts.global && opts.local) return ['global', 'local']
  if (opts.global) return ['global']
  if (opts.local) return ['local']
  return ['local']
}

export async function run(opts = {}) {
  const tools = selectedTools(opts.tool)
  const scopes = selectedScopes(opts)

  console.log('\n' + chalk.bold.white('  BuildFlow — Uninstall'))
  console.log(chalk.dim(`  Tools: ${tools.join(', ')}`))
  console.log(chalk.dim(`  Scope: ${scopes.join(' + ')}`))
  if (opts.projectData) {
    console.log(chalk.yellow('  Project data: .buildflow will be removed'))
  }
  console.log('')

  const unknown = tools.filter(t => !TOOL_IDS.includes(t))
  if (unknown.length > 0) {
    console.log(chalk.red(`  Unknown tool(s): ${unknown.join(', ')}`))
    console.log(chalk.dim(`  Valid tools: ${TOOL_IDS.join(', ')}, all\n`))
    return
  }

  if (!opts.yes) {
    const { confirmed } = await prompt({
      type: 'confirm',
      name: 'confirmed',
      message: 'Remove BuildFlow files for the selected tools?',
      initial: false,
    })
    if (!confirmed) {
      console.log(chalk.yellow('\n  Uninstall cancelled.\n'))
      return
    }
  }

  const removed = []
  const uninstallers = {
    claude: uninstallClaude,
    gemini: uninstallGemini,
    codex: uninstallCodex,
    cursor: uninstallCursor,
    cline: uninstallCline,
    continue: uninstallContinue,
  }

  for (const scope of scopes) {
    for (const tool of tools) {
      uninstallers[tool](scope, removed)
    }
  }

  if (opts.projectData) {
    uninstallProjectData(removed)
  }

  pruneEmptyDirs(join(process.cwd(), '.claude'))
  pruneEmptyDirs(join(process.cwd(), '.gemini'))
  pruneEmptyDirs(join(process.cwd(), '.codex'))
  pruneEmptyDirs(join(process.cwd(), '.cursor'))
  pruneEmptyDirs(join(process.cwd(), '.continue'))

  if (removed.length === 0) {
    console.log(chalk.yellow('  No BuildFlow files found for the selected options.\n'))
    return
  }

  console.log(chalk.green(`  ✓ Removed ${removed.length} BuildFlow item(s):`))
  for (const item of removed) {
    console.log(chalk.dim(`    ${item}`))
  }
  console.log('')
}
