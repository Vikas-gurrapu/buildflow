import chalk from 'chalk'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export async function run(opts = {}) {
  const base = join(process.cwd(), '.buildflow')

  if (!existsSync(base)) {
    console.log(chalk.yellow('\n  BuildFlow not initialized in this directory.'))
    console.log(chalk.dim('  Run: npx buildflow-dev init\n'))
    return
  }

  const read = (rel) => {
    try { return readFileSync(join(base, rel), 'utf8') } catch { return '' }
  }

  const state  = read('core/state.md')
  const memory = read('memory/light.md')
  const debt   = read('security/DEBT.md')

  const get = (src, key) => src.match(new RegExp(`${key}:\\s*(.+)`))?.[1]?.trim() ?? '—'

  console.log('\n' + chalk.bold.white('  BuildFlow Status\n'))
  console.log(chalk.dim('  Project:   ') + chalk.white(get(state, 'Project')))
  console.log(chalk.dim('  Type:      ') + chalk.white(get(state, 'Type')))
  console.log(chalk.dim('  Framework: ') + chalk.white(get(state, 'Framework')))
  console.log(chalk.dim('  Phase:     ') + chalk.white(get(state, 'Phase')))
  console.log(chalk.dim('  Status:    ') + chalk.white(get(state, 'Status')))
  console.log(chalk.dim('  Version:   ') + chalk.white(get(state, 'BuildFlow')))

  const onboarded = get(memory, 'onboarded')
  console.log(chalk.dim('\n  Codebase onboarded: ') +
    (onboarded === 'true' ? chalk.green('Yes') :
     onboarded === 'n/a'  ? chalk.dim('N/A (greenfield)') :
                            chalk.yellow('No — run /buildflow-onboard')))

  const hasDebt = debt.includes('## Active') && !debt.includes('[None]')
  console.log(chalk.dim('  Security debt: ') +
    (hasDebt ? chalk.red('⚠ Issues pending — see .buildflow/security/DEBT.md') : chalk.green('Clean')))

  if (opts.verbose) {
    console.log(chalk.dim('\n  .buildflow/ structure:'))
    const walk = (dir, prefix = '    ') => {
      try {
        for (const entry of readdirSync(dir)) {
          if (entry.startsWith('.')) continue
          const full = join(dir, entry)
          if (statSync(full).isDirectory()) {
            console.log(chalk.dim(`${prefix}${entry}/`))
            walk(full, prefix + '  ')
          } else {
            console.log(chalk.dim(`${prefix}${entry}`))
          }
        }
      } catch {}
    }
    walk(base)
  }

  console.log('')
}
