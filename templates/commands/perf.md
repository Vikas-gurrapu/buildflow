---
name: buildflow-perf
description: Performance profiling — UI rendering, backend endpoints, and database queries
allowed-tools: Read, Write, Bash, Grep, Glob
agent: surgeon
---

# /buildflow-perf

Systematic performance investigation. Traces slowness to its root — whether it's a slow database query, a fat bundle, an unoptimized render, or a leaky endpoint. Fixes with minimum footprint.

## Usage
- `/buildflow-perf` — profile the whole stack (UI + backend + DB)
- `/buildflow-perf ui` — UI rendering performance only
- `/buildflow-perf backend` — backend endpoint performance only
- `/buildflow-perf db` — database query performance only
- `/buildflow-perf "slow checkout page"` — investigate a described bottleneck
- `/buildflow-perf --list` — show all active perf sessions
- `/buildflow-perf --continue` — resume the most recent active session
- `/buildflow-perf --continue PERF-002` — resume a specific session by reference
- `/buildflow-perf --cleanup` — archive resolved sessions older than 30 days

---

## Subcommand: --cleanup

When `--cleanup` is passed:

```bash
ls .buildflow/perf/PERF-*.md .buildflow/epics/*/perf/PERF-*.md 2>/dev/null
```

A session is stale when `progress: resolved` AND `updated` > 30 days ago. Show list and confirm before archiving to `.buildflow/perf/archive/`.

STOP after cleanup.

---

## Subcommand: --list

When `--list` is passed:

```bash
ls .buildflow/perf/PERF-*.md .buildflow/epics/*/perf/PERF-*.md 2>/dev/null
```

Display active and resolved sessions in two groups:

```
Active Perf Sessions
─────────────────────────────────────────────
  Ref       Location              Progress    Track    Date
  PERF-003  epics/2-pay/perf/     profiling   db       2026-05-28
            Issue: Checkout query takes 4s
            Next: analyze query plan for orders JOIN

  PERF-002  perf/                 fix-applied ui       2026-05-27
            Issue: LCP 6.2s on dashboard
            Next: verify bundle size after code-split

Resolved Sessions (resumable with explicit ref)
─────────────────────────────────────────────
  PERF-001  epics/1-auth/perf/    resolved    backend  2026-05-25
            Issue: /api/login 1.8s p95
─────────────────────────────────────────────
Resume with: /buildflow-perf --continue PERF-003
```

If no files: print "No perf sessions found. Run `/buildflow-perf [track]` to start one." and stop.

STOP after list.

---

## Subcommand: --continue

When `--continue` is passed:

**With a reference** (`--continue PERF-002`):
- Validate ref matches `^PERF-[0-9]+$`. If not, print "Invalid reference. Use format: PERF-001." and stop.
- Search `.buildflow/perf/` and `.buildflow/epics/*/perf/`. If not found, print "No session found: {ref}." and stop.
- Resolved sessions ARE resumable with explicit ref. Re-open with `progress: profiling` and print prior findings.

**Without a reference**:
- Find most recently modified active (non-resolved) session:
  ```bash
  ls -t .buildflow/perf/PERF-*.md .buildflow/epics/*/perf/PERF-*.md 2>/dev/null | xargs grep -l "^progress: profiling\|^progress: fix-applied\|^progress: measuring" 2>/dev/null | head -1
  ```
- If none: print "No active perf sessions. Run `/buildflow-perf --list`." and stop.

Print resume context:
```
Resuming: {ref}  [{file path}]
─────────────────────────────────────────────
Issue:      {issue description}
Track:      {ui / backend / db / full}
Progress:   {progress}
Findings:   {key metrics found so far}
Next step:  {next_step}
─────────────────────────────────────────────
```

Resume from step matching `progress`:
- `profiling` → Step 3 (measure baseline)
- `measuring` → Step 4 (identify bottleneck)
- `fix-applied` → Step 6 (verify improvement)

---

## Epic Resolution (resolve target folder before any file write)

Read `.buildflow/STATE.md`:
- If `current_epic` is absent, empty, or `none` → auto-assign to `.buildflow/perf/`
- If `current_epic` is set → ask once:
  ```
  Active epic: [current_epic]
  Is this perf session part of the active epic?
    [E] Yes — file under epics/[current_epic]/perf/
    [I] No  — independent session, file under perf/
  ```

---

## Folder Access Guard

Before reading any source file, check `path_permissions.[folder]` in `.buildflow/PREFERENCES.md`.

---

## Step 1: Identify the Track

Parse `$ARGUMENTS` for subcommands (--list, --continue, --cleanup) first.

Determine track from remaining arguments:
- `ui` → UI rendering track only
- `backend` → backend endpoint track only
- `db` → database query track only
- description or no args → run all three tracks and triage

If no track specified, ask ONE question:
```
What's slow?
  [U] UI / frontend — page load, render, bundle
  [B] Backend — API endpoints, response times
  [D] Database — queries, indexes, connection pool
  [A] All — profile the full stack
```

**File reading rule:** Read full function/module blocks around perf-sensitive code — not just the slow line. Use `offset`/`limit` to get at least 50 lines of surrounding context.

Hold slug in memory — no file I/O yet. Session file is created lazily only if investigation spans multiple passes.

Generate slug: lowercase description → hyphens → `^[a-z0-9][a-z0-9-]*$` → max 40 chars.

---

## Step 2: Load Context (minimal)

- `.buildflow/MEMORY.md` (framework, language only)
- `.buildflow/codebase/intel.json` if it exists (entry points, load-bearing files)
- Target file(s) if specified by user
- Do NOT load: specs, CODEBASE.md, PATTERNS.md — keep it fast

---

## Step 3: Measure Baseline

Establish current performance numbers before investigating.

### UI Track

**Bundle size:**
```bash
# JavaScript
npx bundlesize 2>/dev/null || ls -lh dist/*.js build/*.js public/*.js 2>/dev/null | sort -k5 -rh | head -10
# React bundle analysis
npx source-map-explorer dist/*.js 2>/dev/null || true
# Next.js
cat .next/build-manifest.json 2>/dev/null | head -30
# Vite
ls -lh dist/assets/*.js 2>/dev/null | sort -k5 -rh | head -10
```

**Web vitals (if Lighthouse or web-vitals available):**
```bash
npx lighthouse --output=json --chrome-flags="--headless" http://localhost:3000 2>/dev/null | grep -E '"lcp"|"cls"|"fcp"|"tbt"' | head -10 || true
```

**Render-blocking resources:** scan HTML entry point for synchronous `<script>` tags and non-deferred CSS.
```bash
grep -n "<script\|<link rel=\"stylesheet\"" index.html public/index.html 2>/dev/null | head -20
```

**Baseline UI metrics to record:**
| Metric | Current | Target |
|--------|---------|--------|
| JS bundle size (main) | | < 200KB gzipped |
| LCP | | < 2.5s |
| FCP | | < 1.8s |
| CLS | | < 0.1 |
| Render-blocking resources | | 0 |

### Backend Track

**Endpoint response times** (from logs or direct measurement):
```bash
# Express / Node
grep -E "GET|POST|PUT|DELETE" logs/access.log 2>/dev/null | awk '{print $NF, $7}' | sort -rn | head -20
# Next.js
grep "took" .next/server/pages-manifest.json 2>/dev/null | head -10
# Django
grep "duration" logs/django.log 2>/dev/null | sort -rn | head -20
# Check for slow endpoint patterns in code
grep -rn "await.*await\|Promise.all\|setTimeout\|setInterval" src/ --include="*.ts" --include="*.js" --include="*.py" | grep -v test | head -20
```

**Memory usage patterns:**
```bash
grep -rn "new Array\|new Map\|cache\|memoize\|WeakMap" src/ --include="*.ts" --include="*.js" | grep -v test | head -20
```

**Baseline backend metrics to record:**
| Endpoint | p50 | p95 | p99 | Target |
|----------|-----|-----|-----|--------|
| (from logs) | | | | < 200ms p95 |

### DB Track

**Slow query detection:**
```bash
# PostgreSQL slow query log
grep -E "duration: [0-9]{3,}" /var/log/postgresql/*.log 2>/dev/null | sort -t: -k3 -rn | head -20
# MySQL slow query log
grep -A2 "Query_time: [0-9]\+" /var/log/mysql/slow.log 2>/dev/null | head -30
# Prisma query logs in app code
grep -rn "console.log\|logger\." src/ --include="*.ts" | grep -i "query\|prisma\|db\." | head -10
# Find ORM queries in code
grep -rn "findMany\|findAll\|\.query\|\.execute\|SELECT\|db\." src/ --include="*.ts" --include="*.py" --include="*.go" | grep -v test | grep -v node_modules | head -30
```

**Missing index detection (schema analysis):**
```bash
# Prisma schema — columns used in WHERE/ORDER BY without @index
cat prisma/schema.prisma 2>/dev/null | grep -E "@@index|@index" | head -20
# Check for foreign key fields missing indexes
grep -rn "\.where\|\.filter\|ORDER BY\|findMany.*where" src/ --include="*.ts" --include="*.py" | grep -v test | head -20
```

**N+1 query detection:**
```bash
# Find loops that contain DB calls
grep -rn "for.*await\|forEach.*await\|\.map.*await\|for.*findMany\|for.*query" src/ --include="*.ts" --include="*.js" --include="*.py" | grep -v test | head -20
```

**Baseline DB metrics to record:**
| Query / Area | Avg duration | N+1 risk | Index missing |
|--------------|-------------|----------|---------------|
| | | | |

---

## Step 4: Identify Bottleneck

For each track being investigated, rank findings by impact:

**UI bottlenecks (in priority order):**
1. Bundle size > 200KB gzipped (main chunk)
2. No code splitting on route level
3. Missing lazy loading for images / heavy components
4. Synchronous render-blocking scripts in `<head>`
5. Hydration mismatch or excessive re-renders
6. Missing memoization on expensive computations (`useMemo`, `useCallback`, computed)
7. Unoptimized images (no WebP, no srcset, no lazy attribute)
8. Third-party scripts blocking paint (analytics, chat widgets)

**Backend bottlenecks (in priority order):**
1. Sequential `await` calls that could be `Promise.all`
2. Missing response caching on read-heavy endpoints
3. Unindexed DB queries inside request handlers
4. N+1 queries (DB call inside a loop)
5. Large payload — no pagination or field selection
6. Synchronous blocking operations on the event loop (Node)
7. Memory leak pattern — global cache without eviction
8. Missing connection pooling or pool size too small

**DB bottlenecks (in priority order):**
1. Full table scan (missing WHERE clause index)
2. N+1 — calling DB inside a loop instead of batch query
3. Missing index on foreign key or frequently filtered column
4. Returning all columns when only a few are needed (`SELECT *`)
5. Unoptimized JOIN — missing index on join column
6. Query in a transaction that holds locks too long
7. Connection pool exhaustion under load

Record the top 3 bottlenecks found per track with evidence (file:line).

---

## Step 5: Impact Check

Before applying any fix:
- How much improvement does this fix realistically deliver? (rough %)
- Will this fix affect other parts of the system?
- Is this a quick win (< 1h) or a deeper refactor?

Flag if investigation reveals a deeper architectural issue (e.g., no caching layer, ORM not configured for batch queries) — suggest escalating to `/buildflow-think` before fixing.

---

## Step 5b: Save Session (if multi-pass needed)

If profiling cannot complete in one pass, save a session file now. Resolve path via Epic Resolution step, then determine next sequence number.

Use Write tool (never heredoc):
```bash
mkdir -p .buildflow/perf
```

```markdown
---
progress: profiling
track: {ui / backend / db / full}
updated: {today}
next_step: "{what to investigate next}"
---

# Perf Session — [short description]
Date: [ISO datetime]
Epic: [current_epic or "none"]
Track: [ui / backend / db / full]
Status: OPEN

## Issue
[what was reported as slow and context]

## Baseline Metrics
[measurements from Step 3]

## Bottlenecks Found
[ranked list from Step 4]

## Fix Plan
[what to change and expected improvement]

## Fix Applied
none

## Verification
none

## Remaining Risk
[any lingering concerns]
```

Print: `Session saved: {path} — resume with /buildflow-perf --continue {ref}`

---

## Step 6: Apply Fix

Apply the minimal fix for the highest-impact bottleneck:

**UI fixes:**
- Code splitting: wrap heavy routes/components in `React.lazy()` + `Suspense`
- Lazy images: add `loading="lazy"` and `decoding="async"` attributes
- Defer non-critical scripts: add `defer` or `async` to `<script>` tags
- Memoization: wrap expensive pure computations in `useMemo`, pure components in `React.memo`
- Bundle pruning: replace heavy libraries with lighter alternatives (e.g. `date-fns` over `moment`)

**Backend fixes:**
- Parallelize sequential awaits: replace `a = await x; b = await y` with `[a,b] = await Promise.all([x,y])`
- Add response caching: wrap read-heavy handler with in-memory or Redis cache with TTL
- Remove N+1: replace loop+query with a single batch query and in-memory join
- Add pagination: inject `limit`/`offset` or cursor-based pagination where missing
- Fix memory leak: add max-size eviction to unbounded caches

**DB fixes:**
- Add missing index to schema (Prisma `@@index`, SQL `CREATE INDEX`, Django `db_index=True`)
- Batch N+1: replace `for` loop with `WHERE id IN (...)` or ORM `include`/`prefetch_related`
- Replace `SELECT *` with specific field selection
- Add `EXPLAIN ANALYZE` output as evidence before and after index addition

Minimum footprint — fix only the bottleneck, not surrounding code.

If a session file was created in Step 5b, update it: set `progress: fix-applied`, `next_step: verify improvement`, populate `## Fix Applied`.

---

## Step 7: Verify Improvement

Re-run the same measurements from Step 3 for the affected track. Compare before/after:

```
Performance Improvement
───────────────────────────────────
UI — JS bundle (main):   420KB → 180KB  (−57%)
UI — LCP:                6.2s  → 2.1s   (−66%)

Backend — /api/checkout p95:  1800ms → 210ms  (−88%)

DB — orders JOIN query:  3900ms → 45ms   (−99%)
     (missing index on orders.user_id added)
───────────────────────────────────
```

If improvement is < 20% of expected: investigate further — the bottleneck may not be the root cause.

On verification pass, update session file: `progress: resolved`, populate `## Verification`.

---

## Step 8: Prevent Recurrence

- Add a performance budget check if one doesn't exist (bundle size, endpoint timeout)
- Log the finding in `.buildflow/epics/[epic]/DEBT.md` if it reveals a systemic pattern
- If a DB index was added, note it in the migration file or schema comment

---

## Final Step: Save Perf Record

**If a session file was already created**: update it in place with the final record. Do not create a new file.

**If no session file exists** (single-pass success): use Write tool to create the record at the path resolved by Epic Resolution:
- Active epic: `.buildflow/epics/[current_epic]/perf/PERF-[sequence].md`
- No active epic: `.buildflow/perf/PERF-[sequence].md`

Increment sequence from existing files in that folder, starting at 001. Write to disk.

Single-pass perf sessions that resolve in one pass skip file I/O until this final step.

```markdown
---
progress: resolved
track: {ui / backend / db / full}
updated: [today]
next_step: ""
---

# Perf Session — [short description]
Date: [ISO datetime]
Epic: [current_epic or "none"]
Track: [ui / backend / db / full]
Status: RESOLVED

## Issue
[what was reported as slow]

## Baseline Metrics
[measurements before fix]

## Bottlenecks Found
1. [highest impact — file:line]
2. [second — file:line]
3. [third — file:line]

## Fix Applied
[what changed and why]

## Files Changed
- [path] — [what changed]

## Verification
[before/after measurements with % improvement]

## Remaining Risk
[any lingering concerns or NONE]
```

---

## Token cost report (print at end of perf)

Measure actual cost before printing:
1. Estimate input tokens per file: `Math.ceil((chars / (baseDivisor − densityPenalty)) × 1.05)` — prose/md=4.0, standard code=3.5, Go/Rust/C=3.2, JSON/YAML=3.2, minified=2.7; densityPenalty: symbol-dense=0.3, normal=0.1, sparse=0.0. Sum all files = input tokens.
2. Estimate output tokens (mixed command): `Math.ceil((outputChars / 3.7) × 1.05)` = output tokens
3. Update `STATE.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Perf session complete — track: [ui/backend/db/full] · improvement: [N]%
Session: ~[N]K tokens
```

If a session file was created: append `Session saved: {path}`

Verbose output (only if `verbose_context: true` in PREFERENCES.md):
```
Token Cost — /buildflow-perf
──────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Perf fix applied — verify no regressions before shipping
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If bottleneck reveals a systemic issue (no caching layer, ORM misconfiguration): `→ Next: /buildflow-think "performance architecture"` (research before fixing).
If improvement goal not met after fix: `→ Next: /buildflow-perf --continue {ref}` (resume with a deeper hypothesis).
If perf session traced to a spec gap (no perf AC defined): `→ Next: /buildflow-spec --review` (add perf ACs before next build).

## Token Budget: ~20K
