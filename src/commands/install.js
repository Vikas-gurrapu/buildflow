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
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'))

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

    isInstalledLocal()  { return existsSync(join(process.cwd(), '.claude', 'commands', 'buildflow-start-epic.md')) },
    isInstalledGlobal() { return existsSync(join(homedir(), '.claude', 'commands', 'buildflow-start-epic.md')) },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.claude', 'commands')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), guardedCommandContent(content))
      }
      return dir
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.claude', 'commands')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), guardedCommandContent(content))
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
      const hasCli = (() => { try { which.sync('gemini'); return true } catch { return false } })()
      // Also check config dir — binary may not be on PATH in all shells
      const hasGeminiDir = existsSync(join(homedir(), '.gemini'))
      return hasCli || hasGeminiDir
    },

    isInstalledLocal() {
      const cmdFile = existsSync(join(process.cwd(), '.gemini', 'commands', 'buildflow-start-epic.toml'))
        || existsSync(join(process.cwd(), '.gemini', 'commands', 'start.md'))
      const ctxFile = existsSync(join(process.cwd(), 'GEMINI.md')) &&
        readFileSafe(join(process.cwd(), 'GEMINI.md')).includes('BuildFlow')
      return cmdFile || ctxFile
    },
    isInstalledGlobal() {
      const cmdFile = existsSync(join(homedir(), '.gemini', 'commands', 'buildflow-start-epic.toml'))
        || existsSync(join(homedir(), '.gemini', 'commands', 'start.md'))
      const ctxFile = existsSync(join(homedir(), '.gemini', 'GEMINI.md')) &&
        readFileSafe(join(homedir(), '.gemini', 'GEMINI.md')).includes('BuildFlow')
      return cmdFile || ctxFile
    },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.gemini', 'commands')
      mkdirSync(dir, { recursive: true })
      patchGeminiContext(join(homedir(), '.gemini', 'GEMINI.md'), commandFiles)
      for (const [name, content] of Object.entries(commandFiles)) {
        writeGeminiCommand(dir, name, content)
      }
      return dir
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.gemini', 'commands')
      mkdirSync(dir, { recursive: true })
      patchGeminiContext(join(process.cwd(), 'GEMINI.md'), commandFiles)
      for (const [name, content] of Object.entries(commandFiles)) {
        writeGeminiCommand(dir, name, content)
      }
      return dir
    },

    triggerNote: 'In Gemini CLI, type "/buildflow-start-epic" or ask Gemini to run a buildflow command',
  },

  codex: {
    id: 'codex',
    name: 'Codex CLI',
    description: "OpenAI's Codex command-line coding agent",
    icon: '🟢',
    docsUrl: 'https://github.com/openai/codex',

    detect() {
      const hasCli = (() => { try { which.sync('codex'); return true } catch { return false } })()
      const hasCodexDir = existsSync(join(homedir(), '.codex'))
      return hasCli || hasCodexDir
    },

    isInstalledLocal()  { return existsSync(join(process.cwd(), '.codex', 'instructions', 'buildflow-start-epic.md')) },
    isInstalledGlobal() { return existsSync(join(homedir(), '.codex', 'instructions', 'buildflow-start-epic.md')) },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.codex', 'instructions')
      const skillsDir = join(homedir(), '.codex', 'skills')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `buildflow-${name}.md`), guardedCommandContent(content))
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
        writeFileSync(join(dir, `buildflow-${name}.md`), guardedCommandContent(content))
        writeCodexSkill(skillsDir, name, content)
      }
      patchAgentsMd(join(process.cwd(), 'AGENTS.md'), 'local')
      return `${dir} + ${skillsDir}`
    },

    triggerNote: 'In Codex CLI, use $buildflow-start-epic or say "use buildflow-start-epic". Slash menu commands are not exposed by Codex.',
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

    isInstalledLocal()  { return existsSync(join(process.cwd(), '.cursor', 'rules', 'buildflow.mdc')) },
    isInstalledGlobal() { return this.isInstalledLocal() },

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

    isInstalledLocal() {
      return readFileSafe(join(process.cwd(), '.clinerules')).includes('BuildFlow')
    },
    isInstalledGlobal() { return this.isInstalledLocal() },

    installGlobal(commandFiles) {
      return this.installLocal(commandFiles)
    },

    installLocal(commandFiles) {
      writeFileSync(join(process.cwd(), '.clinerules'), clineRulesContent(commandFiles))
      return process.cwd()
    },

    triggerNote: 'Cline reads .clinerules automatically. Type "use /buildflow-start-epic" in Cline chat.',
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

    isInstalledLocal()  { return existsSync(join(process.cwd(), '.continue', 'buildflow', 'start.md')) },
    isInstalledGlobal() { return existsSync(join(homedir(), '.continue', 'buildflow', 'start.md')) },

    installGlobal(commandFiles) {
      const dir = join(homedir(), '.continue', 'buildflow')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `${name}.md`), guardedCommandContent(content))
      }
      patchContinueConfig(commandFiles)
      return dir
    },

    installLocal(commandFiles) {
      const dir = join(process.cwd(), '.continue', 'buildflow')
      mkdirSync(dir, { recursive: true })
      for (const [name, content] of Object.entries(commandFiles)) {
        writeFileSync(join(dir, `${name}.md`), guardedCommandContent(content))
      }
      return dir
    },

    triggerNote: 'In Continue, use @BuildFlow in chat or trigger custom slash commands.',
  },

}

const UPDATE_CHECK_INSTRUCTION = `
## BuildFlow Update Check (Run Every Session)

At the very start of every session, before anything else:
1. Run this shell command silently: \`npx buildflow-dev@latest update --check\`
2. If \`.buildflow/core/UPDATE.md\` exists after the check, notify the user:
   > "BuildFlow update available — run \`npx buildflow-dev@latest update\` to upgrade."
   Then show the contents of UPDATE.md so the user sees the version details.
3. If the file does not exist, proceed silently.
`

const FOLDER_ACCESS_GUARD = `
## Folder Access Guard

Before reading or writing any file outside \`.buildflow/\`, check \`.buildflow/you/preferences.md\` → \`path_permissions\`:

1. Extract the top-level folder of the target path — e.g., \`src/auth/service.ts\` → \`src/\`, \`tests/auth/\` → \`tests/\`
2. Look up that folder in \`path_permissions\`:
   - **\`approved\`**: proceed immediately, no prompt
   - **\`denied\`**: skip this path, warn once: "Access to \`[folder]/\` is denied in preferences.md"
   - **not listed**: show this prompt **once per folder per session**:

\`\`\`
──────────────────────────────────────────────────
BuildFlow needs access to [folder]/
  [1] Yes         — allow this session, ask again next time
  [2] Yes, always — allow + save to preferences (never ask again)
  [3] No          — deny access to this folder
──────────────────────────────────────────────────
\`\`\`

   - **[1]**: proceed, cache approval for this session only
   - **[2]**: add \`  [folder]/: approved\` under \`path_permissions\` in \`.buildflow/you/preferences.md\`, then proceed
   - **[3]**: add \`  [folder]/: denied\` under \`path_permissions\` in \`.buildflow/you/preferences.md\`, skip this path

**Rules:**
- Ask once per folder per session — cache the response, never ask again for the same folder this session
- \`.buildflow/\` is always accessible — never prompt for it
- When a command needs multiple new folders at once, list them all in a single prompt instead of asking one by one
- If \`path_permissions\` key is absent from preferences.md, treat all folders as not listed
`

function guardedCommandContent(commandContent) {
  return `${FOLDER_ACCESS_GUARD}\n\n${commandContent}`
}

function geminiContextBlock(commandFiles) {
  const commandList = Object.keys(commandFiles)
    .map(name => `- \`/buildflow-${name}\`: see .gemini/commands/buildflow-${name}.toml`)
    .join('\n')
  return `## BuildFlow Commands

When the user types a /buildflow-* command, load and execute the corresponding file from .gemini/commands/.

${commandList}
${UPDATE_CHECK_INSTRUCTION}${FOLDER_ACCESS_GUARD}`
}

function writeGeminiCommand(commandsDir, name, commandContent) {
  const commandName = `buildflow-${name}`
  const description = extractFrontmatterValue(commandContent, 'description') || `Run ${commandName}`
  const prompt = `Execute the BuildFlow workflow below end-to-end. Treat any user text after /${commandName} as arguments for this workflow.\n\n${guardedCommandContent(commandContent)}`
  const toml = [
    `description = ${JSON.stringify(description)}`,
    `prompt = ${JSON.stringify(prompt)}`,
    '',
  ].join('\n')
  writeFileSync(join(commandsDir, `${commandName}.toml`), toml)
}

function patchAgentsMd(filePath, scope) {
  const existing = readFileSafe(filePath)
  const dir = scope === 'global' ? '~/.codex/instructions/' : '.codex/instructions/'
  const block = `## BuildFlow Instructions\n\nWhen the user types $buildflow-<command> or /buildflow-<command>, load the matching file from ${dir} and follow those instructions.\n\nAvailable commands: start, think, spec, plan, build, test, check, ship, onboard, modify, refactor, hotfix, audit, debug, deploy, docker, workspace, status, explain, back, revert, help\n${UPDATE_CHECK_INSTRUCTION}${FOLDER_ACCESS_GUARD}`
  if (existing.includes('## BuildFlow Instructions')) {
    const updated = existing.replace(
      /## BuildFlow Instructions[\s\S]*?(?=\n## (?!BuildFlow Update Check|Folder Access Guard)|\n# |$)/,
      block
    )
    writeFileSync(filePath, updated)
  } else {
    writeFileSync(filePath, existing + (existing ? '\n\n' : '') + block)
  }
}

function writeCodexSkill(skillsDir, name, commandContent) {
  const skillName = `buildflow-${name}`
  const skillDir = join(skillsDir, skillName)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), codexSkillContent(skillName, commandContent))
}

function codexSkillContent(skillName, commandContent) {
  const description = extractFrontmatterValue(commandContent, 'description') || `Run ${skillName}`
  return `---\nname: "${skillName}"\ndescription: "${escapeYamlString(description)}"\nmetadata:\n  short-description: "${escapeYamlString(description)}"\n---\n\n<objective>\nExecute the BuildFlow workflow below end-to-end.\nTreat any user text after $${skillName} as arguments for this workflow.\n</objective>\n\n<folder-access-guard>\n${FOLDER_ACCESS_GUARD.trim()}\n</folder-access-guard>\n\n<workflow>\n${commandContent}\n</workflow>\n`
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
${UPDATE_CHECK_INSTRUCTION}
${FOLDER_ACCESS_GUARD}
## Available Commands

When the user types @buildflow-<command> or references a buildflow command, execute the corresponding workflow:

${commandDescriptions}

## Core Rules

1. Load .buildflow/memory/light.md at session start
2. Ask confidence (1-5) on major decisions
3. Show alternatives before locking choices
4. Add LEARN: comments for new concepts
5. Respect \`.buildflow/you/preferences.md\` git.permission before any git command
6. Create restore points before destructive changes (file snapshot unless git.permission is approved)
7. Run security checks before shipping
8. Cite sources with trust scores

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
${UPDATE_CHECK_INSTRUCTION}
${FOLDER_ACCESS_GUARD}
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
- Respect \`.buildflow/you/preferences.md\` git.permission before any git command
- Create restore points before destructive operations (file snapshot unless git.permission is approved)

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
  for (const command of config.slashCommands) {
    if (typeof command.name === 'string' && command.name.startsWith('buildflow-')) {
      const name = command.name.replace(/^buildflow-/, '')
      command.prompt = `Execute the BuildFlow ${name} workflow from .continue/buildflow/${name}.md, including its Folder Access Guard before file access.`
    }
  }
  const toAdd = Object.keys(commandFiles)
    .filter(name => !existing.includes(`buildflow-${name}`))
    .map(name => ({
      name: `buildflow-${name}`,
      description: `BuildFlow: ${name}`,
      prompt: `Execute the BuildFlow ${name} workflow from .continue/buildflow/${name}.md, including its Folder Access Guard before file access.`,
    }))

  config.slashCommands.push(...toAdd)
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function claudeMdContent() {
  const templatePath = join(__dirname, '../../templates/CLAUDE.md')
  return readFileSync(templatePath, 'utf8').replace('{{APP_NAME}}', detectAppName())
}

// ── Global project registry ──────────────────────────────────────────────────
// Tracks all directories where `buildflow init` has been run so that
// `buildflow update` can refresh local command files in every project,
// not just the current working directory.

const REGISTRY_PATH = join(homedir(), '.buildflow', 'projects.json')

export function getProjectRegistry() {
  try { return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) } catch { return [] }
}

export function registerProject(projectPath) {
  mkdirSync(join(homedir(), '.buildflow'), { recursive: true })
  const projects = getProjectRegistry()
  if (!projects.includes(projectPath)) {
    projects.push(projectPath)
    writeFileSync(REGISTRY_PATH, JSON.stringify(projects, null, 2))
  }
}

// Refresh local command files inside a specific project directory.
// Called by refreshInstalledTools for every registered project.
function refreshProjectLocal(projectPath, commandFiles) {
  let refreshed = false

  const claudeDir = join(projectPath, '.claude', 'commands')
  if (existsSync(claudeDir)) {
    for (const [name, content] of Object.entries(commandFiles)) {
      writeFileSync(join(claudeDir, `buildflow-${name}.md`), guardedCommandContent(content))
    }
    const claudeMd = join(projectPath, 'CLAUDE.md')
    if (existsSync(claudeMd)) {
      writeFileSync(claudeMd, readFileSync(join(__dirname, '../../templates/CLAUDE.md'), 'utf8')
        .replace('{{APP_NAME}}', projectPath.split(/[/\\]/).pop()))
    }
    refreshed = true
  }

  const geminiDir = join(projectPath, '.gemini', 'commands')
  if (existsSync(geminiDir)) {
    patchGeminiContext(join(projectPath, 'GEMINI.md'), commandFiles)
    for (const [name, content] of Object.entries(commandFiles)) {
      writeGeminiCommand(geminiDir, name, content)
    }
    refreshed = true
  }

  const codexDir = join(projectPath, '.codex', 'instructions')
  if (existsSync(codexDir)) {
    for (const [name, content] of Object.entries(commandFiles)) {
      writeFileSync(join(codexDir, `buildflow-${name}.md`), guardedCommandContent(content))
      writeCodexSkill(join(projectPath, '.codex', 'skills'), name, content)
    }
    patchAgentsMd(join(projectPath, 'AGENTS.md'), 'local')
    refreshed = true
  }

  const cursorDir = join(projectPath, '.cursor', 'rules')
  if (existsSync(join(cursorDir, 'buildflow.mdc'))) {
    writeFileSync(join(cursorDir, 'buildflow.mdc'), cursorRulesContent(commandFiles))
    refreshed = true
  }

  const clineRules = join(projectPath, '.clinerules')
  if (readFileSafe(clineRules).includes('BuildFlow')) {
    writeFileSync(clineRules, clineRulesContent(commandFiles))
    refreshed = true
  }

  const continueDir = join(projectPath, '.continue', 'buildflow')
  if (existsSync(continueDir)) {
    for (const [name, content] of Object.entries(commandFiles)) {
      writeFileSync(join(continueDir, `${name}.md`), guardedCommandContent(content))
    }
    refreshed = true
  }

  return refreshed
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function readFileSafe(filePath) {
  try { return readFileSync(filePath, 'utf8') } catch { return '' }
}

// Writes or replaces the BuildFlow block in a GEMINI.md context file.
// Always overwrites the block so updates pick up new commands.
function patchGeminiContext(contextPath, commandFiles) {
  const existing = readFileSafe(contextPath)
  const block = geminiContextBlock(commandFiles)
  if (existing.includes('## BuildFlow Commands')) {
    const updated = existing.replace(
      /## BuildFlow Commands[\s\S]*?(?=\n## (?!BuildFlow Update Check|Folder Access Guard)|\n# |$)/,
      block.trimStart()
    )
    writeFileSync(contextPath, updated)
  } else {
    writeFileSync(contextPath, existing + (existing ? '\n\n' : '') + block)
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

export async function refreshInstalledTools(opts = {}) {
  const commandFiles = loadCommandTemplates()
  const commandCount = Object.keys(commandFiles).length
  const results = []

  for (const tool of Object.values(TOOLS)) {
    const local  = tool.isInstalledLocal()
    const global = tool.isInstalledGlobal()
    if (!local && !global) continue

    const sp = ora(`  ${tool.icon}  Refreshing ${tool.name}...`).start()
    try {
      // Always refresh every scope that has BuildFlow installed —
      // local and global can both be stale after a version bump.
      if (local)  tool.installLocal(commandFiles)
      if (global) tool.installGlobal(commandFiles)
      const scope = local && global ? 'local + global' : local ? 'local' : 'global'
      sp.succeed(chalk.green(`  ${tool.icon}  ${tool.name}`) + chalk.dim(` — ${commandCount} commands refreshed (${scope})`))
      results.push({ tool, success: true })
    } catch (err) {
      sp.fail(chalk.red(`  ${tool.icon}  ${tool.name} — ${err.message}`))
      results.push({ tool, success: false, error: err })
    }
  }

  if (results.length === 0) {
    console.log(chalk.yellow('  No previously installed tools found.'))
    console.log(chalk.dim('  Run: npx buildflow-dev install\n'))
  } else {
    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
      console.log(chalk.red('\n  Some tools failed to update:'))
      for (const { tool, error } of failed) {
        console.log(chalk.red(`  ✗ ${tool.name}: ${error.message}`))
      }
    }
  }

  // Refresh local command files in every registered project
  const projects = getProjectRegistry()
  // Always include cwd if it's an initialized buildflow project
  if (existsSync(join(process.cwd(), '.buildflow')) && !projects.includes(process.cwd())) {
    projects.push(process.cwd())
  }

  const validProjects = projects.filter(p => existsSync(join(p, '.buildflow')))
  if (validProjects.length > 0) {
    console.log(chalk.dim(`\n  Refreshing ${validProjects.length} registered project(s)...\n`))
    for (const projectPath of validProjects) {
      const name = projectPath.split(/[/\\]/).pop()
      try {
        const touched = refreshProjectLocal(projectPath, commandFiles)
        if (touched) {
          console.log(chalk.green(`  ✓ ${name}`) + chalk.dim(`  ${projectPath}`))
        }
      } catch (err) {
        console.log(chalk.red(`  ✗ ${name} — ${err.message}`))
      }
    }

    // Prune stale entries from registry
    const stale = projects.filter(p => !existsSync(join(p, '.buildflow')))
    if (stale.length > 0) {
      writeFileSync(REGISTRY_PATH, JSON.stringify(validProjects, null, 2))
    }
  }

  return results
}

export function getToolStatus() {
  return Object.values(TOOLS).map(tool => ({
    id:              tool.id,
    name:            tool.name,
    icon:            tool.icon,
    detected:        tool.detect(),
    installedLocal:  tool.isInstalledLocal(),
    installedGlobal: tool.isInstalledGlobal(),
  }))
}

export function printBuildFlowBanner(subtitle = 'AI Tool Integration') {
  const banner = [
    '  ____        _ _     _ _____ _',
    ' | __ ) _   _(_) | __| |  ___| | _____      __',
    " |  _ \\| | | | | |/ _` | |_  | |/ _ \\ \\ /\\ / /",
    ' | |_) | |_| | | | (_| |  _| | | (_) \\ V  V /',
    ' |____/ \\__,_|_|_|\\__,_|_|   |_|\\___/ \\_/\\_/',
  ]
  const author = typeof pkg.author === 'string' ? pkg.author.replace(/\s*<[^>]+>/, '') : 'Vikas Gurrapu'

  console.log('')
  for (const line of banner) console.log(chalk.cyan(line))
  console.log('')
  console.log(chalk.bold.white(`  BuildFlow ${chalk.dim(`v${pkg.version}`)}`))
  console.log(chalk.dim(`  Developed by ${author}`))
  console.log(chalk.white('  Spec-driven, multi-agent development orchestration.'))
  console.log(chalk.dim('  Works with Claude Code, Gemini CLI, Codex CLI, Cursor, Cline, and Continue.'))
  console.log('')
  console.log(chalk.bold.white('  Status'))
  console.log(chalk.green('  ✓ Commands') + chalk.dim('        BuildFlow workflows for supported AI tools'))
  console.log(chalk.green('  ✓ Project memory') + chalk.dim('  .buildflow context, decisions, specs, and safety state'))
  console.log(chalk.green('  ✓ Safety layer') + chalk.dim('     restore points, security debt, and pre-ship checks'))
  console.log(chalk.green('  ✓ Update hooks') + chalk.dim('      keeps installed commands current'))
  console.log('')
  console.log(chalk.bold.white(`  ${subtitle}`))
  console.log(chalk.dim('  Installs BuildFlow commands, project memory, safety checks, and update hooks.'))
  console.log('')
  console.log(chalk.bold.white('  Help'))
  console.log(chalk.cyan('  buildflow --help') + chalk.dim('       CLI commands'))
  console.log(chalk.cyan('  /buildflow-help') + chalk.dim('       Claude, Gemini, Cline, Continue'))
  console.log(chalk.cyan('  $buildflow-help') + chalk.dim('       Codex CLI'))
  console.log('')
}

function loadCommandTemplates() {
  const templatesDir = join(__dirname, '../../templates/commands')
  const commands = {}
  const commandNames = [
    'start-epic', 'think', 'discuss', 'spec', 'plan', 'build', 'test', 'check', 'ship',
    'onboard', 'modify', 'refactor', 'hotfix', 'audit',
    'debug', 'perf', 'deploy', 'docker', 'workspace',
    'status', 'explain', 'back', 'revert', 'help',
    'complete-epic', 'switch-epic', 'settings',
    'ui-spec', 'ui-review',
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
  printBuildFlowBanner('AI Tool Installation')

  const spinner = ora('Detecting installed AI tools...').start()
  await new Promise(r => setTimeout(r, 600))

  const detected = {}
  for (const [id, tool] of Object.entries(TOOLS)) {
    detected[id] = tool.detect()
  }

  spinner.stop()

  const detectedList = Object.entries(detected).filter(([, found]) => found)
  const notFoundList = Object.entries(detected).filter(([, found]) => !found)

  // Tools detected on the system but BuildFlow not yet installed into them
  const newlyDetected = detectedList.filter(([id]) => {
    const t = TOOLS[id]
    return !t.isInstalledLocal() && !t.isInstalledGlobal()
  })

  if (detectedList.length > 0) {
    console.log(chalk.green('  ✓ Detected on your system:'))
    for (const [id] of detectedList) {
      const t = TOOLS[id]
      const installed = t.isInstalledLocal() || t.isInstalledGlobal()
      const badge = installed ? chalk.dim(' (already installed)') : chalk.yellow(' (not yet installed)')
      console.log(chalk.green(`    ${t.icon}  ${t.name}`) + badge)
    }
  } else {
    console.log(chalk.yellow('  ⚠  No AI tools detected automatically.'))
    console.log(chalk.dim('     You can still install for tools not on this list.\n'))
  }

  if (newlyDetected.length > 0) {
    console.log(chalk.yellow(`\n  ${newlyDetected.length} tool(s) detected but BuildFlow not installed yet.`))
    console.log(chalk.dim('  They are pre-selected below.\n'))
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
    const choices = Object.entries(TOOLS).map(([id, tool]) => {
      const isInstalled = tool.isInstalledLocal() || tool.isInstalledGlobal()
      const statusBadge = !detected[id]
        ? ''
        : isInstalled
          ? chalk.dim(' (reinstall)')
          : chalk.yellow(' ← new')
      return {
        name: id,
        message: `${tool.icon}  ${tool.name}${statusBadge}`,
        hint: tool.description,
      }
    })

    const { tools } = await prompt({
      type: 'multiselect',
      name: 'tools',
      message: 'Which AI tools do you want to install BuildFlow into?',
      hint: '(Space to select, Enter to confirm)',
      choices,
      // Pre-select newly detected tools (detected but not yet installed)
      initial: newlyDetected.length > 0
        ? newlyDetected.map(([id]) => id)
        : detectedList.map(([id]) => id),
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
      console.log(chalk.white('  3. Start with: ') + chalk.cyan('$buildflow-start-epic'))
      console.log(chalk.white('     Or for existing projects: ') + chalk.cyan('$buildflow-onboard'))
    } else {
      console.log(chalk.white('  2. Type "/" to see BuildFlow commands'))
      console.log(chalk.white('  3. Start with: ') + chalk.cyan('/buildflow-start-epic'))
      console.log(chalk.white('     Or for existing projects: ') + chalk.cyan('/buildflow-onboard'))
    }
    console.log('')
  }
}
