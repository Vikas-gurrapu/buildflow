import chalk from 'chalk'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export async function showWelcome() {
  const isInitialized = existsSync(join(process.cwd(), '.buildflow'))

  console.log('\n' + chalk.bold.white('  BuildFlow v3.0'))
  console.log(chalk.dim('  Adaptive AI-powered development orchestration\n'))

  console.log(
    chalk.dim('  Works with: ') +
    chalk.hex('#8B5CF6')('Claude Code') + '  ' +
    chalk.hex('#4285F4')('Gemini CLI') + '  ' +
    chalk.hex('#10A37F')('Codex CLI') + '  ' +
    chalk.white('Cursor') + '  ' +
    chalk.hex('#007AFF')('Cline') + '  ' +
    chalk.hex('#F59E0B')('Continue')
  )
  console.log('')

  if (isInitialized) {
    let state = {}
    try {
      const statePath = join(process.cwd(), '.buildflow', 'core', 'state.md')
      const raw = readFileSync(statePath, 'utf8')
      state = {
        app:   raw.match(/Project:\s*(.+)/)?.[1]?.trim() ?? '?',
        type:  raw.match(/Type:\s*(.+)/)?.[1]?.trim() ?? '?',
        phase: raw.match(/Phase:\s*(.+)/)?.[1]?.trim() ?? '0',
      }
    } catch {}

    console.log(chalk.green('  ✓ BuildFlow active') + chalk.dim(` — ${state.app} (${state.type})`))
    console.log('')
    console.log(chalk.bold('  Commands:'))
    console.log('')

    if (state.type?.includes('existing')) {
      console.log(chalk.cyan('    /buildflow-onboard ') + chalk.dim('  Map your codebase (run once)'))
      console.log(chalk.cyan('    /buildflow-modify  ') + chalk.dim('  Change existing code safely'))
      console.log(chalk.cyan('    /buildflow-refactor') + chalk.dim('  Improve existing code'))
    } else {
      console.log(chalk.cyan('    /buildflow-start  ') + chalk.dim('  Begin your project'))
      console.log(chalk.cyan('    /buildflow-think  ') + chalk.dim('  Discuss & research'))
      console.log(chalk.cyan('    /buildflow-plan   ') + chalk.dim('  Create execution plan'))
    }

    console.log(chalk.cyan('    /buildflow-build  ') + chalk.dim('  Execute the plan'))
    console.log(chalk.cyan('    /buildflow-check  ') + chalk.dim('  Verify quality'))
    console.log(chalk.cyan('    /buildflow-ship   ') + chalk.dim('  Finalize (runs security gate)'))
    console.log(chalk.cyan('    /buildflow-audit  ') + chalk.dim('  Run security audit'))
    console.log(chalk.cyan('    /buildflow-status ') + chalk.dim('  Where am I?'))
    console.log('')
    console.log(chalk.dim('  CLI commands:'))
    console.log(chalk.white('    buildflow status  ') + chalk.dim('  Show project status'))
    console.log(chalk.white('    buildflow audit   ') + chalk.dim('  Run security audit from terminal'))
    console.log(chalk.white('    buildflow update  ') + chalk.dim('  Update BuildFlow commands'))
  } else {
    console.log(chalk.yellow('  Not initialized in this directory.\n'))
    console.log(chalk.bold('  Get started:\n'))
    console.log(
      '    ' + chalk.bgCyan.black(' npx buildflow-dev init ') +
      chalk.dim('  ← Set up BuildFlow + install slash commands')
    )
    console.log('')
    console.log(chalk.dim('  What this does:'))
    console.log(chalk.dim('    1. Detects your project (framework, language, existing code)'))
    console.log(chalk.dim('    2. Sets up .buildflow/ with agents, memory, security rules'))
    console.log(chalk.dim('    3. Detects Claude Code, Gemini CLI, Codex CLI, Cursor, etc.'))
    console.log(chalk.dim('    4. Installs /buildflow-* slash commands into each detected tool'))
    console.log(chalk.dim('    5. Type "/" in your AI tool to start'))
    console.log('')
    console.log(chalk.bold('  Or install directly into a specific tool:\n'))
    console.log(chalk.white('    buildflow install --tool claude'))
    console.log(chalk.white('    buildflow install --tool gemini'))
    console.log(chalk.white('    buildflow install --tool codex'))
    console.log(chalk.white('    buildflow install --tool cursor'))
    console.log(chalk.white('    buildflow install --tool all'))
  }

  console.log('')
}
