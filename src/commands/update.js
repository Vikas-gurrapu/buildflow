import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { run as runInstall } from './install.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function run(opts = {}) {
  const base = join(process.cwd(), '.buildflow')

  if (!existsSync(base)) {
    console.log(chalk.yellow('\n  BuildFlow not initialized. Run: npx buildflow-dev init\n'))
    return
  }

  if (opts.check) {
    console.log('\n' + chalk.bold.white('  BuildFlow Update Check\n'))
    const pkgPath = join(__dirname, '../../package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    console.log(chalk.dim(`  Local version: ${pkg.version}`))
    console.log(chalk.dim('  Run: npx buildflow-dev update  to update commands\n'))
    return
  }

  console.log('\n' + chalk.bold.white('  Updating BuildFlow...\n'))

  const sp = ora('Updating command files...').start()
  await new Promise(r => setTimeout(r, 400))
  sp.succeed(chalk.green('  ✓ Command files updated'))

  console.log('')
  await runInstall({ yes: opts.yes })
}
