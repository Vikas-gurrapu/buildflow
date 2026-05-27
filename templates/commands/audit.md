---
name: buildflow-audit
description: Comprehensive OWASP Top 10 security audit
allowed-tools: Read, Bash, Grep, Glob
agent: security-auditor
---

# /buildflow-audit

Full security audit. The Security Auditor agent scans for OWASP Top 10 vulnerabilities.

## Flags
- `--quick` : Only recently changed files (~15K tokens)
- `--target <path>` : Specific file or directory
- `--category <A01-A10>` : Single OWASP category
- `--pre-ship` : Lightweight secrets + critical patterns (~10K)

## Phase 1: Secrets Scan
Search for:
- API keys (sk-, pk-, AKIA patterns)
- Hardcoded passwords/credentials
- Private keys (-----BEGIN)
- Database URLs with embedded credentials
- Env variables exposed to client (NEXT_PUBLIC_*SECRET etc.)

Skip: node_modules, test files, .env.example

## Phase 2: OWASP Top 10

### A01: Broken Access Control
- API routes without auth middleware
- Direct object references without ownership check
- Missing role verification on admin routes
- Overly permissive CORS (Access-Control-Allow-Origin: *)

### A02: Cryptographic Failures
- Hardcoded secrets in source code
- Weak hashing (MD5, SHA1 for passwords)
- Sensitive data in localStorage or console.log
- Missing httpOnly/secure flags on cookies

### A03: Injection
- SQL concatenation without parameterization
- eval() with user input
- exec()/spawn() with user-controlled values

### A04: Insecure Design
- Login endpoints without rate limiting
- File uploads without type/size validation
- Missing CSRF protection

### A05: Security Misconfiguration
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Debug mode enabled
- Error handlers exposing stack traces

### A06: Vulnerable Components
- npm audit findings (if package.json present)
- Known CVE packages
- Run language-appropriate dependency audit:
  ```bash
  npm audit --audit-level=high              # Node.js
  pip-audit -r requirements.txt 2>/dev/null  # Python
  ./mvnw dependency-check:check 2>/dev/null  # Java Maven (OWASP plugin)
  ./gradlew dependencyCheckAnalyze 2>/dev/null  # Gradle
  dotnet list package --vulnerable 2>/dev/null   # .NET
  bundle audit check --update 2>/dev/null    # Ruby
  composer audit 2>/dev/null                 # PHP
  cargo audit 2>/dev/null                    # Rust
  ```

### A07: Auth Failures
- Math.random() for tokens (not cryptographically secure)
- Session IDs in URLs
- Missing account lockout

### A08: Data Integrity
- Missing package-lock.json / yarn.lock

### A09: Security Logging
- No audit logging for auth failures
- PII in logs

### A10: SSRF
- Server-side URL fetching with user-controlled URLs

## Phase 2b: Container Security Scan (only if Docker was initialized)

Run this section only when `MEMORY.md -> container_runtime: docker` was set by `/buildflow-docker`.
If Docker was not initialized through `/buildflow-docker`, skip container scanning silently.

Check if `Dockerfile` exists. If yes, and if a built image exists:

```bash
# Check if image exists
docker images [app_name]:latest --format "{{.Repository}}:{{.Tag}}" 2>/dev/null

# Scan with Docker Scout (preferred if available)
docker scout cves [app_name]:latest --format table 2>/dev/null

# Fallback: Trivy
trivy image --severity HIGH,CRITICAL --format table [app_name]:latest 2>/dev/null
```

If no image is built yet: note "⚠ Docker image not built — run `/buildflow-docker build` then `/buildflow-audit` to scan the container."

**Container findings feed into the main report under A06 (Vulnerable Components).**

Check Dockerfile itself for common misconfigurations:
- Running as root (`USER` instruction absent) → HIGH
- Secrets passed as `ENV` or `ARG` build args → CRITICAL
- Using `latest` tag for base image → MEDIUM (non-reproducible builds)
- Exposing unnecessary ports → LOW
- Missing `HEALTHCHECK` instruction → LOW

## Phase 3: Generate Report

Write to `.buildflow/phases/[N]/audit-[date].md`:

```
# Security Audit Report

## Summary
🔴 Critical: X  🟡 High: Y  🟠 Medium: Z  🔵 Low: N

Ship Recommendation: [Safe / Fix Critical First / Do Not Ship]

## Critical Findings
### [C1] [Issue] - [file:line]
OWASP: [category]
Risk: [what could happen]
Fix: [concrete code change]

## [Other severities...]

## Positive Practices Found
[What's done well]

## Dependencies
[CVE status]
```

## Phase 4: Update Memory
```yaml
last_audit_date: [today]
critical_findings: X
ship_safe: true/false
```

## Severity Definitions
- 🔴 Critical: Direct path to breach, fix immediately
- 🟡 High: Significant risk, fix this week
- 🟠 Medium: Moderate risk, fix this sprint
- 🔵 Low: Minor, fix when nearby

## Token cost report (print at end of audit)

Measure actual cost before printing:
1. Sum character counts of all files scanned ÷ 4 = input tokens
2. Estimate output ÷ 4 = output tokens
3. Update `STATE.md → session_tokens_used`

Default output (minimal):
```
Audit complete — [N] critical · [N] high · [N] medium · ship_safe: [yes/no]
Session: ~[N]K tokens
```

Verbose (only if `verbose_context: true`):
```
Token Cost — /buildflow-audit
──────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-ship
   Why:  Audit passed — all gates clear, ready to ship
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If critical/high findings: `→ Next: fix [finding] in [file], then re-run /buildflow-audit`.

## Token Budget
- Full audit: ~30-40K
- Quick audit: ~15K
- Pre-ship: ~10K
