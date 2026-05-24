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

## Phase 3: Generate Report

Write to `.buildflow/security/reports/audit-[date].md`:

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

## Token Budget
- Full audit: ~30-40K
- Quick audit: ~15K
- Pre-ship: ~10K
