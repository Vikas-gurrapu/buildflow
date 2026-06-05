---
name: buildflow-start-epic
max_context_kb: 20
description: Start a project with BuildFlow's Strategist agent
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-start-epic

Begin your project. Works for both greenfield and existing codebases.

## Context Packet (load only these)
- `.buildflow/MEMORY.md`
- `.buildflow/epics/[epic]/STATE.md` (if current epic exists — compact resume status and next command)
- `.buildflow/PREFERENCES.md`

Only load the current epic `STATE.md`, not full epic specs/plans/reports.

Do NOT load: specs, epics, codebase files — this is vision only.

## Usage
- `/buildflow-start-epic` — begin or continue a session
- `/buildflow-start-epic --template <name>` — bootstrap an epic from a pre-built template

**Available templates:**

| Template | Domain | Pre-built focus areas |
|----------|--------|-----------------------|
| `auth` | Authentication | Login, register, password reset, JWT, sessions, OAuth |
| `payments` | Payments | Checkout, Stripe/provider integration, receipts, refunds, webhooks |
| `crud` | Data management | List + filters, create, read, update, delete, pagination, search |
| `notifications` | Notifications | Email, in-app alerts, push, preferences, read/unread state |
| `api` | REST API layer | Endpoints, auth middleware, rate limiting, versioning, error handling |
| `dashboard` | Analytics UI | Data visualization, filters, date ranges, export, real-time updates |
| `mobile` | Mobile app | Navigation, push notifications, offline sync, deep links, biometrics |
| `search` | Search & discovery | Full-text search, faceted filters, autocomplete, ranking, analytics |
| `file-upload` | File/media management | Upload, processing pipeline, CDN delivery, previews, retry logic |
| `realtime` | Live data / collaboration | WebSockets/SSE, presence, optimistic updates, reconnection |
| `admin` | Admin panel | RBAC, audit logs, bulk operations, user management, reporting |
| `onboarding` | User onboarding | Multi-step wizard, progress persistence, email sequences, completion |

When `--template <name>` is passed:

1. Validate the template name. If unknown: list available templates and stop.
2. Ask 2–3 template-specific clarifying questions (listed per template below) — do NOT ask the full vision questionnaire.
3. Pre-populate `.buildflow/VISION.md` with the template's domain description and the app name from MEMORY.md.
4. Write pre-locked decisions to `.buildflow/epics/[epic]/CONTEXT.md` — these will not be re-debated during spec.
5. Print the template's pre-built spec outline so the user can review and adjust before speccing.
6. Update MEMORY.md with `current_epic: none`, `spec_status: none`.
7. Go directly to Step 4 (Guided Next Step) — suggest `/buildflow-spec` as the next command.

---

### Template: `auth`

**Questions:** (skip vision questionnaire, ask only these)
1. OAuth providers needed? (Google / GitHub / Microsoft / None)
2. Session storage: JWT stateless or server-side sessions?

**Outline:**
```
Template: auth
─────────────────────────────────────────────
Pre-built focus areas:
  • User registration with email verification
  • Login with JWT + refresh token rotation
  • Password reset via email link
  • OAuth 2.0 (Google / GitHub)
  • Session management + secure logout
  • Rate limiting on auth endpoints

AC hints:
  AC-001  User can register with email + password
  AC-002  Email verification required before first login
  AC-003  Login returns JWT (15min) + refresh token (7d)
  AC-004  Refresh token rotation on every use
  AC-005  Password reset link expires in 1 hour
  AC-006  OAuth login creates or links existing account
  AC-007  Failed login rate-limited after 5 attempts

Wave order: DB schema → auth service → routes → email flow → OAuth → rate limiting → E2E tests

Pre-locked decisions:
  • Password hashing: bcrypt (cost factor 12)
  • JWT: short-lived access + rotating refresh tokens
  • Never store plaintext passwords or tokens
─────────────────────────────────────────────
```

---

### Template: `payments`

**Questions:**
1. Payment provider? (Stripe / Paddle / Braintree / Other)
2. Subscription or one-time payments?
3. Need refund/dispute handling?

**Outline:**
```
Template: payments
─────────────────────────────────────────────
Pre-built focus areas:
  • Checkout flow with payment intent
  • Webhook handling (payment success, failure, refund)
  • Receipt generation and email delivery
  • Subscription lifecycle (create, upgrade, cancel)
  • Refund processing
  • Idempotency on all payment operations

AC hints:
  AC-001  User can complete checkout with valid card
  AC-002  Failed payment shows specific error (not generic)
  AC-003  Webhook verifies Stripe signature before processing
  AC-004  Receipt email sent within 30s of successful payment
  AC-005  Subscription cancels at period end, not immediately
  AC-006  Duplicate webhook events are idempotent

Wave order: DB schema → payment service → webhook handler → checkout UI → receipt email → subscription management

Pre-locked decisions:
  • Webhooks verified via provider signature — no exceptions
  • Idempotency keys on all payment API calls
  • Never log full card numbers or CVVs
─────────────────────────────────────────────
```

---

### Template: `crud`

**Questions:**
1. What entity is this CRUD for? (e.g., "products", "articles", "tasks")
2. Need soft delete or hard delete?
3. Who can perform each operation? (owner-only / admin / any authenticated)

**Outline:**
```
Template: crud — [entity]
─────────────────────────────────────────────
Pre-built focus areas:
  • List with pagination, sorting, and filtering
  • Create with validation
  • Read (single item) with ownership check
  • Update (full + partial)
  • Delete with confirmation
  • Search within entity

AC hints:
  AC-001  List returns paginated results (default 20 per page)
  AC-002  Invalid filter values return 400, not 500
  AC-003  Create validates all required fields before DB write
  AC-004  Read returns 404 for non-existent ID
  AC-005  Update returns 403 if user does not own the resource
  AC-006  Soft delete sets deleted_at, hard delete removes record

Wave order: DB schema → repository layer → service layer → API routes → pagination/filtering → E2E tests

Pre-locked decisions:
  • Ownership checks on every read/update/delete
  • Pagination via cursor or offset — decide before wave 1
─────────────────────────────────────────────
```

---

### Template: `notifications`

**Questions:**
1. Channels needed? (Email / In-app / Push / SMS — select all that apply)
2. Need user notification preferences (opt-in/opt-out per type)?

**Outline:**
```
Template: notifications
─────────────────────────────────────────────
Pre-built focus areas:
  • In-app notification feed (read/unread state)
  • Email notifications (transactional)
  • Push notifications (FCM/APNs)
  • User preferences (opt-in/opt-out per type)
  • Notification batching (digest mode)
  • Mark all as read

AC hints:
  AC-001  Unread count updates without page refresh
  AC-002  User can opt out of each notification type independently
  AC-003  Email notifications respect user's unsubscribe preference
  AC-004  Push notification delivered within 5s of trigger event
  AC-005  Marking notification as read is idempotent

Wave order: DB schema → notification service → in-app feed → email integration → push setup → preferences UI

Pre-locked decisions:
  • Soft-delete notifications (never hard-delete — audit trail)
  • Email unsubscribe must be one-click (CAN-SPAM compliance)
─────────────────────────────────────────────
```

---

### Template: `api`

**Questions:**
1. Auth mechanism? (JWT Bearer / API Key / OAuth2)
2. Need versioning? (v1/v2 URL prefix or header-based)
3. Expected consumers? (internal frontend / third-party / both)

**Outline:**
```
Template: api
─────────────────────────────────────────────
Pre-built focus areas:
  • Endpoint structure with versioning
  • Auth middleware (JWT / API key)
  • Rate limiting per consumer
  • Consistent error response format
  • Request validation (input schemas)
  • OpenAPI spec generation

AC hints:
  AC-001  All endpoints return consistent error format { code, message, field }
  AC-002  Unauthenticated requests return 401, not 403
  AC-003  Rate limit exceeded returns 429 with Retry-After header
  AC-004  Invalid request body returns 400 with field-level errors
  AC-005  API version in URL — old version returns deprecation warning header

Wave order: Auth middleware → error handler → rate limiter → base router → endpoint implementations → OpenAPI spec

Pre-locked decisions:
  • Error format: { error: { code, message, field? } } — consistent across all endpoints
  • Rate limiting at middleware level, not per-route
─────────────────────────────────────────────
```

---

### Template: `dashboard`

**Questions:**
1. Data source? (own DB / external API / mixed)
2. Need real-time updates or periodic refresh?
3. Export formats needed? (CSV / PDF / None)

**Outline:**
```
Template: dashboard
─────────────────────────────────────────────
Pre-built focus areas:
  • KPI metrics with time-range filter
  • Charts (line, bar, pie) with data aggregation
  • Date range picker
  • Data table with sorting and filtering
  • CSV/PDF export
  • Auto-refresh or real-time updates

AC hints:
  AC-001  Dashboard loads in < 2s for 90-day date range
  AC-002  Date range change refreshes all charts without page reload
  AC-003  Empty state shown when no data exists for selected range
  AC-004  Export includes exactly the filtered/sorted data visible on screen
  AC-005  Charts are accessible (keyboard navigable, ARIA labels)

Wave order: Data aggregation queries → API endpoints → chart components → filters/date picker → export → real-time (if needed)

Pre-locked decisions:
  • Aggregate at query time, not client-side (performance)
  • Cache heavy aggregations with TTL matching refresh frequency
─────────────────────────────────────────────
```

---

### Template: `mobile`

**Questions:**
1. Platforms? (iOS only / Android only / Both)
2. Need offline support? (Y/N)
3. Auth method? (use existing `auth` epic / new / none)

**Outline:**
```
Template: mobile
─────────────────────────────────────────────
Pre-built focus areas:
  • Navigation structure (stack, tab, drawer)
  • Push notifications (FCM/APNs setup)
  • Offline-first data with sync conflict resolution
  • Deep linking and universal links
  • Biometric authentication (FaceID/TouchID)
  • App state persistence across backgrounding

AC hints:
  AC-001  App works without network — queues actions for sync
  AC-002  Conflicting offline changes resolved with last-write-wins + user prompt
  AC-003  Push notification opens correct screen when tapped
  AC-004  Deep link from external URL navigates to correct in-app screen
  AC-005  Biometric auth falls back to PIN/password if unavailable
  AC-006  App state fully restored after OS kills background process

Wave order: Navigation scaffold → auth integration → core screens → offline storage + sync → push notifications → deep links → biometrics

Dependencies to verify before building:
  - [ ] Apple Developer account (for iOS push + TestFlight)
  - [ ] Firebase project (for FCM push notifications)
  - [ ] React Native / Expo setup confirmed

Pre-locked decisions:
  • Offline queue: append-only log, sync on reconnect
  • Push tokens refreshed on every app launch
─────────────────────────────────────────────
```

---

### Template: `search`

**Questions:**
1. Search backend? (Elasticsearch / Algolia / PostgreSQL full-text / SQLite FTS / Other)
2. Need faceted filters? (Y/N)
3. Need search analytics (track queries, click-through)? (Y/N)

**Outline:**
```
Template: search
─────────────────────────────────────────────
Pre-built focus areas:
  • Full-text search with relevance ranking
  • Faceted filters (multi-select, range, boolean)
  • Autocomplete / search suggestions
  • Pagination of results
  • Result highlighting (match terms in snippet)
  • Search analytics (query volume, zero-result rate)

AC hints:
  AC-001  Search returns results within 200ms (p95) for typical query
  AC-002  Typo tolerance: "authantication" returns auth results
  AC-003  Selecting a filter updates results without full page reload
  AC-004  Zero results state shows related suggestions, not just empty
  AC-005  Autocomplete appears within 100ms of 2+ characters typed
  AC-006  Search query is debounced — no request on every keystroke

Wave order: Index setup + mapping → search API → filter logic → UI search input + results → autocomplete → analytics (optional)

Dependencies to verify before building:
  - [ ] Search index created and accessible
  - [ ] Initial data indexed (or indexing pipeline ready)

Pre-locked decisions:
  • Debounce search input: 300ms
  • Index updates: async (eventual consistency acceptable)
  • Never expose raw index config to client
─────────────────────────────────────────────
```

---

### Template: `file-upload`

**Questions:**
1. Storage provider? (AWS S3 / Google Cloud Storage / Azure Blob / Local filesystem)
2. Need processing pipeline? (resize, compress, transcode) — Y/N
3. Upload method? (Direct-to-storage via presigned URL / Server relay)

**Outline:**
```
Template: file-upload
─────────────────────────────────────────────
Pre-built focus areas:
  • Single and multi-file upload with progress
  • Direct-to-storage upload via presigned URLs (no server bandwidth)
  • File type and size validation (client + server)
  • Processing pipeline (resize, compress, format conversion)
  • CDN delivery of processed files
  • Upload retry on failure (without re-selecting file)
  • Preview generation (images, PDFs, video thumbnails)

AC hints:
  AC-001  Upload progress shows real-time percentage
  AC-002  File type validation rejects disallowed types with specific error message
  AC-003  Files over size limit show warning before upload begins
  AC-004  Failed upload can be retried without re-selecting the file
  AC-005  Processed file available via CDN URL within 10s of upload completion
  AC-006  Server validates file type from content (not just extension)

Wave order: DB schema (File entity) → presigned URL API → upload tracking → processing worker → CDN config → UI dropzone + progress → retry logic

Dependencies to verify before building:
  - [ ] Storage bucket created with correct permissions
  - [ ] CORS policy on bucket allows app domain
  - [ ] CDN configured and pointed at bucket
  - [ ] Processing library installed (sharp / ffmpeg / etc.)

Pre-locked decisions:
  • Direct-to-storage via presigned URLs (avoids server bandwidth)
  • Server validates file content type — never trust file extension alone
  • Virus scan before making file publicly accessible (if handling user uploads)
─────────────────────────────────────────────
```

---

### Template: `realtime`

**Questions:**
1. Transport? (WebSocket / Server-Sent Events / Both)
2. Need presence indicators (who's online)? (Y/N)
3. Need rooms/channels (multi-room support)? (Y/N)

**Outline:**
```
Template: realtime
─────────────────────────────────────────────
Pre-built focus areas:
  • WebSocket / SSE connection lifecycle management
  • Event broadcasting to connected clients
  • Presence indicators (join, leave, online list)
  • Optimistic UI updates with server confirmation
  • Reconnection with exponential backoff
  • Room/channel management (if needed)
  • Message ordering guarantee (sequence numbers)

AC hints:
  AC-001  Client reconnects automatically after network drop (max 5 attempts)
  AC-002  Presence list updates within 2s of user joining or leaving
  AC-003  Optimistic update rolls back if server rejects the action
  AC-004  Messages delivered in order (no reordering on reconnect)
  AC-005  Connection works behind proxies / load balancers (sticky sessions or stateless)

Wave order: Connection layer (WS/SSE server) → event system (emit/subscribe) → presence → optimistic UI → reconnection logic → rooms (if needed)

Dependencies to verify before building:
  - [ ] Load balancer supports WebSocket / sticky sessions (or use stateless SSE)
  - [ ] Redis pub/sub (if multi-instance deployment needed)

Pre-locked decisions:
  • Reconnection: exponential backoff (1s → 2s → 4s → max 30s)
  • Sequence numbers on all messages for ordering guarantee
  • Optimistic updates always — roll back on server rejection
─────────────────────────────────────────────
```

---

### Template: `admin`

**Questions:**
1. Who can access admin? (specific roles / any staff / superadmin only)
2. Need audit logging? (Y/N — logs every admin action)
3. Need bulk operations (batch delete/update)? (Y/N)

**Outline:**
```
Template: admin
─────────────────────────────────────────────
Pre-built focus areas:
  • Role-based access control (RBAC) from day one
  • Admin-only routes with middleware guard
  • Audit log (who did what, when, to which record)
  • User management (list, view, suspend, delete)
  • Data tables with sorting, filtering, pagination
  • Bulk operations (select all, batch update/delete)
  • System health/metrics overview

AC hints:
  AC-001  Non-admin user accessing admin route returns 403
  AC-002  Every admin action logged: actor, action, target, timestamp
  AC-003  Audit log is append-only — no admin can delete their own log entries
  AC-004  Bulk delete requires explicit confirmation with record count shown
  AC-005  Suspended user cannot log in immediately (not on next session)
  AC-006  Admin can impersonate user only if impersonation role is explicitly granted

Wave order: RBAC schema + middleware → user management → audit log → data tables → bulk operations → metrics overview

Pre-locked decisions:
  • RBAC: roles + permissions table (not boolean flags per user)
  • Audit log: immutable append-only (no UPDATE or DELETE on audit records)
  • Admin routes: separate route prefix + auth middleware — never share with user routes
─────────────────────────────────────────────
```

---

### Template: `onboarding`

**Questions:**
1. How many steps in the onboarding flow? (rough count)
2. Need to resume incomplete onboarding across sessions? (Y/N)
3. Send onboarding emails? (Y/N)

**Outline:**
```
Template: onboarding
─────────────────────────────────────────────
Pre-built focus areas:
  • Multi-step wizard with progress indicator
  • Step validation before advancing
  • Back navigation without losing data
  • Progress persistence (resume incomplete onboarding)
  • Skip option for optional steps
  • Welcome email + drip sequence
  • Profile completion prompts (after initial onboarding)
  • Feature discovery tooltips on first use

AC hints:
  AC-001  User can return to incomplete onboarding and resume from last completed step
  AC-002  Navigating back does not clear already-entered data
  AC-003  Skipping an optional step does not block progression
  AC-004  Welcome email sent within 60s of completing onboarding
  AC-005  Progress percentage shown and updates on each step completion
  AC-006  Onboarding considered complete only after mandatory steps are done

Wave order: DB schema (onboarding_progress) → step validation logic → wizard UI shell → individual step components → progress persistence → email sequence → tooltips

Pre-locked decisions:
  • Persist each step's data on advance (not just at final submit)
  • Mandatory vs optional steps defined in config, not hardcoded
  • Email sequence uses delay-based triggers (Day 0, Day 3, Day 7)
─────────────────────────────────────────────
These are starting points — /buildflow-spec will expand, refine, and add project-specific ACs.
```

---

## Step 1: Load Memory
Read `.buildflow/MEMORY.md`, `.buildflow/PREFERENCES.md`, and `.buildflow/STATE.md`.
If `MEMORY.md` is over 3K tokens: prune it now (see pruning rules below).

**Paused epics check:** If `paused_epics` is non-empty in `STATE.md`, show:
```
Note: You have [N] paused epic(s): [slugs]. Use /buildflow-switch-epic to resume one instead of starting new.
```
Proceed if user confirms they want a new epic.

## Step 1b: Codebase Drift Detection (runs if onboard_status: yes)

If `intel.json` exists at `.buildflow/codebase/intel.json`, run a fast drift check against the recorded baseline. This takes seconds and catches silent codebase changes between sessions.

Also read `.buildflow/codebase/CODEBASE.md` frontmatter if present. Prefer `last_mapped_commit` from `CODEBASE.md` for structural drift; fall back to `intel.json.drift_baseline.last_mapped_commit` or `onboarded_at`.

**Drift checks:**

```bash
# 1. File count drift — did the number of files change significantly?
find src/ -type f | wc -l
# Compare against intel.json file_count field

# 2. Schema file changes (git available):
git diff $(git log --format="%H" --after="[onboarded_at from intel.json]" | tail -1) HEAD -- "*.prisma" "*.entity.ts" "models.py" "schema.sql" 2>/dev/null
# Schema file changes (no-git mode):
# Hash each schema file listed in intel.json drift_baseline.file_hashes
# Compare against stored hash — any mismatch = changed

# 3. Load-bearing file changes (git available):
git log --since="[onboarded_at]" --name-only --format="" -- [load_bearing files from intel.json] 2>/dev/null | head -10
# Load-bearing file changes (no-git mode):
# Compare modification timestamp of each load_bearing file in intel.json against drift_baseline.recorded_at

# 4. Structural drift (git available):
git diff --name-status [last_mapped_commit]..HEAD 2>/dev/null
# Classify additions as new_dir / route / migration / barrel / dependency / integration / test / copy_locale
```

**Drift signals and responses:**

| Signal | Threshold | Response |
|--------|-----------|----------|
| New files added | > 5 new source files | Warn: "N files added since onboard — run `/buildflow-onboard --update`" |
| Schema file changed | Any change | Warn: "Schema changed since onboard — run `/buildflow-onboard --update` to refresh drift baseline" |
| Load-bearing file changed | Any of top-5 risk files | Warn: "[file] changed — impact analysis may be stale. Run `/buildflow-onboard --update`" |
| Structural map drift | 3+ drift elements or any new route/migration/dependency | Warn: "Codebase map drift detected — run `/buildflow-onboard --paths [affected paths]`" |
| File count delta > 20% | Absolute | Alert: "Codebase changed significantly — recommend full `/buildflow-onboard` re-run" |
| No drift detected | — | Silent. Do not mention. |

Only report warnings — never block session start. The user may already know about the changes.

**Fast path (no git):** compare file count in `intel.json` against current `find src/ -type f | wc -l`. If delta > 10 files, warn.

---

## Step 1c: Load Epic History (cross-epic continuity)

If any `.buildflow/epics/*/SHIPPED.md` files exist, load the last 3 (sorted by epic number descending). Each is ≤500 tokens, so 3 together cost ≤1.5K tokens — worth it for full project continuity.

```bash
ls .buildflow/epics/*/SHIPPED.md 2>/dev/null | sort -t/ -k3 -rn | head -3
```

From these, extract:
- What was built in prior epics (prevents re-speccing already-shipped features)
- Open technical debt inherited from prior epics
- Architecture decisions that constrain the current epic

Print a one-line history summary per epic:
```
Epic history
────────────
1-auth (shipped 2024-01-10): Auth — login, password reset, JWT [6 ACs, 74% coverage]
2-profiles (shipped 2024-01-20): User profiles — avatar, bio, preferences [8 ACs, 79% coverage]
```

If no SHIPPED.md files: skip silently (first epic or pre-continuity project).

---

## Step 2: Detect Mode

**Greenfield (no src/ code yet):**
Ask vision questions one at a time:
1. What are you building?
2. Who is it for?
3. What problem does it solve?
4. What's the simplest useful version?
5. Timeline, team size, constraints?
6. Confidence in the idea (1-5)?

**Existing codebase (src/ exists):**
Check if `.buildflow/codebase/CODEBASE.md` exists.
- If NO: "Run `/buildflow-onboard` first to analyze your codebase."
- If YES: Load CODEBASE.md summary only (not full file). Ask about goals for this session.

## Step 3: Save Vision
Use the **Write tool** to create `.buildflow/VISION.md` — do not just output the content as text, write it to disk.
Use the **Write tool** to create or update `.buildflow/MEMORY.md` with:
```yaml
app_name: [name]
framework: [detected or stated]
language: [detected or stated]
current_epic: none
spec_status: none
onboard_status: [yes/no]
last_session: [today]
```

## Step 4: Guided Next Step

Determine the single most valuable next action and print it clearly:

```
──────────────────────────────────────────────────
→ Next:  /buildflow-[command]
   Why:  [one sentence — what this unlocks right now]
──────────────────────────────────────────────────
```

**Decision logic (pick the first match):**

| State | Next command | Why |
|-------|-------------|-----|
| Emergency fix described | `/buildflow-hotfix "[description]"` | Fast-path fix — no overhead |
| Existing project, not onboarded | `/buildflow-onboard` | Impact analysis needs the codebase map first |
| No spec exists | `/buildflow-spec` | Spec is required before planning — defines what to build |
| Spec draft in progress | `/buildflow-spec` | Continue and lock the spec |
| Confidence ≤ 3 on topic | `/buildflow-think [topic]` | Research before committing to a spec |
| Spec locked, no plan | `/buildflow-spec` | Translate spec into executable waves |
| Plan ready, build not started | `/buildflow-build` | Execute wave 1 |
| Build in progress | `/buildflow-build wave-[N]` | Continue where you left off |
| All waves complete, not checked | `/buildflow-check` | Verify every AC is satisfied |
| Check passed | `/buildflow-ship` | Run all gates and ship the phase |
| Just shipped | `/buildflow-spec "[next feature]"` | Start the next phase |
| Onboarded, no active phase | `/buildflow-modify "[what to change]"` | Surgical change to existing code |

Never show a table to the user — pick one command and explain why.

## MEMORY.md Pruning Rules (silent — never shown to user)
If `MEMORY.md` exceeds 3K tokens on session start:
- Remove: completed epic task lists, wave details, build timestamps older than last epic
- Archive these to the most recent `epics/[epic]/RETRO.md`
- Keep: app_name, framework, language, current_epic, spec_status, style_fingerprint, last 2 decisions
- Do NOT report this operation. It is invisible.



