import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs'
import { join, relative, resolve } from 'path'

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
  },
  {
    pattern: /eval\s*\(/g,
    label: 'eval() usage',
    severity: 'HIGH',
    owasp: 'A03',
  },
  {
    pattern: /exec\s*\(\s*[`'"]\s*.*?\$\{|execSync\s*\(\s*[`'"]\s*.*?\$\{/g,
    label: 'Command injection risk',
    severity: 'CRITICAL',
    owasp: 'A03',
  },
  {
    pattern: /Math\.random\s*\(\)/g,
    label: 'Math.random() used for tokens (not cryptographically secure)',
    severity: 'HIGH',
    owasp: 'A07',
  },
  {
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|key|user)[^)]*\)/gi,
    label: 'Sensitive data may be logged',
    severity: 'MEDIUM',
    owasp: 'A09',
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
          })
        }
      }
    }
  }

  for (const { pattern, label, severity, owasp } of VULN_PATTERNS) {
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
        })
      }
    }
  }

  return findings
}

export async function run(opts = {}) {
  const cwd = process.cwd()
  const base = join(cwd, '.buildflow')

  if (!existsSync(base)) {
    console.log(chalk.yellow('\n  BuildFlow not initialized. Run: npx buildflow-dev init\n'))
    return
  }

  if (opts.report) {
    const reportsDir = join(base, 'security', 'reports')
    if (!existsSync(reportsDir)) {
      console.log(chalk.dim('\n  No reports yet. Run: buildflow audit\n'))
      return
    }
    const reports = readdirSync(reportsDir).filter(f => f.endsWith('.md')).sort().reverse()
    if (reports.length === 0) {
      console.log(chalk.dim('\n  No reports yet.\n'))
      return
    }
    console.log('\n' + readFileSync(join(reportsDir, reports[0]), 'utf8'))
    return
  }

  console.log('\n' + chalk.bold.white('  BuildFlow — Security Audit\n'))

  const target = opts.target ? resolve(opts.target) : cwd
  const spinner = ora('Scanning files...').start()

  const allFindings = []
  let fileCount = 0

  for (const filePath of walkFiles(target)) {
    fileCount++
    allFindings.push(...scanFile(filePath))
  }

  spinner.stop()

  const critical = allFindings.filter(f => f.severity === 'CRITICAL')
  const high     = allFindings.filter(f => f.severity === 'HIGH')
  const medium   = allFindings.filter(f => f.severity === 'MEDIUM')

  console.log(chalk.dim(`  Scanned ${fileCount} files\n`))

  const severityLine = [
    critical.length > 0 ? chalk.red(`  🔴 ${critical.length} critical`)    : chalk.dim('  🟤 0 critical'),
    high.length > 0     ? chalk.yellow(`  🟡 ${high.length} high`)          : chalk.dim('  ○ 0 high'),
    medium.length > 0   ? chalk.yellow(`  🟠 ${medium.length} medium`)      : chalk.dim('  ○ 0 medium'),
  ].join('   ')
  console.log(severityLine + '\n')

  if (allFindings.length === 0) {
    console.log(chalk.green('  ✓ No issues found in quick scan.\n'))
    console.log(chalk.dim('  Note: This is a pattern-based scan. For full OWASP analysis,'))
    console.log(chalk.dim('  run /buildflow-audit inside your AI tool.\n'))
    return
  }

  const printGroup = (findings, icon, color) => {
    for (const f of findings) {
      const rel = relative(cwd, f.file)
      console.log(color(`  ${icon} [${f.severity}] ${f.label}`))
      console.log(chalk.dim(`      File: ${rel}:${f.line}`))
      console.log(chalk.dim(`      Code: ${f.snippet}`))
      if (f.owasp) console.log(chalk.dim(`      OWASP: ${f.owasp}`))
      console.log('')
    }
  }

  if (critical.length > 0) {
    console.log(chalk.bold.red('  ── Critical ──────────────────────────\n'))
    printGroup(critical, '🔴', chalk.red)
  }
  if (high.length > 0) {
    console.log(chalk.bold.yellow('  ── High ──────────────────────────────\n'))
    printGroup(high, '🟡', chalk.yellow)
  }
  if (medium.length > 0) {
    console.log(chalk.bold.yellow('  ── Medium ────────────────────────────\n'))
    printGroup(medium, '🟠', chalk.yellow)
  }

  const reportsDir = join(base, 'security', 'reports')
  mkdirSync(reportsDir, { recursive: true })
  const reportDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1)
  const reportPath = join(reportsDir, `audit-${reportDate}.md`)

  const reportContent = `# Security Audit Report
Date: ${new Date().toISOString().split('T')[0]}
Scanner: buildflow-dev CLI (pattern scan)
Files scanned: ${fileCount}

## Summary
Critical: ${critical.length}
High: ${high.length}
Medium: ${medium.length}

## Findings

${allFindings.map(f =>
    `### [${f.severity}] ${f.label}\n- File: ${relative(cwd, f.file)}:${f.line}\n- Code: \`${f.snippet}\`${f.owasp ? `\n- OWASP: ${f.owasp}` : ''}\n`
  ).join('\n')}

## Notes
This is a pattern-based CLI scan. For deep OWASP analysis, run /buildflow-audit in your AI tool.
`

  writeFileSync(reportPath, reportContent)

  console.log(chalk.bold('\n  Recommendations:\n'))
  if (critical.length > 0) {
    console.log(chalk.red('  Fix critical issues before committing or shipping.'))
  }
  console.log(chalk.dim(`\n  Report saved: ${relative(cwd, reportPath)}`))
  console.log(chalk.dim('  For full AI-powered analysis: /buildflow-audit in your AI tool\n'))

  if (critical.length > 0) process.exit(1)
}
