---
name: buildflow-spec-plan
description: Module — wave planning, dependency reasoning, effort estimation, engineering review, wave file writing. Loaded by /buildflow-spec after spec approval.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Spec Plan Module

Loaded by /buildflow-spec automatically after the spec is approved. Executes Steps 8–15 (PART 2: PLAN). Returns when PLAN.md, wave files, and CHECK.md are written.
# PART 2 — PLAN (auto-runs after spec approval)

## Step 1: Validate & OpenAPI
Confirm `spec_status: locked` in `MEMORY.md`. Record locked `spec_version` — this is the version this plan builds against.

Read all ACs. Confirm: "Planning to satisfy [N] ACs across [N] features (spec v[N])."

**OpenAPI** (auto-runs if API endpoints defined in SPEC.md):

If the SPEC.md API Contracts table contains 1 or more endpoints: generate `openapi.yaml` in the project root (or `docs/openapi.yaml` if a `docs/` folder exists).

**Format:**
```yaml
openapi: "3.1.0"
info:
  title: "[app name from MEMORY.md]"
  version: "[spec_version from ACCEPTANCE.md frontmatter]"
  description: "[one-sentence app description from VISION.md]"

servers:
  - url: http://localhost:[port]
    description: Local development
  - url: https://[domain-if-known]
    description: Production

paths:
  /api/[path]:
    post:
      summary: "[AC summary that this endpoint satisfies]"
      operationId: "[camelCase name]"
      tags: ["[feature area]"]
      security:
        - bearerAuth: []   # only if auth: yes
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                [field]:
                  type: [type]
                  description: "[from AC or spec]"
              required: [[required fields]]
      responses:
        "200":
          description: "[success outcome from AC]"
          content:
            application/json:
              schema:
                type: object
                properties:
                  [field]:
                    type: [type]
        "400":
          description: Validation error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
        "500":
          description: Internal server error

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:    { type: string }
            message: { type: string }
            field:   { type: string }
```

Write with the **Write tool** to `openapi.yaml` (or `docs/openapi.yaml`). Print:
```
OpenAPI spec generated → openapi.yaml ([N] endpoints documented)
Import into Postman: File → Import → openapi.yaml
View in browser:     npx @redocly/cli preview-docs openapi.yaml
```

If no API endpoints in spec: skip silently.

Read all ACs. Confirm: "Planning to satisfy [N] ACs across [N] features (spec v[N])."

If `PATTERNS.md` (feature inventory section) or `intel.json.features[]` exists:
- Mark already-implemented capabilities as "existing support" and avoid recreating them.
- Preserve `local_support` and `locale_support` unless explicitly out of scope.

---

## Step 2: Derive, Reason & Estimate Tasks

For each feature, derive tasks (what code to create/modify/test), map each to AC refs, assign dependency type (HARD / SOFT / EXTERNAL), detect circular deps, and estimate size:

| Size | Meaning |
|------|---------|
| XS | < 30 min | S | 30–90 min | M | 2–4 hrs | L | 4–8 hrs | XL | > 1 day |

Flag XL tasks. Generate external dependency checklist if any EXTERNAL deps found. If `PATTERNS.md` or `intel.json.features[]` exists: mark already-implemented capabilities as existing support — don't recreate them.

---

## Step 3: Wave Planning

Group tasks into parallel waves based on HARD dependencies only (SOFT deps don't block).

### 12a — Thin-Slice Ordering (enforced for full-stack features)

For any feature that spans UI + API + DB layers, enforce this ordering across waves:
```
Wave N   — DB / schema layer first (migrations, models, repositories)
Wave N+1 — API / service layer (endpoints, business logic, service methods)
Wave N+2 — UI layer (components, pages, forms)
Wave N+3 — Integration / E2E tests (require all layers complete)
```

If tasks violate this order: flag and reorder. Exception: purely presentational UI tasks with no API calls.

### 12b — Exclusive File Ownership

Every file modified in this phase must have exactly one owner wave. No two waves may modify the same file.

Ownership assignment rules:
1. List all files each task will touch (create or modify).
2. If two tasks in different waves touch the same file → merge them into one task or move all tasks touching it into one wave.
3. Exception: test files may be extended across waves — additive only.

**Ownership map (generated for each plan):**
```
File Ownership Map
──────────────────
src/auth/service.ts       Wave 2  (owned by: "Create auth service")
src/routes/auth.ts        Wave 3  (owned by: "Create auth routes")
src/db/schema.ts          Wave 1  (owned by: "Create user schema")
```

If a conflict is detected: **STOP and resolve before writing the plan.**

### 12c — Wave Table

```
Wave 0 — Scaffolding (if --scaffold-first)
  Create empty file stubs for all new files

Wave 1 — DB / Schema
  • Task A  [AC-001]  S   NEW    src/db/schema.ts (owned)

Wave 2 — API / Services (hard-depends on Wave 1)
  • Task C  [AC-001, AC-002]  M   NEW    src/auth/service.ts (owned)

Wave 3 — Routes / Integration (depends on Wave 2)
  • Task E  [AC-001–AC-003]  M   MODIFY  src/routes/auth.ts (owned)

Wave 4 — UI (depends on Wave 3)
  • Task G  [AC-005, AC-006]  M   NEW    src/components/LoginForm.tsx (owned)
```

If `--risk-first`: within each wave, sort tasks by uncertainty/novelty (most uncertain first).

### 12d — Implementation Approach Analysis (per task)

For every non-trivial task in every wave, evaluate the implementation before writing plan files. This surfaces the best approach and documents alternatives so the user can redirect before any code is written.

For each task:
1. Identify 2–3 candidate approaches (e.g., REST vs GraphQL, custom vs library, inline vs service layer, optimistic vs server-driven UI)
2. Score each against: existing patterns in `PATTERNS.md`, spec requirements in `ACCEPTANCE.md`, simplicity, testability, and reversibility
3. Pick the recommended approach — best score across all criteria
4. Document rejected alternatives — one line each

Print for each task before writing wave files:

```
Task: [task name]
─────────────────────────────────────────────
Approach (recommended):
  [Concrete description — e.g., "Use Prisma upsert() in the repository layer, wrap in a service method, throw typed errors on conflict."]
  Why: [e.g., "Matches service-layer pattern in PATTERNS.md, testable in isolation, spec requires typed error responses."]

Alternatives considered:
  • [Alt 1] — [why not: e.g., "Bypasses repository layer, breaks PATTERNS.md contract"]
  • [Alt 2] — [why not: e.g., "Over-abstraction — spec doesn't require this level of indirection"]

Trade-off: [What you give up — e.g., "Slightly more boilerplate than inline, but isolated and unit-testable."]
Risk: [LOW / MEDIUM / HIGH] — [e.g., "MEDIUM — upsert race condition under concurrent writes; add unique DB constraint as guard."]
```

If no meaningful alternatives exist (pure scaffold, config, migration, or locale file): write `Approach: [what to create] — no alternatives applicable`.

The user can redirect any task's approach before the plan is locked. Any redirected approach is stored in `CONTEXT.md` as a locked decision and applied when writing wave files.

---

## Step 4: Verify Coverage & Test Plan

Every AC must be covered by at least one task — if any AC is uncovered: stop and add a task or mark it out of scope.

For every non-trivial `NEW` or `MODIFY` task: co-locate focused tests in the same wave task (implement + test together). Exception: pure scaffolding, config, migration, and locale files only need tests if a relevant test already exists.

```
AC-001 ✓  Task C, Task E
AC-002 ✓  Task C
Uncovered: NONE
```

---

## Step 5: Engineering Review
Before writing the plan file, review the plan as an Engineering Lead:

**Over-engineering check:**
- Is any task adding abstraction layers not required by the ACs?
- Are there tasks that implement features "for future use" not in specs?
- Flag and remove.

**Under-engineering check:**
- Are there ACs that will be technically impossible with the planned approach?
- Are tests planned for every non-trivial AC?

**Architecture smell check:**
- Does the plan introduce patterns that conflict with `PATTERNS.md`?
- Does the plan introduce paths/layers that conflict with `CODEBASE.md`?
- Does the plan add dependencies or runtime assumptions that conflict with `CODEBASE.md` (stack section)?
- Does the plan change external services/env/webhooks without tasks to update `DEPENDENCIES.md`?
- Does any task modify a file listed in `RISKS.md` hotspots? If yes, flag with: "⚠ This task touches [file] (risk: [N]) — verify test coverage before proceeding."
- Does any task unintentionally remove an existing feature from `PATTERNS.md` (feature inventory), especially local support?

**Engineering Review Report:**
```
Engineering Review
──────────────────
Over-engineering:  [list or NONE]
Under-engineering: [list or NONE]
Architecture:      [conflicts or NONE]
Hotspot warnings:  [files or NONE]
Thin-slice order:  [violations or OK]
File conflicts:    [ownership conflicts or OK]
Focused tests:     [tasks missing post-change tests or OK]
Approach quality:  [tasks with weak/risky approach — or OK]
Verdict: APPROVED / NEEDS REVISION
```

If NEEDS REVISION: apply fixes, re-run review. Repeat until APPROVED. Do not write the plan file until APPROVED.

Log each review cycle in the plan file header:
```yaml
engineering_review_cycles: 2
engineering_review_verdict: APPROVED
```

---

### Strict Mode Annotations (if `--strict` flag)

When `--strict` is active:

1. **Tag each task** with its technical design mapping:
   - Every `NEW`/`MODIFY` task must reference the SPEC.md Component Map row it implements (`[Design: ComponentName]`)
   - Every task implementing an API endpoint must reference its SPEC.md API Contract row (`[Design: POST /api/path]`)

2. **Mark the plan header:**
   ```yaml
   strict_mode: true
   strict_check_required: true
   ```

3. **Critical module flag** — tasks touching critical module files get a `[CRITICAL]` tag.

4. If any task cannot be mapped to SPEC.md → flag and block until resolved.

---

## Step 6: Write All Artifacts

### PLAN.md (index only)
Use the **Write tool** to create `.buildflow/epics/[epic]/PLAN.md`. Do not output the plan as text — write it to disk.

PLAN.md is a lightweight index only — no task lists. Full task lists live in `waves/wave-[N].md`.

→ **Format:** Read `.buildflow/templates/tpl-plan.md` for the PLAN.md index structure.

### Wave Files
For each wave, use the **Write tool** to create `.buildflow/epics/[epic]/waves/wave-[N].md`:

→ **Format:** Read `.buildflow/templates/tpl-wave.md` for the wave file structure.

Create one wave file per wave. Do not put task lists in PLAN.md.

### CHECK.md
Also create `.buildflow/epics/[epic]/CHECK.md` from every AC in `ACCEPTANCE.md`:

→ **Format:** Read `.buildflow/templates/tpl-check.md` for the CHECK.md structure.

Update `MEMORY.md`:
```yaml
current_epic: [N]
plan_status: ready
wave_count: [N]
task_count: [N]
est_total: [size]
```

Wave files written: `waves/wave-1.md` through `waves/wave-[N].md`

---

# --update Mode (`/buildflow-spec --update`)

Called automatically by `/buildflow-discuss` when the user confirms decisions. Can also be run manually after locking new decisions in CONTEXT.md.

## When to use
- After `/buildflow-discuss` locks new decisions that affect spec artifacts
- When CONTEXT.md has decision entries newer than `ACCEPTANCE.md → approved_at`

## Steps

**1. Load CONTEXT.md** — read all decisions with `status: locked` that post-date `ACCEPTANCE.md → approved_at`.

**2. Impact analysis** — for each new decision:
- Which section of SPEC.md does it affect? (requirements: features, constraints, out-of-scope; design: architecture, component map, data model, API contracts, tech decisions)
- Which ACs does it affect? (any AC whose Given/When/Then references the changed design)
- Which PLAN tasks does it affect? (tasks that implement affected ACs, in wave files)

**3. Apply patches** — edit only the affected sections using the Write tool. Preserve all unaffected content exactly. Update affected wave files if task lists change.

**4. Re-run Critic pass** on changed sections only.

**5. Show diff:**
```
Spec Update — Phase [N] v[N] → v[N+1]
──────────────────────────────────────
Decisions applied: [N]
Sections changed:
  SPEC.md: [which sections]
  ACCEPTANCE.md: [AC-XXX updated; AC-YYY added]
Plan changes:
  Wave [N] (waves/wave-[N].md): [tasks added/removed/updated]
Critic: STRONG / FLAG
```

**6. Increment spec_version** in `ACCEPTANCE.md` frontmatter, append changelog entry:
```yaml
- version: [N+1]
  date: [today]
  author: buildflow-discuss
  summary: "Post-discuss update: [brief description of decisions applied]"
  amended_acs: [list]
  reason: "[decisions that triggered the update]"
```

**7. Update APPROVALS.md** — append amendment record.

**8. Update MEMORY.md**: `spec_version: [N+1]`

**Output:**
```
Spec updated to v[N+1] — [N] decisions applied · [N] ACs changed
```

---

# --fast Mode
For single-feature additions:
- Skip User Stories table (inline in feature row)
- Skip Technology Decisions (use existing stack)
- Generate 3 ACs minimum: 1 happy + 1 error + 1 NFR
- Skip Critic coverage check (only vague language scan)
- Plan: 1–2 waves, no thin-slice ordering required

---

## Guided Next Step

Because spec+plan is a major phase boundary, recommend clearing the AI session before the next command.

```
──────────────────────────────────────────────────
→ Next:  /buildflow-discuss
   Why:  Review the generated spec and plan — clarify any doubts before building
   Or:   /buildflow-build  — skip discuss and start executing wave 1
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
```

If spec is NOT locked yet (still in review): `→ Next: /buildflow-spec` (continue review and lock).
If spec was amended and plan is now stale: `→ Next: /buildflow-spec --update` (regenerate plan against new decisions).


