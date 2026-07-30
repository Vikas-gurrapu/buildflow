import chalk from 'chalk'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { refreshInstalledTools } from './install.js'
import { checkVersion, clearUpdateNotice } from '../utils/checkVersion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function run(opts = {}) {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'))

  if (opts.check) {
    const update = await checkVersion(pkg.version)

    // Silent when there's nothing to report — this runs on every AI session
    // start (see UPDATE_CHECK_INSTRUCTION), and several AI tools surface raw
    // tool/shell output to the user regardless of what the AI is told to do
    // with it. Printing "up to date" unconditionally here means the user sees
    // a notice every session no matter what; only emit output when an update
    // genuinely exists.
    if (update) {
      console.log('\n' + chalk.bold.white('  BuildFlow Update Check\n'))
      console.log(chalk.yellow(`  Update available: ${update.current} → ${update.latest}`))
      console.log(chalk.white('  Run: npx buildflow-dev@latest update\n'))
    }
    return
  }

  console.log('\n' + chalk.bold.white('  Updating BuildFlow...\n'))

  const inProject = existsSync(join(process.cwd(), '.buildflow'))
  if (!inProject) {
    console.log(chalk.dim('  Tip: run this from inside your project directory to also'))
    console.log(chalk.dim('  refresh local command files (e.g. .claude/commands/).\n'))
  }

  // Re-push latest command templates to all previously installed tools
  await refreshInstalledTools()

  // Clear the update notice now that we've updated
  clearUpdateNotice()

  console.log(chalk.green(`\n  ✓ BuildFlow updated to v${pkg.version}\n`))
}
