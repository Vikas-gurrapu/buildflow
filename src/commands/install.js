import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import which from 'which'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { prompt } = enquirer

const TOOLS = {

  claude: {
    id: 'claude',
    name: 'Claude Code',
    description: "Anthropic's agentic coding assistant",
    icon: '🟣',
    docsUrl: 'https://docs.anthropic.com/claude-code',

    detect() {
      const hasCli = (() => { try { which.sync('claude'); return true } catch { return false } })()
      const hasClaudeDir = existsSync(join(homedir(), '.claude'))
      return hasCli || hasClaudeDir
    },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.claude', 'commands')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), content)
      }
      return dir
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.claude', 'commands')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), content)
      }
      writeFileSync(join(process.cwd(), 'CLAUDE.md'), claudeMdContent())
      return dir
    },

    triggerNote: 'Type "/" in Claude Code to see /buildflow-* commands',
  },

  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    description: "Google's Gemini command-line AI assistant",
    icon: '🔵',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',

    detect() {
      try { which.sync('gemini'); return true } catch { return false }
    },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.gemini', 'commands')
      mkdirSync(dir, { recursive: true })
      const contextPath = join(homedir(), '.gemini', 'GEMINI.md')
      const existingContent = existsSync(contextPath) ? readFileSync(contextPath, 'utf8') : ''
      if (!existingContent.includes('## BuildFlow Commands')) {
        writeFileSync(contextPath, existingContent + '\n\n' + geminiContextBlock(commandFiles))
      }
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `${name}.md`), content)
      }
      return dir
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.gemini', 'commands')
      mkdirSync(dir, { recursive: true })
      const contextPath = join(process.cwd(), 'GEMINI.md')
      const existingContent = existsSync(contextPath) ? readFileSync(contextPath, 'utf8') : ''
      if (!existingContent.includes('## BuildFlow Commands')) {
        writeFileSync(contextPath, existingContent + '\n\n' + geminiContextBlock(commandFiles))
      }
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `${name}.md`), content)
      }
      return dir
    },

    triggerNote: 'In Gemini CLI, type "/" or @buildflow to use commands',
  },

  codex: {
    id: 'codex',
    name: 'Codex CLI',
    description: "OpenAI's Codex command-line coding agent",
    icon: '🟢',
    docsUrl: 'https://github.com/openai/codex',

    detect() {
      try { which.sync('codex'); return true } catch { return false }
    },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.codex', 'instructions')
      const skillsDir = join(homedir(), '.codex', 'skills')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), content)
        writeCodexSkill(skillsDir, name, content)
      }
      patchAgentsMd(join(homedir(), '.codex', 'AGENTS.md'), 'global')
      return `${dir} + ${skillsDir}`
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.codex', 'instructions')
      const skillsDir = join(process.cwd(), '.codex', 'skills')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), content)
        writeCodexSkill(skillsDir, name, content)
      }
      patchAgentsMd(join(process.cwd(), 'AGENTS.md'), 'local')
      return `${dir} + ${skillsDir}`
    },

    triggerNote: 'In Codex CLI, use $buildflow-start or say "use buildflow-start". Slash menu commands are not exposed by Codex.',
  },

  cursor: {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI-powered code editor with built-in LLM',
    icon: '⚫',
    docsUrl: 'https://cursor.sh',

    detect() {
      const hasCursorApp = existsSync('/Applications/Cursor.app')
        || existsSync('C:\\Users\\Public\\Desktop\\Cursor.lnk')
        || (() => { try { which.sync('cursor'); return true } catch { return false } })()
      const hasCursorDir = existsSync(join(homedir(), '.cursor'))
      return hasCursorApp || hasCursorDir
    },

    installGlobal(commandFiles) {
      return this.installLocal(commandFiles)
    },

    installLocal(commandFiles) {
      const rulesDir = join(process.cwd(), '.cursor', 'rules')
      mkdirSync(rulesDir, { recursive: true })
      writeFileSync(join(rulesDir, 'buildflow.mdc'), cursorRulesContent(commandFiles))
      return rulesDir
    },

    triggerNote: 'In Cursor Chat, type @BuildFlow or reference rules using # in composer',
  },

  cline: {
    id: 'cline',
    name: 'Cline (VS Code extension)',
    description: 'Autonomous coding agent for VS Code',
    icon: '🔷',
    docsUrl: 'https://github.com/cline/cline',

    detect() {
      const extDirs = [
        join(homedir(), '.vscode', 'extensions'),
        join(homedir(), '.vscode-server', 'extensions'),
      ]
      return extDirs.some(d =>
        existsSync(d) &&
        readdirSafe(d).some(f => f.startsWith('saoudrizwan.claude-dev'))
      )
    },

    installGlobal(commandFiles) {
      return this.installLocal(commandFiles)
    },

    installLocal(commandFiles) {
      writeFileSync(join(process.cwd(), '.clinerules'), clineRulesContent(commandFiles))
      return process.cwd()
    },

    triggerNote: 'Cline reads .clinerules automatically. Type "use /buildflow-start" in Cline chat.',
  },

  continue: {
    id: 'continue',
    name: 'Continue (VS Code / JetBrains)',
    description: 'Open-source AI code assistant extension',
    icon: '🟡',
    docsUrl: 'https://continue.dev',

    detect() {
      return existsSync(join(homedir(), '.continue', 'config.json'))
    },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.continue', 'buildflow')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `${name}.md`), content)
      }
      patchContinueConfig(commandFiles)
      return dir
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.continue', 'buildflow')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `${name}.md`), content)
      }
      return dir
    },

    triggerNote: 'In Continue, use @BuildFlow in chat or trigger custom slash commands.',
  },

}

function geminiContextBlock(commandFiles) {
  const commandList = Object.keys(commandFiles)
    .map(name => `- \`/buildflow-${name}\`: see .gemini/commands/${name}.md`)
    .join('\n')
  return `## BuildFlow Commands\n\nWhen the user types a /buildflow-* command, load and execute the corresponding file from .gemini/commands/.\n\n${commandList}`
}

function patchAgentsMd(filePath, scope) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  if (existing.includes('BuildFlow')) return
  const dir = scope === 'global' ? '~/.codex/instructions/' : '.codex/instructions/'
  const block = `\n\n## BuildFlow Instructions\n\nWhen the user types $buildflow-<command> or /buildflow-<command>, load the matching file from ${dir} and follow those instructions.\n\nAvailable commands: start, think, plan, build, check, ship, onboard, modify, refactor, audit, status, explain, back, help\n`
  writeFileSync(filePath, existing + block)
}

function writeCodexSkill(skillsDir, name, commandContent) {
  const skillName = `buildflow-${name}`
  const skillDir = join(skillsDir, skillName)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), codexSkillContent(skillName, commandContent))
}

function codexSkillContent(skillName, commandContent) {
  const description = extractFrontmatterValue(commandContent, 'description') || `Run ${skillName}`
  return `---\nname: "${skillName}"\ndescription: "${escapeYamlString(description)}"\nmetadata:\n  short-description: "${escapeYamlString(description)}"\n---\n\n<objective>\nExecute the BuildFlow workflow below end-to-end.\nTreat any user text after $${skillName} as arguments for this workflow.\n</objective>\n\n<workflow>\n${commandContent}\n</workflow>\n`
}

function extractFrontmatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match?.[1]?.trim().replace(/^["']|["']$/g, '')
}

function escapeYamlString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function cursorRulesContent(commandFiles) {
  const commandDescriptions = Object.keys(commandFiles)
    .map(name => `- @buildflow-${name}`)
    .join('\n')
  return `---
description: BuildFlow development orchestration commands
globs: ["**/*"]
alwaysApply: false
---

# BuildFlow v3.0

You are integrated with BuildFlow, an adaptive development orchestration system.

## Available Commands

When the user types @buildflow-<command> or references a buildflow command, execute the corresponding workflow:

${commandDescriptions}

## Core Rules

1. Load .buildflow/memory/light.md at session start
2. Ask confidence (1-5) on major decisions
3. Show alternatives before locking choices
4. Add LEARN: comments for new concepts
5. Create restore points before destructive changes
6. Run security checks before shipping
7. Cite sources with trust scores

## Agents

Use these specialized agents based on context:
- Strategist: vision and discussion
- Researcher: parallel web research with sources
- Synthesizer: combine parallel research
- Architect: dependency-aware planning
- Builder: code matching user's style
- Reviewer: quality checks
- Cartographer: map existing codebases (onboarding)
- Surgeon: precise modifications to existing code
- Security Auditor: OWASP Top 10 security scanning
`
}

function clineRulesContent(commandFiles) {
  const commandList = Object.keys(commandFiles)
    .map(name => `- /buildflow-${name}`)
    .join('\n')
  return `# BuildFlow v3.0 Rules for Cline

## Slash Commands

When the user types any of the following commands, load the corresponding instruction file from .buildflow/commands/:

${commandList}

## Core Behavior

- Always load .buildflow/memory/light.md first
- Ask confidence (1-5) on major architectural decisions
- Show alternatives before making choices
- Generate LEARN: comments for unfamiliar concepts
- Run /buildflow-audit before shipping
- Cite all research sources with trust scores (1-5)
- Create git restore points before destructive operations

## Memory

Light memory is stored in .buildflow/memory/light.md.
Keep it under 5K tokens. Distill insights, don't log events.
`
}

function patchContinueConfig(commandFiles) {
  const configPath = join(homedir(), '.continue', 'config.json')
  if (!existsSync(configPath)) return

  let config
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return
  }

  if (!config.slashCommands) config.slashCommands = []

  const existing = config.slashCommands.map(c => c.name)
  const toAdd = Object.keys(commandFiles)
    .filter(name => !existing.includes(`buildflow-${name}`))
    .map(name => ({
      name: `buildflow-${name}`,
      description: `BuildFlow: ${name}`,
      prompt: `Execute the BuildFlow ${name} workflow from .continue/buildflow/${name}.md`,
    }))

  config.slashCommands.push(...toAdd)
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function claudeMdContent() {
  const templatePath = join(__dirname, '../../templates/CLAUDE.md')
  return readFileSync(templatePath, 'utf8').replace('{{APP_NAME}}', detectAppName())
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function detectAppName() {
  const pkgPath = join(process.cwd(), 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      return pkg.name || 'my-project'
    } catch {
      return 'my-project'
    }
  }
  return process.cwd().split(/[/\\]/).pop() || 'my-project'
}

function loadCommandTemplates() {
  const templatesDir = join(__dirname, '../../templates/commands')
  const commands = {}
  const commandNames = [
    'start', 'think', 'plan', 'build', 'check', 'ship',
    'onboard', 'modify', 'refactor', 'audit',
    'status', 'explain', 'back', 'help',
  ]
  for (const name of commandNames) {
    const filePath = join(templatesDir, `${name}.md`)
    if (existsSync(filePath)) {
      commands[name] = readFileSync(filePath, 'utf8')
    }
  }
  return commands
}

export async function run(opts = {}) {
  console.log('\n' + chalk.bold.white('  BuildFlow — AI Tool Integration'))
  console.log(chalk.dim('  Install slash commands into your AI coding tools\n'))

  const spinner = ora('Detecting installed AI tools...').start()
  await new Promise(r => setTimeout(r, 600))

  const detected = {}
  for (const [id, tool] of Object.entries(TOOLS)) {
    detected[id] = tool.detect()
  }

  spinner.stop()

  const detectedList = Object.entries(detected).filter(([, found]) => found)
  const notFoundList = Object.entries(detected).filter(([, found]) => !found)

  if (detectedList.length > 0) {
    console.log(chalk.green('  ✓ Detected on your system:'))
    for (const [id] of detectedList) {
      const t = TOOLS[id]
      console.log(chalk.green(`    ${t.icon}  ${t.name}`) + chalk.dim(` — ${t.description}`))
    }
  } else {
    console.log(chalk.yellow('  ⚠  No AI tools detected automatically.'))
    console.log(chalk.dim('     You can still install for tools not on this list.\n'))
  }

  if (notFoundList.length > 0) {
    console.log(chalk.dim('\n  Not detected (can still install):'))
    for (const [id] of notFoundList) {
      const t = TOOLS[id]
      console.log(chalk.dim(`    ${t.icon}  ${t.name}`))
    }
  }

  console.log('')

  let toolsToInstall

  if (opts.tool === 'all') {
    toolsToInstall = Object.keys(TOOLS)
  } else if (opts.tool) {
    toolsToInstall = [opts.tool]
  } else if (opts.yes) {
    toolsToInstall = detectedList.map(([id]) => id)

    if (toolsToInstall.length === 0) {
      console.log(chalk.yellow('\n  No AI tools detected automatically. Skipping tool installation.\n'))
      return
    }
  } else {
    const choices = Object.entries(TOOLS).map(([id, tool]) => ({
      name: id,
      message: `${tool.icon}  ${tool.name}${detected[id] ? chalk.green(' ✓') : ''}`,
      hint: tool.description,
    }))

    const { tools } = await prompt({
      type: 'multiselect',
      name: 'tools',
      message: 'Which AI tools do you want to install BuildFlow into?',
      hint: '(Space to select, Enter to confirm)',
      choices,
      initial: detectedList.map(([id]) => id),
    })

    if (!tools || tools.length === 0) {
      console.log(chalk.yellow('\n  Nothing selected. Exiting.\n'))
      return
    }

    toolsToInstall = tools
  }

  let scope
  if (opts.global) {
    scope = 'global'
  } else if (opts.local) {
    scope = 'local'
  } else if (opts.yes) {
    scope = 'local'
  } else {
    const { installScope } = await prompt({
      type: 'select',
      name: 'installScope',
      message: 'Install scope:',
      choices: [
        {
          name: 'local',
          message: 'Local — This project only',
          hint: 'Writes to .claude/commands/, .cursor/rules/, etc. in current directory',
        },
        {
          name: 'global',
          message: 'Global — All projects',
          hint: 'Writes to ~/.claude/commands/, ~/.gemini/, etc.',
        },
        {
          name: 'both',
          message: 'Both',
          hint: 'Global baseline + local overrides',
        },
      ],
    })
    scope = installScope
  }

  const commandFiles = loadCommandTemplates()
  const commandCount = Object.keys(commandFiles).length

  console.log(chalk.dim(`\n  Installing ${commandCount} commands into ${toolsToInstall.length} tool(s)...\n`))

  const results = []

  for (const toolId of toolsToInstall) {
    const tool = TOOLS[toolId]
    if (!tool) {
      console.log(chalk.red(`  ✗ Unknown tool: ${toolId}`))
      continue
    }

    const sp = ora(`  ${tool.icon}  Installing into ${tool.name}...`).start()

    try {
      let installDir

      if (scope === 'global' || scope === 'both') {
        installDir = tool.installGlobal(commandFiles)
      }
      if (scope === 'local' || scope === 'both') {
        installDir = tool.installLocal(commandFiles)
      }

      sp.succeed(chalk.green(`  ${tool.icon}  ${tool.name}`) + chalk.dim(` → ${installDir}`))
      results.push({ tool, success: true })
    } catch (err) {
      sp.fail(chalk.red(`  ${tool.icon}  ${tool.name} — ${err.message}`))
      results.push({ tool, success: false, error: err })
    }
  }

  const succeeded = results.filter(r => r.success)
  const failed    = results.filter(r => !r.success)

  console.log('\n' + chalk.bold.white('  ─── Installation Complete ───\n'))

  for (const { tool } of succeeded) {
    console.log(chalk.green(`  ✓ ${tool.icon}  ${tool.name}`))
    console.log(chalk.dim(`     ${tool.triggerNote}`))
    console.log('')
  }

  if (failed.length > 0) {
    console.log(chalk.red('\n  Failed:'))
    for (const { tool, error } of failed) {
      console.log(chalk.red(`  ✗ ${tool.name}: ${error.message}`))
    }
  }

  if (succeeded.length > 0) {
    console.log(chalk.bold('\n  Next steps:\n'))
    console.log(chalk.white('  1. Open your AI tool in this project'))
    if (succeeded.every(({ tool }) => tool.id === 'codex')) {
      console.log(chalk.white('  2. Restart Codex CLI so new skills are loaded'))
      console.log(chalk.white('  3. Start with: ') + chalk.cyan('$buildflow-start'))
      console.log(chalk.white('     Or for existing projects: ') + chalk.cyan('$buildflow-onboard'))
    } else {
      console.log(chalk.white('  2. Type "/" to see BuildFlow commands'))
      console.log(chalk.white('  3. Start with: ') + chalk.cyan('/buildflow-start'))
      console.log(chalk.white('     Or for existing projects: ') + chalk.cyan('/buildflow-onboard'))
    }
    console.log('')
  }
}
