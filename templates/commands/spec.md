---
name: buildflow-spec
description: Generate Requirements, Technical Design, Acceptance Criteria, and wave plan in one pass — with optional post-discuss update mode
allowed-tools: Read, Write, WebSearch
agent: architect
---

# /buildflow-spec

Spec-Driven Development layer. Produces formally structured, self-critiqued spec artifacts and an executable wave plan in a single pass. Every build output and every ship gate references these docs.

Run after `/buildflow-start-epic`. After this completes, run `/buildflow-discuss` (optional) to clarify doubts, then `/buildflow-build`.

## Usage
- `/buildflow-spec` — full spec + wave plan from vision
- `/buildflow-spec --fast` — minimal spec + plan for small features (single screen / endpoint)
- `/buildflow-spec --review` — critique existing spec without regenerating
- `/buildflow-spec --update` — apply locked decisions from DECISIONS.md to existing spec and plan (called automatically by `/buildflow-discuss`)
- `/buildflow-spec --strict` — mark this phase as strict mode: every task must trace to a DESIGN.md component or API contract; `/buildflow-check --strict` mandatory before ship
- `/buildflow-spec --scaffold-first` — Wave 0 creates all file stubs before implementation begins

## Context Packet
- `.buildflow/VISION.md`
- `.buildflow/epics/[epic]/STATE.md` (if current epic exists — resume status, decisions, risks, next command)
- `.buildflow/codebase/STACK.md` (if exists — runtime, frameworks, critical dependencies)
- `.buildflow/codebase/STRUCTURE.md` (if exists — physical layout and entry points)
- `.buildflow/codebase/INTEGRATIONS.md` (if exists — external services, env contracts, webhooks)
- `.buildflow/codebase/TESTING.md` (if exists — test framework and validation patterns)
- `.buildflow/codebase/CONCERNS.md` (if exists — risks, debt, blind spots)
- `.buildflow/codebase/PATTERNS.md` (if exists — align spec with existing architecture)
- `.buildflow/codebase/FEATURES.md` (if exists — existing capability inventory)
- `.buildflow/codebase/MAP.md` (if exists)
- `.buildflow/codebase/GRAPH.md` (if exists — for dependency chain reasoning)
- `.buildflow/codebase/intel.json` fields `features[]`, `local_support`, and `locale_support` (if exists)
- `.buildflow/MEMORY.md` (app_name, framework, current_epic only)
- `.buildflow/epics/[epic]/REQUIREMENTS.md`, `DESIGN.md`, `ACCEPTANCE.md`, `PLAN.md` (if regenerating or updating)
- `.buildflow/epics/[epic]/DECISIONS.md` (if exists — carry locked decisions as spec constraints)

---

## Epic State Resume
Read `.buildflow/STATE.md` and `.buildflow/MEMORY.md`. If a current epic exists (`current_epic` is set), read `.buildflow/epics/[epic]/STATE.md`.

Use `STATE.md` to avoid making the user restate prior research, decisions, risks, or open questions. If it says the spec is already locked AND a PLAN.md exists for the same spec version, continue to the guided next step instead of regenerating.

Before exiting, create or update `.buildflow/epics/[epic]/STATE.md` with:
- Current State: `Status: plan_ready` when both spec and plan are complete
- Decisions: major product/technical decisions from REQUIREMENTS/DESIGN
- Files That Matter: `REQUIREMENTS.md`, `DESIGN.md`, `ACCEPTANCE.md`, `PLAN.md`, `VERIFICATION.md`
- Next Command: `/buildflow-discuss` (optional) or `/buildflow-build`
- Risks / Open Questions: known risks plus unresolved spec questions
- Test Strategy: acceptance criteria verification approach and constraints from `TESTING.md`

---

# PART 1 — SPEC

## Step 1: Validate Vision
Read `.buildflow/VISION.md`.
If empty: "Run `/buildflow-start-epic` first."

If `PATTERNS.md` exists: note the existing architectural style. DESIGN.md must align — don't invent new patterns unless explicitly asked.

If focused codebase maps exist:
- Use `STACK.md` to constrain runtime/framework/dependency choices.
- Use `STRUCTURE.md` to avoid inventing paths or layers that conflict with the repo layout.
- Use `INTEGRATIONS.md` to preserve external service/env/webhook contracts.
- Use `TESTING.md` to make acceptance criteria verifiable with existing test conventions.
- Use `CONCERNS.md` to surface known risks and blind spots as constraints.

If `FEATURES.md` or `intel.json.features[]` exists:
- List existing implemented/partial/docs-only capabilities before writing scope.
- Treat implemented features as existing system constraints, not new scope.
- Preserve `local_support` and `locale_support` unless explicitly asked to remove.
- If the phase touches locale support, add explicit ACs for default locale, fallback behavior, catalog sync, and localized docs.

If `DECISIONS.md` exists: treat all locked entries as firm constraints — do not contradict or re-open them.

---

## Step 1b: Load Epic History
If `.buildflow/epics/*/SHIPPED.md` files exist, load the last 2. Extract:
- Already-shipped features → exclude from this spec's scope
- Open debt from prior epics → surface as constraints
- Prior architecture decisions → DESIGN.md must not contradict them

Print: "Prior epics: [N]. Already shipped: [brief list]. Open debt: [N items]."
If no history: skip silently.

---

## Step 2: Clarify (adaptive, one question at a time)
Ask only what vision.md, STATE.md, prior research, and codebase maps leave unanswered. Do not ask all questions at once.

Start with:
> "I need a few clarifications before writing the spec. I'll ask one at a time and recommend sensible defaults."

### 2a — Build the Clarification Queue
Create an internal queue of up to 5 clarification topics, ordered by spec risk:
1. User success outcome — measurable result, not a feature list
2. Explicitly out of scope this phase
3. Hard constraints — tech stack, deadline, team size, compliance, accessibility
4. Third-party integrations or external dependencies
5. If `--fast`: the single feature boundary in one sentence

Skip any topic already answered clearly by existing context or DECISIONS.md.

### 2b — Ask One Question at a Time
For each remaining topic, ask exactly one question and wait for the user's answer before asking the next.

Use this format:
```
I need one clarification: [question]

Recommended options:
1. [Recommended option] — [why this is the safest/default choice]
2. [Alternative option] — [tradeoff]
3. [Alternative option] — [tradeoff]

Or reply with your own custom answer.
```

Rules:
- Provide 2-3 mutually exclusive recommended options.
- Mark the best default as option 1.
- Always allow custom input. Treat custom input as authoritative unless it conflicts with locked constraints.
- If the user replies with `1`, `2`, or `3`, expand that option into the full answer before storing it.

### 2c — Reassess After Each Answer
After every answer:
1. Update the internal clarification summary.
2. Decide whether the answer creates a new ambiguity.
3. If yes, ask one follow-up using the same format.
4. If no, continue to the next queued topic.

Do not exceed 7 total questions. After 7, state remaining assumptions and ask for approval to proceed.

### 2d — Clarity Gate
Proceed to Step 3 only when:
- Success outcome is clear enough to test
- Scope boundaries are clear enough to prevent accidental extra work
- Known constraints are captured or explicitly assumed absent
- Required integrations are named or explicitly "none"

Before generating files, summarize the captured answers in 3-6 bullets and say:
> "I have enough clarity to draft the spec. I'll proceed with these assumptions."

---

## Step 2e: Create Epic Folder

All spec artifacts for this epic live in `.buildflow/epics/[epic]/`. Create the folder if it doesn't exist.

**Derive `[epic]`** — the folder name is `[N]-[slug]` where:
- `N` = next epic number: scan `.buildflow/epics/` for existing numbered folders (e.g. `1-auth`, `2-payments`) and increment the highest number. If no epics exist yet, start at `1`.
- `slug` = kebab-case of the epic topic derived from the vision or the user's first clarification answer. Examples: `auth`, `user-profiles`, `payment-flow`, `api-refactor`.

Derive the slug automatically — do not ask the user a separate question. Use the topic already established in Steps 1–2.

Examples of valid epic folder names: `1-auth`, `2-payments`, `3-dashboard`, `4-email-notifications`.

Set `[epic]` to this value for all file paths in the steps below. Update `STATE.md → current_epic` and `MEMORY.md → current_epic` with this value before writing any spec files.

---

## Step 3: Generate REQUIREMENTS.md
Use the **Write tool** to create `.buildflow/epics/[epic]/REQUIREMENTS.md`. Do not output the content as text — write it to disk.

```markdown
# Product Requirements Document
**App:** [name]  **Phase:** [N]  **Date:** [today]  **Status:** DRAFT

## Problem Statement
[One paragraph. Must answer: what exists today that's broken/missing, who suffers, why current solutions fail.]

## Users & Goals
| User Type | Job-to-be-Done | Current Pain |
|-----------|----------------|--------------|
| [type] | [goal — verb phrase] | [specific friction today] |

## User Stories
| ID | Story | Acceptance Signal |
|----|-------|------------------|
| US-01 | As a [user], I want [goal] so that [outcome] | [one-line measurable signal] |

## Features — In Scope
| ID | Feature | Linked Stories | Priority | Success Metric |
|----|---------|---------------|----------|----------------|
| F-01 | [name] | US-01, US-02 | Must / Should / Could | [number or binary] |

## Explicitly Out of Scope
- [item] — reason: [why excluded this phase]

## Constraints
| Type | Constraint |
|------|-----------|
| Tech | [stack lock-in, version requirements] |
| Timeline | [deadline if any] |
| Compliance | [GDPR, HIPAA, accessibility level, etc.] |
| Team | [size, skills] |

## Phase Complete When
- [ ] [measurable outcome — must map to a Success Metric above]
```

---

## Step 4: Generate DESIGN.md
Use the **Write tool** to create `.buildflow/epics/[epic]/DESIGN.md`. Do not output the content as text — write it to disk.

If `PATTERNS.md` exists: components and API shapes must follow existing conventions.

```markdown
# Technical Design Document
**App:** [name]  **Phase:** [N]  **Date:** [today]  **Status:** DRAFT

## Architecture Overview
[2–3 sentences. What components exist, how they communicate, what changes this phase.]

## Component Map
| Component | Responsibility | Linked Feature | Interface Type |
|-----------|---------------|----------------|----------------|
| [name] | [single responsibility] | F-01 | REST / gRPC / event / function |

## Data Model Changes
| Entity | Fields Added/Changed | Reason |
|--------|---------------------|--------|
| [entity] | [field: type] | [F-01] |

## API Contracts
| Endpoint / Function | Method | Request Shape | Response Shape | Status Codes | Auth |
|--------------------|--------|---------------|----------------|-------------|------|
| /api/[path] | POST | `{ field: type }` | `{ field: type }` | 200, 400, 401, 500 | yes/no |

## Error Response Format
All errors follow:
```json
{ "error": { "code": "ERROR_CODE", "message": "human readable", "field": "optional" } }
```

## Technology Decisions
| Decision | Choice | Rationale | Alternatives Rejected | Reversibility |
|----------|--------|-----------|----------------------|--------------|
| [area] | [choice] | [why] | [what else, why not] | easy / hard |

## Non-Functional Requirements
| Type | Requirement | Measurement Method |
|------|------------|-------------------|
| Performance | [endpoint] responds in < [Nms] at [N] rps | Load test / APM |
| Security | [specific requirement] | Audit / pen test |
| Accessibility | WCAG [2.1 AA / 2.1 AAA] | Automated + manual |
| Availability | [N]% uptime | Monitoring |

## Known Risks
| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|-----------|-------|
| [risk] | low/med/high | low/med/high | [concrete action] | dev / PM / ops |
```

---

## Step 5: Generate Acceptance Criteria
Use the **Write tool** to create `.buildflow/epics/[epic]/ACCEPTANCE.md`. Do not output the content as text — write it to disk.

**Rules for every AC:**
- Binary — pass or fail only, no partial credit
- Testable — an automated test or explicit manual step can verify it
- Specific — no vague words (see Critic pass below)
- Covers both happy path AND at least one failure/edge case per feature

```markdown
---
spec_version: 1
phase: [N]
status: DRAFT
created: [today]
last_revised: [today]
approved_by: null
approved_at: null
changelog:
  - version: 1
    date: [today]
    author: buildflow-spec
    summary: "Initial spec generated"
---

# Acceptance Criteria
**App:** [name]  **Phase:** [N]  **Date:** [today]

## [Feature F-01: name]  →  US-01, US-02
**Happy path:**
- AC-001: Given [setup state], when [user/system action], then [exact observable outcome]
- AC-002: Given [...], when [...], then [...]

**Failure / edge cases (required — minimum 1 per feature):**
- AC-003: Given [invalid/boundary/error input], when [...], then [specific error behavior]

## [Feature F-02: name]  →  US-03
- AC-004: Given [...], when [...], then [...]

## Non-Functional
- AC-NF-001: [endpoint] under [N] concurrent users responds within [Nms] (p95)
- AC-NF-002: [page/flow] achieves WCAG 2.1 AA with zero automated violations
- AC-NF-003: No secrets present in committed code (automated scan passes)
```

---

## Step 6: Spec Critic Pass (automatic — runs before showing user)

Before presenting specs to the user, self-review all three docs as a Spec Critic:

### Vague Language Scan
Search every AC for these banned words. Flag any found:
`correctly` `properly` `works` `fast` `quickly` `slow` `good` `bad` `easy` `easily`
`should` `appropriate` `reasonable` `nice` `clean` `simple` `obvious` `intuitive`

For each flagged word: replace with a specific, measurable alternative or mark `[NEEDS SPECIFICITY]`.

### Coverage Check
- Every feature in REQUIREMENTS.md has at least 2 ACs (1 happy + 1 error/edge) — flag if not
- Every user story US-XX is referenced in at least one AC's feature section — flag orphans
- Every component in DESIGN.md maps to at least one REQUIREMENTS.md feature — flag orphans
- Every NFR in DESIGN.md has a corresponding AC-NF — flag gaps

### Testability Check
For each AC, verify it can be answered as a pass/fail automated test or explicit manual step.

### Consistency Check
- API contracts in DESIGN.md match any referenced endpoints in ACs
- Data model changes in DESIGN.md are sufficient to support all AC outcomes
- Technology decisions don't contradict any constraints in REQUIREMENTS.md

### Critic Report
Show the user:
```
Spec Critic Report
──────────────────
Vague language:   [N found — fixed N, flagged N]
Coverage gaps:    [list any orphaned features/stories/components]
Testability:      [list any ACs needing rework]
Consistency:      [any DESIGN.md/REQUIREMENTS.md conflicts]
Overall quality:  STRONG / NEEDS REVISION
```

---

## Step 7: User Review Gate
Show summary of all three specs + Critic Report. Ask:

```
Specs ready for review. Critic score: [STRONG / NEEDS REVISION]

Choose one:
1. Approve — lock the spec and generate the wave plan
2. Revise — tell me what to change, then I will update and re-run the Critic pass
```

Rules:
- If the user selects `1`, lock specs immediately and proceed with the Approve flow below.
- If the user selects `2`, ask: "What should I revise?" Then apply changes, increment `spec_version`, append changelog entry, re-run Critic pass, repeat Step 7.
- If the user replies with custom revision text instead of `1` or `2`, treat it as `2`.

**Revise:** apply changes to the named section, increment `spec_version` in `ACCEPTANCE.md` frontmatter, append changelog entry, re-run Critic pass, repeat Step 7.

**Approve:** lock specs.
1. Update `ACCEPTANCE.md` frontmatter:
   ```yaml
   status: LOCKED
   approved_by: [user identifier — name or "user" if unknown]
   approved_at: [ISO datetime]
   ```
2. Use the **Write tool** to append the approval record to `.buildflow/epics/[epic]/APPROVALS.md` (create if not exists):
   ```markdown
   ## Phase [N] — v[spec_version] — [datetime]
   - **Approved by:** [user]
   - **AC count:** [N]
   - **Critic score:** STRONG / REVISED
   - **Revision cycles:** [N]
   - **Summary:** [one line — what this spec covers]
   ```
3. Update `MEMORY.md`:
   ```yaml
   spec_status: locked
   spec_version: [N]
   spec_phase: [N]
   ac_count: [N]
   ```

Do not proceed until user approves. The approval record in `APPROVALS.md` is permanent — never delete or overwrite prior entries.

After approval, automatically continue to **PART 2 — PLAN** without prompting. Print:

```
Spec locked ✓ — generating wave plan...
```

---

## Step 7b: Spec Amendment (when spec must change after locking)

If the user requests a spec change AFTER `spec_status: locked` (mid-phase amendment):

1. Show impact analysis:
   ```
   Spec Amendment Request
   ──────────────────────
   Phase: [N]  Current version: v[N]
   Requesting: [what the user wants to change]

   Impact analysis:
   - ACs affected: [list AC IDs that will change or be removed]
   - Plan tasks that reference these ACs: [list from PLAN.md if it exists]
   - Waves that will need re-planning: [list]

   Risk: [LOW / MEDIUM / HIGH]
   ```

2. Ask: "This amendment affects [N] ACs and [N] plan tasks. Type 'amend' to confirm."

3. On confirmation:
   - Increment `spec_version`
   - Update the affected ACs
   - Append to changelog
   - Append to `epics/[epic]/APPROVALS.md`
   - Update `MEMORY.md`: `spec_version: [N+1]`

4. If a PLAN.md exists: flag as stale — "⚠ PLAN STALE — spec amended to v[N+1]. Run `/buildflow-spec --update` to regenerate affected waves."

---

# PART 2 — PLAN (auto-runs after spec approval)

## Step 8: Validate Spec Lock
Confirm `spec_status: locked` in `MEMORY.md` and `status: LOCKED` in `ACCEPTANCE.md` frontmatter. Since we just locked the spec in Part 1, this will always pass.

Record the locked `spec_version` in `PLAN.md` header — this is the version this plan was built against.

Read all ACs. Confirm: "Planning to satisfy [N] ACs across [N] features (spec v[N])."

If `FEATURES.md` or `intel.json.features[]` exists:
- Mark already-implemented capabilities as "existing support" and avoid recreating them.
- Preserve `local_support` and `locale_support` unless explicitly out of scope.

---

## Step 9: Component & Task Derivation
For each feature in REQUIREMENTS.md, derive the implementation tasks needed to satisfy its ACs:

For each task ask:
1. What code needs to exist that doesn't exist yet?
2. What existing code needs to change?
3. What tests must be written to verify the linked ACs?

Map each task to its AC refs:
```
Task: Create JWT auth middleware
AC refs: AC-001, AC-002, AC-003
Feature refs: Auth
Files: src/middleware/auth.ts (new), src/routes/index.ts (modify)
Type: NEW / MODIFY / TEST
```

---

## Step 10: Dependency Reasoning
For each task, identify dependencies and explain WHY they exist:

```
Task: Create login API route
Depends on: "Create auth middleware" — HARD dependency
Reason: Route cannot be registered until middleware exists

Task: Write login integration tests
Depends on: "Create login API route" — HARD dependency
Reason: Tests call the live route; no route = test suite errors on import

Task: Create UI login form
Depends on: "Create login API route" — SOFT dependency
Reason: Form can be scaffolded independently; only needs real API for E2E tests
Can proceed in parallel if mocked: YES
```

Dependency types:
- **HARD** — code fails to compile/run without the prerequisite
- **SOFT** — can proceed with a mock/stub; full integration requires prerequisite
- **EXTERNAL** — depends on env var, database, third-party API (flag for setup checklist)

Detect circular dependencies: if A → B → A exists, flag immediately and resolve before proceeding.

External dependency checklist (generated if any EXTERNAL deps found):
```
Before building, verify these exist:
- [ ] DATABASE_URL env var set
- [ ] [service] API key configured
```

---

## Step 11: Effort Estimation
Estimate each task:
| Size | Meaning |
|------|---------|
| XS | < 30 min — config, type, single function |
| S | 30–90 min — single component or endpoint |
| M | 2–4 hrs — feature with tests |
| L | 4–8 hrs — complex feature, multiple components |
| XL | > 1 day — requires research or architectural decision |

Flag XL tasks: "This task is XL — consider splitting or running `/buildflow-think` first."

---

## Step 12: Wave Planning

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

---

## Step 13: AC Coverage Verification
Every AC must be covered by at least one task. Report:

```
AC Coverage
───────────
AC-001 ✓  Task C, Task E
AC-002 ✓  Task C
AC-003 ✓  Task D, Task E
Uncovered: NONE
```

If any AC is uncovered: stop. "AC-[X] has no task. Add a task or explicitly mark it out of scope."

---

## Step 13b: Post-Change Test Sequencing

For every non-trivial AC, plan focused tests after the implementation work.

**Rule:** For each task of type `NEW` or `MODIFY` that satisfies an AC:
1. Implement the code change.
2. Add or update focused tests for the changed behavior and linked ACs.
3. Run only tests for touched files and direct dependents during build.
4. Ask the user before running broader app-level tests.

Keep implementation and focused test work together in the same task:
```
Wave 2 — Auth Service
  • Implement login service + focused tests (AC-001, AC-002)   M   NEW
```

**Exception:** Pure scaffolding, config, migration, pure style files, and locale/label catalogs only need tests when a relevant focused test already exists.

---

## Step 14: Engineering Review
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
- Does the plan introduce paths/layers that conflict with `STRUCTURE.md`?
- Does the plan add dependencies or runtime assumptions that conflict with `STACK.md`?
- Does the plan change external services/env/webhooks without tasks to update `INTEGRATIONS.md`?
- Does any task modify a HOTSPOT file? If yes, flag with: "⚠ This task touches [file] (risk: [N]) — verify test coverage before proceeding."
- Does any task unintentionally remove an existing feature from `FEATURES.md`, especially local support?

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
Verdict: APPROVED / NEEDS REVISION
```

If NEEDS REVISION: apply fixes, re-run review. Repeat until APPROVED. Do not write the plan file until APPROVED.

Log each review cycle in the plan file header:
```yaml
engineering_review_cycles: 2
engineering_review_verdict: APPROVED
```

---

## Step 14b: Strict Mode Annotations (if `--strict` flag)

When `--strict` is active:

1. **Tag each task** with its technical design mapping:
   - Every `NEW`/`MODIFY` task must reference the DESIGN.md Component Map row it implements (`[Design: ComponentName]`)
   - Every task implementing an API endpoint must reference its DESIGN.md API Contract row (`[Design: POST /api/path]`)

2. **Mark the plan header:**
   ```yaml
   strict_mode: true
   strict_check_required: true
   ```

3. **Critical module flag** — tasks touching critical module files get a `[CRITICAL]` tag.

4. If any task cannot be mapped to DESIGN.md → flag and block until resolved.

---

## Step 15: Write Plan + VERIFICATION
Use the **Write tool** to create `.buildflow/epics/[epic]/PLAN.md`. Do not output the plan as text — write it to disk.

```markdown
# Phase [N] Plan
**Goal:** [one sentence — what the user can DO after this phase that they can't do now]
**ACs:** [N]  **Tasks:** [N]  **Waves:** [N]  **Est. total:** [sum of estimates]
**Spec version:** v[N]
**Engineering Review:** APPROVED (cycles: [N])
**Thin-slice order:** ENFORCED
**File conflicts:** NONE
**Strict mode:** [enabled — /buildflow-check --strict required before ship / disabled]

## External Dependencies Checklist
- [ ] [item] — [how to verify]

## File Ownership Map
| File | Owner Wave | Owner Task |
|------|-----------|------------|
| src/... | Wave 1 | [task name] |

## Waves

### Wave 1 — [theme: DB/Schema]
| Task | ACs | Est | Type | Files | Tests | Design Ref |
|------|-----|-----|------|-------|-------|---------|
| [name] | AC-001 | S | NEW | src/... | focused after change | [ComponentName / —] |

### Wave 2 — [theme: API/Services]
...

## AC → Task Traceability
| AC | Task(s) |
|----|---------|
| AC-001 | Task C, Task E |
```

Also create `.buildflow/epics/[epic]/VERIFICATION.md` from every AC in `ACCEPTANCE.md`:

```markdown
# Phase [N] Verification
**Spec version:** v[N]
**Status:** NOT STARTED
**Last updated:** [ISO datetime]

## Summary
| Status | Count |
|--------|-------|
| NOT STARTED | [N] |
| PASS | 0 |
| FAIL | 0 |

## Acceptance Criteria Verification
| AC | Requirement | Planned Task(s) | Test/Evidence | Status | Last Checked | Notes |
|----|-------------|-----------------|---------------|--------|--------------|-------|
| AC-001 | [exact AC summary] | Task C, Task E | pending | NOT STARTED | - | - |

## Test Runs
| Time | Scope | Command | Result | ACs Covered | Notes |
|------|-------|---------|--------|-------------|-------|

## Deferred / Risk Items
- None
```

Update `MEMORY.md`:
```yaml
current_epic: [N]
plan_status: ready
wave_count: [N]
task_count: [N]
est_total: [size]
```

---

# --update Mode (`/buildflow-spec --update`)

Called automatically by `/buildflow-discuss` when the user confirms decisions. Can also be run manually after locking new decisions in DECISIONS.md.

## When to use
- After `/buildflow-discuss` locks new decisions that affect spec artifacts
- When DECISIONS.md has entries newer than `ACCEPTANCE.md → approved_at`

## Steps

**1. Load DECISIONS.md** — read all decisions with `status: locked` that post-date `ACCEPTANCE.md → approved_at`.

**2. Impact analysis** — for each new decision:
- Which section of REQUIREMENTS.md does it affect? (features, constraints, out-of-scope)
- Which section of DESIGN.md does it affect? (architecture, component map, data model, API contracts, tech decisions)
- Which ACs does it affect? (any AC whose Given/When/Then references the changed design)
- Which PLAN tasks does it affect? (tasks that implement affected ACs)

**3. Apply patches** — edit only the affected sections using the Write tool. Preserve all unaffected content exactly.

**4. Re-run Critic pass** on changed sections only.

**5. Show diff:**
```
Spec Update — Phase [N] v[N] → v[N+1]
──────────────────────────────────────
Decisions applied: [N]
Sections changed:
  REQUIREMENTS.md: [which sections]
  DESIGN.md: [which sections]
  ACCEPTANCE.md: [AC-XXX updated; AC-YYY added]
Plan changes:
  Wave [N]: [tasks added/removed/updated]
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
Session: ~[N]K tokens
```

---

# --review Mode (`/buildflow-spec --review`)

Critiques existing specs without regenerating.

**1. Load and parse current spec:**
Read `ACCEPTANCE.md` frontmatter: `spec_version`, `status`, `changelog`.

**2. Spec diff (if spec_version > 1):**
Read the `changelog` array. For each version after v1, show what changed:
```
Spec Version History  Phase [N]
────────────────────────────────
v1 → v2  (amended [date] by user)
  Changed ACs: AC-003, AC-007
  Reason: "[user's stated reason]"
```

**3. Re-run full Critic pass** (vague language, coverage, testability, consistency).

**4. Plan staleness check:**
If a `PLAN.md` exists, compare its `spec_version` against current `ACCEPTANCE.md` version. If stale, list which tasks reference changed ACs.

**5. Report:**
```
Spec Review  Phase [N]  v[N]
─────────────────────────────
Amendments: [N versions]
Critic score: STRONG / NEEDS REVISION
Plan staleness: UP TO DATE / STALE (v[plan] vs v[current])

[Critic findings if any]
```

---

# --fast Mode
For single-feature additions:
- Skip User Stories table (inline in feature row)
- Skip Technology Decisions (use existing stack)
- Generate 3 ACs minimum: 1 happy + 1 error + 1 NFR
- Skip Critic coverage check (only vague language scan)
- Plan: 1–2 waves, no thin-slice ordering required
- Token budget: ~12K

---

## Token cost report (print at end)

Measure actual cost:
1. Estimate input tokens per file: `Math.ceil((chars / (baseDivisor − densityPenalty)) × 1.05)` — prose/md=4.0, standard code=3.5, Go/Rust/C=3.2, JSON/YAML=3.2, minified=2.7; densityPenalty: symbol-dense=0.3, normal=0.1, sparse=0.0. Sum all files = input tokens.
2. Estimate output tokens (prose-heavy command): `Math.ceil((outputChars / 3.9) × 1.05)` = output tokens
3. Update `STATE.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Spec + plan ready — Phase [N] v[N]  ·  [N] ACs  ·  [N] waves  ·  [N] tasks
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in PREFERENCES.md):
```
Token Cost — /buildflow-spec
─────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens   (REQUIREMENTS + DESIGN + ACCEPTANCE + PLAN + VERIFICATION)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

Because spec+plan is a major phase boundary, recommend clearing the AI session before the next command.

```
──────────────────────────────────────────────────
→ Next:  /buildflow-discuss
   Why:  Review the generated spec and plan — clarify any doubts before building
   Or:   /buildflow-build  — skip discuss and start executing wave 1
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If spec is NOT locked yet (still in review): `→ Next: /buildflow-spec` (continue review and lock).
If spec was amended and plan is now stale: `→ Next: /buildflow-spec --update` (regenerate plan against new decisions).

## Token Budget: ~40K (full) / ~12K (--fast)
