---
name: buildflow-audit
max_context_kb: 40
model_tier: security
description: Deep security audit — threat model, attack surface mapping, parallel specialist scan, find-fix-verify loop
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
agent: security-auditor
---

# /buildflow-audit

Deep security audit that goes beyond OWASP Top 10 pattern matching. Runs the complete find → fix → verify loop: threat model the system, map the attack surface, scan with parallel specialists, produce a prioritized fix plan with re-verification tests, then confirm fixes actually closed the findings.

## Flags
- `--quick` : Recently changed files only — OWASP patterns + secrets (~15K tokens, skips threat model)
- `--target <path>` : Scope to a specific file or directory
- `--pre-ship` : Lightweight gate — secrets + critical patterns only (~10K), called by ship
- `--verify` : Re-verification pass — re-scan only files where prior findings were reported, mark each FIXED/PARTIAL/STILL PRESENT
- `--deep` : Full 6-phase audit (default when no flag given)

## Mode Selection
- `--pre-ship` or `--quick` → run Phase 2 only (fast OWASP + secrets), skip threat model and specialists
- `--verify` → run Phase 5 only (re-verification against existing findings file)
- Default / `--deep` → run all phases 0–4, then offer `--verify` after fixes

---

## Phase 0: Threat Model

Build the mental model of what can go wrong before looking for specific bugs. Write `.buildflow/epics/[epic]/THREAT-MODEL.md` (or `.buildflow/THREAT-MODEL.md` if no active epic).

**Map trust boundaries** — where does data cross from less-trusted to more-trusted?
- Client → Server (all user input)
- Server → Database (query construction)
- Server → External APIs (outbound data, secrets)
- Webhook → Server (inbound from third parties)
- File upload → Storage/Processing

**Identify assets** — what's worth stealing or breaking?
- Credentials (passwords, tokens, API keys, session IDs)
- PII (emails, names, addresses, payment info, health data)
- Financial data (transactions, balances, payment methods)
- Business data (proprietary content, internal config)

**List entry points** — every way data enters the system:
```bash
# Routes / endpoints
grep -rn "app\.\(get\|post\|put\|patch\|delete\)\|@\(Get\|Post\|Put\|Delete\)\|router\.\|@app.route" src/ --include="*.ts" --include="*.js" --include="*.py" 2>/dev/null | head -40
# Webhooks
grep -rn "webhook\|/hooks/\|stripe.webhooks\|verifySignature" src/ 2>/dev/null | head -20
# File inputs
grep -rn "multer\|upload\|multipart\|FormData\|req.files" src/ 2>/dev/null | head -15
# Env vars consumed
grep -rn "process.env\|os.environ\|ENV\[" src/ 2>/dev/null | head -30
```

**Identify threat actors** and what each can attempt:
- Anonymous user — unauthenticated endpoints, enumeration, brute force
- Authenticated user — IDOR, privilege escalation, accessing others' data
- Admin — audit log tampering, abuse of privileged operations
- External service — webhook spoofing, malicious payloads
- Supply chain — compromised dependency

**Write THREAT-MODEL.md:**
```markdown
# Threat Model — [app] — [date]

## Trust Boundaries
[boundary] → [boundary]: [what crosses, validation point]

## Assets
| Asset | Location | Sensitivity | Protection |
|-------|----------|-------------|------------|
| [asset] | [where] | CRITICAL/HIGH/MED | [current protection] |

## Entry Points
| Entry | Auth Required | Threat Actor | Risk |
|-------|---------------|--------------|------|
| POST /api/... | yes/no | [actor] | [what could go wrong] |

## Priority Threats (ranked)
1. [threat] — [asset at risk] — [likelihood × impact]
```

Skip Phase 0 for `--quick` and `--pre-ship`.

---

## Phase 1: Attack Surface Mapping

Enumerate the concrete surface to scan — derived from the threat model.

- **Exposed endpoints**: every route, classified authenticated vs unauthenticated
- **Data inputs**: forms, query params, headers, file uploads, webhook payloads
- **Auth flows**: login, registration, token refresh, password reset, OAuth callback, logout
- **Admin surfaces**: admin-only routes, privileged operations, impersonation
- **Third-party integrations**: every outbound call, every SDK, every secret used

Produce an attack surface inventory — this scopes Phases 2 and 3 so specialists don't waste effort on non-surface code.

---

## Phase 2: Deep Vulnerability Scan

Extends OWASP Top 10 with business logic, data flow, supply chain, and configuration analysis.

### 2a — Secrets (beyond hardcoded)
```bash
grep -rnE "sk-[a-zA-Z0-9]{20,}|pk_live_|AKIA[0-9A-Z]{16}|-----BEGIN" src/ 2>/dev/null | head -20
```
- Hardcoded API keys, passwords, private keys
- Secrets in env vars exposed to client (`NEXT_PUBLIC_*SECRET`, `VITE_*KEY`)
- Secrets leaked in logs (`console.log(token)`, `logger.info(apiKey)`)
- Secrets in error messages returned to client
Skip: node_modules, test fixtures, .env.example

### 2b — OWASP Top 10
- **A01 Access Control**: routes without auth middleware, IDOR (object refs without ownership check), missing role checks, permissive CORS (`Allow-Origin: *`)
- **A02 Crypto**: weak hashing (MD5/SHA1 for passwords), sensitive data in localStorage, missing httpOnly/secure cookie flags
- **A03 Injection**: SQL concatenation, `eval()`/`exec()`/`spawn()` with user input, template injection, NoSQL injection
- **A04 Insecure Design**: login without rate limiting, file upload without type/size validation, missing CSRF
- **A05 Misconfig**: missing security headers (CSP, HSTS, X-Frame-Options), debug mode on, stack traces in errors
- **A06 Vulnerable Components**: see 2d
- **A07 Auth Failures**: `Math.random()` for tokens, session IDs in URLs, no account lockout
- **A08 Data Integrity**: missing lockfile, unsigned updates
- **A09 Logging**: no audit log for auth failures, PII in logs
- **A10 SSRF**: server-side fetch with user-controlled URLs

### 2c — Business Logic (beyond OWASP)
- **Race conditions**: check-then-act without locking (double-spend, double-submit)
- **IDOR**: every `findById(req.params.id)` without `AND owner = req.user.id`
- **Privilege escalation paths**: can a user grant themselves a role? modify their own permissions?
- **State machine bypass**: can an order skip from "created" to "shipped" without "paid"?
- **Negative/overflow**: quantity = -1, price manipulation, integer overflow on money

### 2d — Dependency & Supply Chain
```bash
npm audit --audit-level=high 2>/dev/null         # Node
pip-audit -r requirements.txt 2>/dev/null         # Python
./mvnw dependency-check:check 2>/dev/null          # Java Maven
dotnet list package --vulnerable 2>/dev/null       # .NET
bundle audit check --update 2>/dev/null            # Ruby
composer audit 2>/dev/null                         # PHP
cargo audit 2>/dev/null                            # Rust
```
Beyond CVEs:
- **Abandoned packages**: no commits in 12+ months (check last publish date)
- **License risk**: GPL/AGPL in a proprietary project, missing licenses
- **Supply chain**: typosquatting (package name close to a popular one), recently transferred ownership, install scripts that run network calls

### 2e — Configuration
- TLS version (no TLS 1.0/1.1), cipher suites
- Cookie flags: httpOnly, secure, sameSite
- Security headers present and correct
- CORS policy: specific origins, not wildcard
- CSP: present, no `unsafe-inline`/`unsafe-eval`

### 2f — Data Flow
- Trace each PII field from entry → storage → output
- Is it encrypted at rest? In transit? Logged anywhere?
- Does it appear in error responses, analytics, or third-party calls?

### Container scan (only if `MEMORY.md → container_runtime: docker`)
```bash
docker scout cves [app_name]:latest --format table 2>/dev/null
trivy image --severity HIGH,CRITICAL [app_name]:latest 2>/dev/null
```
Dockerfile checks: running as root (no USER), secrets in ENV/ARG (CRITICAL), `latest` base tag, unnecessary exposed ports, missing HEALTHCHECK.

Skip Phases 2c/2f for `--quick`.

---

## Phase 3: Parallel Specialist Scan

Spawn 4 security specialists simultaneously — each goes deep on one domain with a scoped context packet. This catches issues a single-pass scan misses.

**Shared preamble (pass to each specialist):**
```
app_name: [from MEMORY.md]
threat_model: [priority threats from THREAT-MODEL.md]
attack_surface: [entry point inventory from Phase 1]
```

**Claude Code** — spawn all 4 in one response (security tier — use strongest model if model_routing.security_tasks is set):
```
Agent({ description: "SA-1: Auth & Access Control", model: [from model_routing.security_tasks if set], prompt: "[shared preamble]\nDeep-dive authentication and authorization. For every endpoint in the attack surface: is auth enforced? Is the ownership check present (IDOR)? Can roles be escalated? Are tokens cryptographically secure? Is there account lockout and rate limiting? Read: auth middleware, route handlers, session/token logic. Output findings with file:line, attack scenario, severity." })
Agent({ description: "SA-2: Data Exposure & PII", model: [...], prompt: "[shared preamble]\nTrace every PII/sensitive field from entry to storage to output. Is it encrypted at rest and in transit? Logged anywhere? Leaked in error responses or to third parties? Check localStorage, console.log, error handlers, analytics calls. Output each exposure with the data path and severity." })
Agent({ description: "SA-3: Dependency & Supply Chain", model: [...], prompt: "[shared preamble]\nRun dependency audit. Identify: known CVEs (high/critical), abandoned packages (no release 12+ months), license conflicts, supply-chain risks (typosquats, suspicious install scripts). Output each with package@version, risk type, severity, remediation." })
Agent({ description: "SA-4: Business Logic & State", model: [...], prompt: "[shared preamble]\nAnalyze business logic flaws: race conditions (check-then-act without locks), state machine bypass (skipping required states), price/quantity manipulation, negative values, integer overflow on money/counts. Trace critical flows (payment, ordering, permissions). Output each with the exploit scenario and severity." })
```

**Gemini CLI / Codex CLI / Cursor** — print shared preamble once, then sequential:
`=== SA-1: Auth & Access Control START ===` → ... → `=== END ===` (repeat per specialist)

Synthesize all 4 outputs into the unified findings list. Deduplicate overlaps (e.g. SA-1 and SA-4 may both flag the same endpoint).

Skip Phase 3 for `--quick` and `--pre-ship`.

---

## Phase 4: Prioritized Fix Plan

Write `.buildflow/epics/[epic]/SECURITY-FINDINGS.md`. Every finding includes attack scenario, exact fix, and a re-verification test (so Phase 5 can confirm the fix).

```markdown
# Security Findings — [app] — [date]
**Audit type:** deep  **Specialists:** 4  **Threat model:** THREAT-MODEL.md

## Summary
🔴 Critical: X  🟡 High: Y  🟠 Medium: Z  🔵 Low: N
Ship Recommendation: [Safe / Fix Critical First / Do Not Ship]

## CRITICAL (fix before any ship)
### [C1] IDOR on GET /api/users/:id
**Source:** SA-1  **File:** src/routes/users.ts:42  **OWASP:** A01
**Attack:** Authenticated user changes :id to read any user's profile + PII
**Fix:** Add ownership check — `WHERE id = :id AND id = req.user.id`, or 403 if not owner/admin
**Effort:** XS (15 min)
**Re-verify:** As user A, `GET /api/users/[user-B-id]` must return 403 (not 200)

## HIGH (fix this sprint)
### [H1] JWT not validated on WebSocket upgrade
**Source:** SA-1  **File:** src/ws/server.ts:18
**Attack:** Anonymous client opens WS connection, receives broadcasts meant for authed users
**Fix:** Verify JWT in the upgrade handler before accepting the connection
**Effort:** S (45 min)
**Re-verify:** WS connection without valid token must be rejected with 401

## MEDIUM / LOW
[same format]

## Positive Practices Found
[what's done well — reinforces good patterns]
```

Update MEMORY.md:
```yaml
last_audit_date: [today]
last_audit_type: deep
critical_findings: X
high_findings: Y
ship_safe: true/false
findings_file: .buildflow/epics/[epic]/SECURITY-FINDINGS.md
```

---

## Phase 5: Fix Verification Loop (`--verify`)

The "fro" of find-fix-verify. Run after the developer has applied fixes from SECURITY-FINDINGS.md.

1. Read `SECURITY-FINDINGS.md` — load every finding and its re-verification test
2. For each finding, re-scan **only** the file/endpoint named in the finding (not a full re-audit)
3. Run the re-verification test described in the finding
4. Classify each:
   - **FIXED** ✓ — re-verify test passes, vulnerability closed
   - **PARTIAL** ⚠ — partially addressed (e.g. fix applied to one endpoint but not a sibling)
   - **STILL PRESENT** ✗ — re-verify test still fails

**Write verification report** (append to SECURITY-FINDINGS.md):
```markdown
## Verification — [date]
[C1] IDOR on /api/users/:id          FIXED ✓
[H1] JWT WebSocket validation        STILL PRESENT ✗ — handler still accepts unauthed
[H2] Missing rate limiting           PARTIAL ⚠ — login fixed, /register still open

Residual risk: 1 HIGH, 1 PARTIAL
Cleared to ship: NO — resolve [H1] and [H2] before shipping
```

If all CRITICAL and HIGH findings are FIXED: "✓ Cleared to ship — all critical/high findings resolved."
If any remain: list them, block ship recommendation.

---

## Severity Definitions
- 🔴 Critical: Direct path to breach — fix immediately, blocks ship
- 🟡 High: Significant risk — fix before ship
- 🟠 Medium: Moderate risk — fix this sprint
- 🔵 Low: Minor — fix when nearby

---

## Guided Next Step

After a deep audit with findings:
```
──────────────────────────────────────────────────
→ Next:  Fix CRITICAL findings in SECURITY-FINDINGS.md, then /buildflow-audit --verify
   Why:  [N] critical findings block ship — fix then re-verify to confirm closure
──────────────────────────────────────────────────
```

After `--verify` with all clear:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-ship
   Why:  All critical/high findings verified FIXED — security gate clear
──────────────────────────────────────────────────
```

After a clean audit (no findings):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-ship
   Why:  Audit clean — no critical or high findings
──────────────────────────────────────────────────
```
