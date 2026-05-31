---
name: buildflow-observe
description: Audit and set up production observability — error tracking, structured logging, health checks, and APM
allowed-tools: Read, Write, Bash, Grep, Glob
agent: surgeon
---

# /buildflow-observe

Production observability setup. Audits the codebase for four pillars of production readiness — error tracking, structured logging, health endpoints, and APM/metrics — then generates the missing pieces. A production app with no observability is flying blind; this command eliminates that.

Run after `/buildflow-ship` or before `/buildflow-deploy production`.

## Usage
- `/buildflow-observe` — full audit across all four pillars + generate missing pieces
- `/buildflow-observe --audit` — audit only, report gaps, no code changes
- `/buildflow-observe --error-tracking` — error tracking pillar only
- `/buildflow-observe --logging` — structured logging pillar only
- `/buildflow-observe --health` — health check endpoint only
- `/buildflow-observe --apm` — APM and metrics pillar only
- `/buildflow-observe --stack <name>` — target a specific stack (e.g., `next`, `express`, `fastapi`, `rails`, `django`, `go`)

## Context Packet
- `.buildflow/MEMORY.md` — framework, language, stack
- `.buildflow/codebase/CODEBASE.md` — entry points, module layout, existing middleware
- `.buildflow/codebase/DEPENDENCIES.md` — existing external integrations, env vars
- `.buildflow/codebase/PATTERNS.md` — established code patterns to follow

---

## Step 1: Detect Stack and Current Observability

Scan for existing observability setup:

```bash
# Error tracking
grep -r "sentry\|bugsnag\|rollbar\|honeybadger\|datadog" package.json requirements.txt go.mod Gemfile 2>/dev/null | head -10
grep -r "Sentry\.init\|Bugsnag\.start\|captureException" src/ app/ 2>/dev/null | head -5

# Logging
grep -r "winston\|pino\|bunyan\|log4js\|structlog\|loguru\|zap\|zerolog\|slog" package.json requirements.txt go.mod 2>/dev/null | head -10
grep -r "console\.log\|print(\|fmt\.Print" src/ app/ 2>/dev/null | wc -l

# Health endpoints
grep -r "\/health\|\/ready\|\/ping\|\/livez\|\/readyz" src/ app/ 2>/dev/null | head -5

# APM / metrics
grep -r "opentelemetry\|datadog\|newrelic\|prometheus\|statsd" package.json requirements.txt go.mod 2>/dev/null | head -10
```

Print detection report:
```
Observability Audit
────────────────────────────────────────────────
Framework:       [Next.js / Express / FastAPI / Django / Rails / Go/Gin / ...]

Error tracking:  [Sentry detected / Bugsnag detected / ✗ MISSING]
Logging:         [Winston (structured) / pino / ✗ console.log only (N occurrences)]
Health endpoint: [/health found at src/... / ✗ MISSING]
APM / metrics:   [OpenTelemetry / DataDog / ✗ MISSING]

console.log occurrences in src/: [N] — should be replaced with structured logger
```

---

## Step 2: Error Tracking Pillar

### Audit
Check for:
- Error tracking SDK installed and initialized
- Uncaught exception handler configured
- Error context enrichment (user ID, request ID, environment)
- Source maps uploaded for production (JS/TS projects)
- PII scrubbing configured (no passwords or tokens in error reports)

### Generate (if missing)

Recommend the right SDK based on stack and framework:

| Stack | Recommendation |
|-------|---------------|
| Node.js / Next.js / Express | Sentry (`@sentry/node`, `@sentry/nextjs`) |
| Python / Django / FastAPI | Sentry (`sentry-sdk`) |
| Go | Sentry (`github.com/getsentry/sentry-go`) |
| Ruby / Rails | Sentry (`sentry-ruby`) |
| Any | Self-hosted: GlitchTip (Sentry-compatible, free) |

Generate initialization code matching the existing entry point pattern from PATTERNS.md:

**Next.js example:**
```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  beforeSend(event) {
    // Strip PII — never send passwords or tokens
    if (event.request?.data) {
      delete event.request.data.password
      delete event.request.data.token
    }
    return event
  },
})
```

Add required env vars to `.env.example`:
```
SENTRY_DSN=https://...@sentry.io/...
```

Add to DEPENDENCIES.md: new external service entry for error tracking.

---

## Step 3: Structured Logging Pillar

### Audit
Check for:
- Structured logger (JSON output) vs plain `console.log` / `print()`
- Log levels used correctly (debug / info / warn / error)
- Request ID / correlation ID in logs
- No secrets or PII in log statements (scan for `password`, `token`, `secret` in log calls)
- Log output goes to stdout (not file) for container environments

### Generate (if missing or console.log-only)

Recommend logger based on stack:

| Stack | Recommendation |
|-------|---------------|
| Node.js | pino (fastest) or winston |
| Next.js | pino with `pino-http` |
| Python | structlog or loguru |
| Go | `log/slog` (stdlib, Go 1.21+) or zerolog |
| Ruby | semantic_logger |

Generate a logger module that matches the project's module pattern:

**Node.js/pino example:**
```typescript
// src/lib/logger.ts
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty" },  // human-readable in dev
  }),
  redact: ["req.headers.authorization", "body.password", "body.token"],
  base: { service: process.env.SERVICE_NAME ?? "app", env: process.env.NODE_ENV },
})
```

Generate a codemod hint for replacing `console.log`:
```
Replace console.log with structured logger:
  console.log("msg", data)   →  logger.info({ ...data }, "msg")
  console.error("err", e)    →  logger.error({ err }, "msg")
  console.warn("msg")        →  logger.warn("msg")

Found [N] console.log occurrences. Replace the highest-traffic paths first:
  [top 5 files by occurrence count]
```

---

## Step 4: Health Check Endpoint Pillar

### Audit
Check for `/health`, `/ready`, `/ping`, `/livez`, `/readyz` routes.

### Generate (if missing)

Generate a health check endpoint appropriate for the framework and stack.

The health endpoint must:
- Return `200 OK` with `{"status": "ok"}` when healthy
- Return `503 Service Unavailable` when a dependency is down
- Check all critical dependencies (DB, cache, external APIs)
- **Never expose internal details** (no stack traces, no config values)
- Respond in < 500ms (use timeouts on dependency checks)

**Express/Node.js example:**
```typescript
// src/routes/health.ts
import { Router } from "express"
import { db } from "../db"

export const healthRouter = Router()

healthRouter.get("/health", async (req, res) => {
  const checks: Record<string, "ok" | "error"> = {}

  // Database check
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = "ok"
  } catch {
    checks.database = "error"
  }

  const healthy = Object.values(checks).every(v => v === "ok")
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks,
    uptime: process.uptime(),
  })
})

// Liveness probe — just confirms process is alive
healthRouter.get("/ready", (_req, res) => res.json({ status: "ok" }))
```

**FastAPI/Python example:**
```python
# app/routers/health.py
from fastapi import APIRouter, status
from sqlalchemy.exc import OperationalError
from app.database import get_db

router = APIRouter()

@router.get("/health")
async def health_check(db=Depends(get_db)):
    checks = {}
    try:
        db.execute("SELECT 1")
        checks["database"] = "ok"
    except OperationalError:
        checks["database"] = "error"

    healthy = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ok" if healthy else "degraded", "checks": checks},
    )
```

Wire the health router into the app entry point (matching the existing router registration pattern from PATTERNS.md).

---

## Step 5: APM and Metrics Pillar

### Audit
Check for:
- Request latency tracking
- Error rate tracking
- Custom business metrics (if ACs reference SLA or response time)
- Distributed tracing (if microservices or multiple services)

### Generate

For most projects, recommend **OpenTelemetry** (vendor-neutral, works with DataDog, Jaeger, Honeycomb, New Relic, Grafana):

**Node.js OpenTelemetry bootstrap:**
```typescript
// src/instrumentation.ts  (loaded via --require flag or Next.js instrumentation hook)
import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
```

Add required env vars:
```
OTEL_EXPORTER_OTLP_ENDPOINT=https://...
OTEL_SERVICE_NAME=your-app-name
```

For simpler setups (single service, no tracing needed): recommend **Prometheus** metrics endpoint:
```typescript
// src/routes/metrics.ts — expose /metrics for Prometheus scraping
import { register, collectDefaultMetrics } from "prom-client"
collectDefaultMetrics()
metricsRouter.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType)
  res.end(await register.metrics())
})
```

---

## Step 6: Write Observability Report

Use the **Write tool** to save to `.buildflow/OBSERVE.md`:

```markdown
# Observability Setup — [app name]
**Audited:** [timestamp]
**Framework:** [name]

## Status
| Pillar | Before | After |
|--------|--------|-------|
| Error tracking | [MISSING / partial] | [Sentry / SKIPPED] |
| Structured logging | [console.log / partial] | [pino / SKIPPED] |
| Health endpoint | [MISSING / /health exists] | [generated / SKIPPED] |
| APM / metrics | [MISSING / partial] | [OpenTelemetry / SKIPPED] |

## Files created/modified
[list]

## Required env vars added to .env.example
[list]

## Remaining manual steps
[anything that requires a third-party account, dashboard config, or infra change]

## console.log debt
[N] occurrences in [N] files — replace with logger.[level]() over time
Priority files: [top 3 by occurrence]
```

Print terminal summary:
```
Observability audit complete ✓
──────────────────────────────────────────────────
Error tracking:  [status]
Logging:         [status]
Health endpoint: [/health generated at src/routes/health.ts / already present]
APM:             [status]

Files written: [N]
Env vars added to .env.example: [N]

Next step: /buildflow-deploy staging
```
