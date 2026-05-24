#!/usr/bin/env node

import { program } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

const loadInit    = () => import('../src/commands/init.js')
const loadInstall = () => import('../src/commands/install.js')
const loadAudit   = () => import('../src/commands/audit.js')
const loadStatus  = () => import('../src/commands/status.js')
const loadUpdate  = () => import('../src/commands/update.js')

program
  .name('buildflow')
  .description('Adaptive AI-powered development orchestration')
  .version(pkg.version)

program
  .command('init')
  .description('Initialize BuildFlow in the current project')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .option('--greenfield', 'Start a brand-new project')
  .option('--existing', 'Add BuildFlow to existing codebase')
  .action(async (opts) => {
    const { run } = await loadInit()
    await run(opts)
  })

program
  .command('install')
  .description('Install BuildFlow slash commands into an AI tool')
  .option('--tool <name>', 'AI tool to install into (claude|gemini|codex|cursor|all)')
  .option('--global', 'Install globally (available in all projects)')
  .option('--local', 'Install locally (current project only)')
  .action(async (opts) => {
    const { run } = await loadInstall()
    await run(opts)
  })

program
  .command('audit')
  .description('Run a security audit on the current project')
  .option('-q, --quick', 'Quick audit (recent changes only)')
  .option('-t, --target <path>', 'Audit specific file or directory')
  .option('-c, --category <name>', 'Check specific OWASP category (A01-A10)')
  .option('-r, --report', 'Show latest report')
  .action(async (opts) => {
    const { run } = await loadAudit()
    await run(opts)
  })

program
  .command('status')
  .description('Show BuildFlow status for current project')
  .option('-v, --verbose', 'Show detailed status')
  .action(async (opts) => {
    const { run } = await loadStatus()
    await run(opts)
  })

program
  .command('update')
  .description('Update BuildFlow commands and agents in current project')
  .option('--check', 'Check for updates without applying')
  .action(async (opts) => {
    const { run } = await loadUpdate()
    await run(opts)
  })

if (process.argv.length <= 2) {
  const { showWelcome } = await import('../src/utils/welcome.js')
  await showWelcome()
  process.exit(0)
}

program.parse()
