import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs'
import { join, relative, resolve } from 'path'
import { execSync } from 'child_process'

const { prompt } = enquirer

// ─── Scan patterns (same source as audit.js) ─────────────────────────────────

const SECRET_PATTERNS = [
  { pattern: /(?<![a-zA-Z])(sk|pk|rk)[-_][a-zA-Z0-9]{20,}/g,             label: 'API Key (sk/pk/rk)' },
  { pattern: /AKIA[0-9A-Z]{16}/g,                                           label: 'AWS Access Key' },
  { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY/g,            label: 'Private Key' },
  { pattern: /['"]\s*(password|passwd|pwd|secret|api.?key|auth.?token)\s*['"]?\s*[:=]\s*['"][^'"]{4,}/gi, label: 'Hardcoded credential' },
  { pattern: /postgres:\/\/[^@]+:[^@]+@/g,                                  label: 'DB URL with credentials' },
  { pattern: /mongodb(\+srv)?:\/\/[^@]+:[^@]+@/g,                           label: 'MongoDB URL with credentials' },
]

const VULN_PATTERNS = [
  {
    pattern: /\.query\s*\(\s*[`'"]\s*SELECT.*?\$\{|\.query\s*\(\s*["'`].*?\+\s*\w/gs,
    label: 'Possible SQL Injection',
    severity: 'CRITICAL',
    owasp: 'A03',
    autoFix: null,
  },
  {
    pattern: /eval\s*\(/g,
    label: 'eval() usage',
    severity: 'HIGH',
    owasp: 'A03',
    autoFix: null,
  },
  {
    pattern: /exec\s*\(\s*[`'"]\s*.*?\$\{|execSync\s*\(\s*[`'"]\s*.*?\$\{/g,
    label: 'Command injection risk',
    severity: 'CRITICAL',
    owasp: 'A03',
    autoFix: null,
  },
  {
    pattern: /Math\.random\s*\(\)/g,
    label: 'Math.random() used for tokens (not cryptographically secure)',
    severity: 'HIGH',
    owasp: 'A07',
    autoFix: {
      description: 'Replace Math.random() with crypto.randomUUID() or crypto.getRandomValues()',
      apply: (content) => content.replace(/Math\.random\s*\(\)/g, 'crypto.randomUUID()'),
      note: 'Replaced Math.random() with crypto.randomUUID(). Review usage — randomUUID() returns a string, not a float.',
    },
  },
  {
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|key|user)[^)]*\)/gi,
    label: 'Sensitive data may be logged',
    severity: 'MEDIUM',
    owasp: 'A09',
    autoFix: null,
  },
]

const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage'])

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walkFiles(full)
    } else if (CODE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      yield full
    }
  }
}

function scanFile(filePath) {
  let content
  try { content = readFileSync(filePath, 'utf8') } catch { return [] }

  const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filePath) ||
                     filePath.includes('__tests__') ||
                     filePath.includes('fixtures')

  const findings = []
  const lines = content.split('\n')

  if (!isTestFile) {
    for (const { pattern, label } of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        pattern.lastIndex = 0
        if (pattern.test(lines[i])) {
          findings.push({
            type: 'SECRET',
            severity: 'CRITICAL',
            label,
            file: filePath,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 80),
            autoFix: null,
          })
        }
      }
    }
  }

  for (const { pattern, label, severity, owasp, autoFix } of VULN_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0
      if (pattern.test(lines[i])) {
        findings.push({
          type: 'VULN',
          severity,
          label,
          owasp,
          file: filePath,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 80),
          autoFix,
        })
      }
    }
  }

  return findings
}

// ─── Config / structural checks ───────────────────────────────────────────────

function checkConfigIssues(cwd) {
  const issues = []

  // .env not in .gitignore
  if (existsSync(join(cwd, '.env'))) {
    const gitignore = existsSync(join(cwd, '.gitignore'))
      ? readFileSync(join(cwd, '.gitignore'), 'utf8')
      : ''
    if (!gitignore.includes('.env')) {
      issues.push({
        type: 'CONFIG',
        severity: 'CRITICAL',
        label: '.env file is not in .gitignore — secrets could be committed',
        file: join(cwd, '.gitignore'),
        autoFix: {
          description: 'Add .env to .gitignore',
          apply: () => {
            const existing = existsSync(join(cwd, '.gitignore'))
              ? readFileSync(join(cwd, '.gitignore'), 'utf8')
              : ''
            writeFileSync(join(cwd, '.gitignore'), existing + '\n.env\n.env.local\n.env.*.local\n')
          },
        },
      })
    }
  }

  // Missing package-lock.json in a Node project
  if (existsSync(join(cwd, 'package.json')) && !existsSync(join(cwd, 'package-lock.json')) && !existsSync(join(cwd, 'yarn.lock')) && !existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    issues.push({
      type: 'CONFIG',
      severity: 'MEDIUM',
      label: 'No lockfile found (package-lock.json / yarn.lock / pnpm-lock.yaml) — dependency versions not pinned',
      file: join(cwd, 'package.json'),
      autoFix: {
        description: 'Run npm install to generate package-lock.json',
        apply: () => execSync('npm install', { cwd, stdio: 'ignore' }),
      },
    })
  }

  return issues
}

// ─── Fix application ──────────────────────────────────────────────────────────

function applyFileFix(filePath, autoFix) {
  const content = readFileSync(filePath, 'utf8')
  const fixed = autoFix.apply(content)
  writeFileSync(filePath, fixed)
}

// ─── Severity colour helper ───────────────────────────────────────────────────

function severityColor(s) {
  if (s === 'CRITICAL') return chalk.red
  if (s === 'HIGH')     return chalk.yellow
  return chalk.hex('#FFA500')
}

function severityIcon(s) {
  if (s === 'CRITICAL') return '🔴'
  if (s === 'HIGH')     return '🟡'
  return '🟠'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(opts = {}) {
  const cwd = process.cwd()

  console.log('\n' + chalk.bold.white('  BuildFlow — Fix Mode') + '\n')
  console.log(chalk.dim('  Scans for issues, auto-fixes safe ones, asks about the rest.\n'))

  // 1. Scan
  const spinner = ora('Scanning project...').start()
  const target = opts.target ? resolve(opts.target) : cwd

  const allFindings = []
  let fileCount = 0

  for (const filePath of walkFiles(target)) {
    fileCount++
    allFindings.push(...scanFile(filePath))
  }

  allFindings.push(...checkConfigIssues(cwd))
  spinner.stop()

  if (allFindings.length === 0) {
    console.log(chalk.green('  ✓ No issues found. Nothing to fix.\n'))
    return
  }

  // Sort: CRITICAL first, then HIGH, then MEDIUM
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 }
  allFindings.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))

  console.log(chalk.dim(`  Found ${allFindings.length} issue(s) across ${fileCount} files.\n`))

  // 2. Separate auto-fixable from prompt-required
  const autoFixable = allFindings.filter(f => f.autoFix !== null)
  const needsPrompt = allFindings.filter(f => f.autoFix === null)

  // ── Auto-fixes ──────────────────────────────────────────────────────────────
  if (autoFixable.length > 0) {
    console.log(chalk.bold('  Auto-fixable issues:\n'))

    for (const f of autoFixable) {
      const color = severityColor(f.severity)
      const icon  = severityIcon(f.severity)
      const rel   = f.file ? relative(cwd, f.file) : ''

      console.log(color(`  ${icon} [${f.severity}] ${f.label}`))
      if (rel) console.log(chalk.dim(`      File: ${rel}${f.line ? `:${f.line}` : ''}`))
      console.log(chalk.dim(`      Fix:  ${f.autoFix.description}`))
      console.log('')
    }

    const { confirmAuto } = await prompt({
      type: 'confirm',
      name: 'confirmAuto',
      message: `Apply ${autoFixable.length} auto-fix(es) now?`,
      initial: true,
    })

    if (confirmAuto) {
      for (const f of autoFixable) {
        const sp = ora(chalk.dim(`  Fixing: ${f.label}...`)).start()
        try {
          if (f.type === 'VULN' && f.file && f.autoFix.apply.length === 1) {
            // File-content fix
            applyFileFix(f.file, f.autoFix)
          } else {
            // Side-effect fix (gitignore, npm install, etc.)
            f.autoFix.apply()
          }
          sp.succeed(chalk.green(`  ✓ Fixed: ${f.label}`))
          if (f.autoFix.note) console.log(chalk.dim(`    Note: ${f.autoFix.note}`))
        } catch (err) {
          sp.fail(chalk.red(`  ✗ Failed: ${f.label} — ${err.message}`))
        }
      }
      console.log('')
    } else {
      console.log(chalk.dim('  Skipped auto-fixes.\n'))
    }
  }

  // ── Prompt-required issues ───────────────────────────────────────────────────
  if (needsPrompt.length > 0) {
    console.log(chalk.bold(`  ${needsPrompt.length} issue(s) require your decision:\n`))

    let fixed = 0
    let skipped = 0

    for (let i = 0; i < needsPrompt.length; i++) {
      const f = needsPrompt[i]
      const color = severityColor(f.severity)
      const icon  = severityIcon(f.severity)
      const rel   = f.file ? relative(cwd, f.file) : ''

      console.log(chalk.dim(`  [${i + 1}/${needsPrompt.length}]`))
      console.log(color(`  ${icon} [${f.severity}] ${f.label}`))
      if (rel)       console.log(chalk.dim(`      File:  ${rel}${f.line ? `:${f.line}` : ''}`))
      if (f.snippet) console.log(chalk.dim(`      Code:  ${f.snippet}`))
      if (f.owasp)   console.log(chalk.dim(`      OWASP: ${f.owasp}`))
      console.log('')

      const { action } = await prompt({
        type: 'select',
        name: 'action',
        message: 'What do you want to do?',
        choices: [
          { name: 'skip',    message: 'Skip — leave as-is for now' },
          { name: 'debt',    message: 'Log to security debt — track but do not fix now' },
          { name: 'open',    message: 'Open in editor — I will fix it manually' },
          { name: 'stop',    message: 'Stop — exit fix mode' },
        ],
      })

      if (action === 'stop') {
        console.log(chalk.dim(`\n  Stopped at issue ${i + 1}/${needsPrompt.length}.\n`))
        break
      }

      if (action === 'debt') {
        logSecurityDebt(cwd, f)
        console.log(chalk.dim('  Logged to .buildflow/security/DEBT.md\n'))
        fixed++
      } else if (action === 'open') {
        openInEditor(f.file, f.line)
        console.log(chalk.dim('  Opened in editor. Fix and save, then re-run: buildflow fix\n'))
        skipped++
      } else {
        skipped++
        console.log('')
      }
    }

    console.log(chalk.bold('\n  Summary:'))
    console.log(chalk.dim(`    Logged to debt: ${fixed}`))
    console.log(chalk.dim(`    Skipped/manual: ${skipped}`))
  }

  console.log(chalk.dim('\n  Re-run `buildflow fix` anytime to re-check.\n'))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logSecurityDebt(cwd, finding) {
  const debtPath = join(cwd, '.buildflow', 'security', 'DEBT.md')
  if (!existsSync(debtPath)) return

  const existing = readFileSync(debtPath, 'utf8')
  const today = new Date().toISOString().split('T')[0]
  const rel   = finding.file ? relative(cwd, finding.file) : 'unknown'
  const entry = `\n### ${today} — [${finding.severity}] ${finding.label}\n- File: ${rel}${finding.line ? `:${finding.line}` : ''}\n- OWASP: ${finding.owasp ?? 'N/A'}\n- Status: Deferred\n`

  // Insert under "## Active" section
  if (existing.includes('## Active')) {
    writeFileSync(debtPath, existing.replace('## Active', `## Active\n${entry}`))
  } else {
    writeFileSync(debtPath, existing + '\n' + entry)
  }
}

function openInEditor(filePath, line) {
  if (!filePath) return
  const editor = process.env.EDITOR || process.env.VISUAL || 'code'
  try {
    const target = line ? `${filePath}:${line}` : filePath
    // VS Code and many editors support file:line syntax
    execSync(`${editor} "${target}"`, { stdio: 'ignore' })
  } catch {
    console.log(chalk.dim(`      Path: ${filePath}${line ? `:${line}` : ''}`))
  }
}
