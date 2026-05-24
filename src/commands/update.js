import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { refreshInstalledTools } from './install.js'
import { checkVersion, clearUpdateNotice } from '../utils/checkVersion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function run(opts = {}) {
  const base = join(process.cwd(), '.buildflow')

  if (!existsSync(base)) {
    console.log(chalk.yellow('\n  BuildFlow not initialized. Run: npx buildflow-dev init\n'))
    return
  }

  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'))

  if (opts.check) {
    console.log('\n' + chalk.bold.white('  BuildFlow Update Check\n'))
    const sp = ora('Checking npm registry...').start()
    const update = await checkVersion(pkg.version)
    sp.stop()

    if (update) {
      console.log(chalk.yellow(`  Update available: ${update.current} → ${update.latest}`))
      console.log(chalk.white('  Run: npx buildflow-dev update\n'))
    } else {
      console.log(chalk.green(`  ✓ Up to date (v${pkg.version})\n`))
    }
    return
  }

  console.log('\n' + chalk.bold.white('  Updating BuildFlow...\n'))

  // Re-push latest command templates to all previously installed tools
  await refreshInstalledTools()

  // Clear the update notice now that we've updated
  clearUpdateNotice()

  console.log(chalk.green(`\n  ✓ BuildFlow updated to v${pkg.version}\n`))
}
