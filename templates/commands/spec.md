---
name: buildflow-spec
description: Generate user-story-backed PRD, Technical Design, and Acceptance Criteria with self-critique pass
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-spec

Spec-Driven Development layer. Produces formally structured, self-critiqued spec artifacts before any code is planned or written. Every plan task, every build output, and every ship gate references these docs.

Run after `/buildflow-start`, before `/buildflow-plan`.

## Usage
- `/buildflow-spec` — full spec from vision
- `/buildflow-spec prd` — regenerate PRD only
- `/buildflow-spec tdd` — regenerate TDD only
- `/buildflow-spec acceptance` — regenerate ACs only
- `/buildflow-spec --fast` — minimal spec for small features (single screen / endpoint)
- `/buildflow-spec --review` — critique existing specs without regenerating

## Context Packet
- `.buildflow/core/vision.md`
- `.buildflow/phases/[N]/STATE.md` (if current phase exists - resume status, decisions, risks, next command)
- `.buildflow/codebase/STACK.md` (if exists — runtime, frameworks, critical dependencies)
- `.buildflow/codebase/STRUCTURE.md` (if exists — physical layout and entry points)
- `.buildflow/codebase/INTEGRATIONS.md` (if exists — external services, env contracts, webhooks)
- `.buildflow/codebase/TESTING.md` (if exists — test framework and validation patterns)
- `.buildflow/codebase/CONCERNS.md` (if exists — risks, debt, blind spots)
- `.buildflow/codebase/PATTERNS.md` (if exists — align spec with existing architecture)
- `.buildflow/codebase/FEATURES.md` (if exists — existing capability inventory, including local and locale support)
- `.buildflow/codebase/intel.json` fields `features[]`, `local_support`, and `locale_support` (if exists)
- `.buildflow/memory/light.md` (app_name, framework, phase only)
- `.buildflow/specs/` (if regenerating)

---

## Phase State Resume
Read `.buildflow/core/state.md` and `.buildflow/memory/light.md`. If a current phase exists, read `.buildflow/phases/[N]/STATE.md`.

Use `STATE.md` to avoid making the user restate prior research, decisions, risks, or open questions. If it says the spec is already locked and the user did not ask for an amendment/review, continue to the guided next step instead of regenerating.

Before exiting, create or update `.buildflow/phases/[N]/STATE.md` with:
- Current State: `Status: spec_locked` when locked, or `Status: spec_draft` when still in review
- Decisions: major product/technical decisions from PRD/TDD
- Files That Matter: `PRD.md`, `TDD.md`, `acceptance.md`, and important mapped codebase docs
- Next Command: `/buildflow-plan` when locked, otherwise `/buildflow-spec`
- Risks / Open Questions: Known Risks plus unresolved spec questions
- Test Strategy: acceptance criteria verification approach and constraints from `TESTING.md`

---

## Step 1: Validate Vision
Read `.buildflow/core/vision.md`.
If empty: "Run `/buildflow-start` first."

If `PATTERNS.md` exists: note the existing architectural style (component structure, naming, API patterns).
The TDD must align with these — don't invent new patterns unless explicitly asked.

If focused codebase maps exist:
- Use `STACK.md` to constrain runtime/framework/dependency choices.
- Use `STRUCTURE.md` to avoid inventing paths or layers that conflict with the repo layout.
- Use `INTEGRATIONS.md` to preserve external service/env/webhook contracts.
- Use `TESTING.md` to make acceptance criteria verifiable with existing test conventions.
- Use `CONCERNS.md` to surface known risks and blind spots as constraints.

If `FEATURES.md` or `intel.json.features[]` exists:
- List existing implemented/partial/docs-only capabilities before writing scope.
- Treat implemented features as existing system constraints, not new scope.
- Preserve `local_support` unless the user explicitly asks to remove or replace it.
- Preserve `locale_support` unless the user explicitly asks to remove or replace i18n/localization behavior.
- If the requested phase touches local support, add explicit ACs for local run/dev workflow behavior.
- If the requested phase touches locale support, add explicit ACs for default locale, supported locale catalogs, fallback behavior, JSON translation imports, localized docs, and label/copy catalogs.

---

## Step 1b: Load Phase History
If `phases/*/SHIPPED.md` files exist, load the last 2. Extract:
- Already-shipped features → exclude from this spec's scope (don't re-spec shipped ACs)
- Open debt from prior phases → surface as constraints in new spec
- Prior architecture decisions → TDD must not contradict them

Print: "Prior phases: [N]. Already shipped: [brief list]. Open debt: [N items]."
If no history: skip silently.

---

## Step 2: Clarify (one round, all questions at once)
Ask only what vision.md left unanswered. Max 5 questions:
- What does success look like for the **user** — as a measurable outcome, not a feature list?
- What is explicitly **out of scope** this phase?
- Any **hard constraints**: tech stack, deadline, team size, compliance?
- Any **third-party integrations** required?
- If `--fast`: "Describe the single feature in one sentence."

---

## Step 3: Generate PRD
Use the **Write tool** to create `.buildflow/specs/PRD.md`. Do not output the content as text — write it to disk. Create `.buildflow/specs/` directory first if it doesn't exist.

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
| US-02 | ... | ... |

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

## Step 4: Generate TDD
Use the **Write tool** to create `.buildflow/specs/TDD.md`. Do not output the content as text — write it to disk.

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
| [area] | [choice] | [why — cite constraint or principle] | [what else, why not] | easy / hard |

## Non-Functional Requirements
| Type | Requirement | Measurement Method |
|------|------------|-------------------|
| Performance | [endpoint] responds in < [Nms] at [N] rps | Load test / APM |
| Security | [specific requirement — not "secure"] | Audit / pen test |
| Accessibility | WCAG [2.1 AA / 2.1 AAA] | Automated + manual |
| Availability | [N]% uptime | Monitoring |
| Data retention | [N] days | Automated policy |

## Known Risks
| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|-----------|-------|
| [risk] | low/med/high | low/med/high | [concrete action] | dev / PM / ops |
```

---

## Step 5: Generate Acceptance Criteria
Use the **Write tool** to create `.buildflow/specs/acceptance.md`. Do not output the content as text — write it to disk.

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
- AC-004: Given [concurrent/race/timeout scenario], when [...], then [...]

## [Feature F-02: name]  →  US-03
- AC-005: Given [...], when [...], then [...]
- AC-006 (edge): Given [...], when [...], then [...]

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
- Every feature in PRD has at least 2 ACs (1 happy + 1 error/edge) — flag if not
- Every user story US-XX is referenced in at least one AC's feature section — flag orphans
- Every component in TDD maps to at least one PRD feature — flag orphans
- Every NFR in TDD has a corresponding AC-NF — flag gaps

### Testability Check
For each AC, verify it can be answered as a pass/fail automated test or explicit manual step.
Flag any AC that requires human judgment to evaluate.

### Consistency Check
- API contracts in TDD match any referenced endpoints in ACs
- Data model changes in TDD are sufficient to support all AC outcomes
- Technology decisions don't contradict any constraints in PRD

### Critic Report
Show the user:
```
Spec Critic Report
──────────────────
Vague language:   [N found — fixed N, flagged N]
Coverage gaps:    [list any orphaned features/stories/components]
Testability:      [list any ACs needing rework]
Consistency:      [any TDD/PRD conflicts]
Overall quality:  STRONG / NEEDS REVISION
```

---

## Step 7: User Review Gate
Show summary of all three specs + Critic Report. Ask:

> "Specs ready for review. Critic score: [STRONG / NEEDS REVISION]
> Approve to lock, or tell me what to revise."

- **Revise:** apply changes to the named section, increment `spec_version` in `acceptance.md` frontmatter, append a changelog entry, re-run Critic pass, repeat Step 7.

- **Approve:** lock specs.
  1. Update `acceptance.md` frontmatter:
     ```yaml
     status: LOCKED
     approved_by: [user identifier — name or "user" if unknown]
     approved_at: [ISO datetime]
     ```
  2. Append approval record to `.buildflow/specs/approvals.md` (create if not exists):
     ```markdown
     ## Phase [N] — v[spec_version] — [datetime]
     - **Approved by:** [user]
     - **AC count:** [N]
     - **Critic score:** STRONG / REVISED
     - **Revision cycles:** [N]
     - **Summary:** [one line — what this spec covers]
     ```
  3. Update `light.md`:
     ```yaml
     spec_status: locked
     spec_version: [N]
     spec_phase: [N]
     ac_count: [N]
     us_count: [N]
     spec_critic: strong/revised
     ```

Do not proceed until user approves. The approval record in `approvals.md` is permanent — never delete or overwrite prior entries.

---

## Step 7b: Spec Amendment (when spec must change after locking)

If the user requests a spec change AFTER `spec_status: locked` (mid-phase amendment):

1. Show what is changing and why:
   ```
   Spec Amendment Request
   ──────────────────────
   Phase: [N]  Current version: v[N]
   Requesting: [what the user wants to change]

   Impact analysis:
   - ACs affected: [list AC IDs that will change or be removed]
   - Plan tasks that reference these ACs: [list from PLAN.md if it exists]
   - Waves that will need re-planning: [list]

   Risk: [LOW / MEDIUM / HIGH — based on how many plan tasks are invalidated]
   ```

2. Ask for explicit confirmation:
   > "This amendment affects [N] ACs and [N] plan tasks. Confirm to proceed. Type 'amend' to continue."

3. On confirmation:
   - Increment `spec_version` in frontmatter
   - Update the affected ACs
   - Append to changelog:
     ```yaml
     - version: [N+1]
       date: [today]
       author: [user]
       summary: "Amendment: [brief description of change]"
       amended_acs: [AC-003, AC-007]
       reason: "[user's stated reason]"
     ```
   - Update `approved_at` to now (re-approval of amended version)
   - Append to `approvals.md`:
     ```markdown
     ## Phase [N] — v[N+1] — [datetime] — AMENDMENT
     - **Amended by:** [user]
     - **Changed ACs:** [AC-003, AC-007]
     - **Reason:** [user's stated reason]
     - **Plan impact:** [N tasks invalidated]
     ```
   - Update `light.md`: `spec_version: [N+1]`

4. If a PLAN.md exists for this phase: flag it as stale.
   ```
   ⚠ PLAN STALE — spec amended to v[N+1]
   Tasks referencing [AC-003, AC-007] may no longer be valid.
   Run /buildflow-plan to regenerate affected waves before building.
   ```

---

## --review Mode (`/buildflow-spec --review`)

Critiques existing specs without regenerating. Also shows version diff if the spec has been amended.

### Review steps:

**1. Load and parse current spec:**
Read `acceptance.md` frontmatter: `spec_version`, `status`, `changelog`.

**2. Spec diff (if spec_version > 1):**
Read the `changelog` array from `acceptance.md` frontmatter. For each version after v1, reconstruct what changed:

```
Spec Version History  Phase [N]
────────────────────────────────
v1 → v2  (amended 2024-01-15 by user)
  Changed ACs: AC-003, AC-007
  Reason: "Password reset flow redesigned — now uses magic link instead of email code"

  AC-003 before: "Given a registered email, when reset requested, then 6-digit code sent"
  AC-003 after:  "Given a registered email, when reset requested, then magic link sent valid 15min"

  AC-007 before: "Given a valid code, when submitted within 10min, then password updated"
  AC-007 after:  "Given a valid magic link, when clicked within 15min, then password updated"

v2 → v3  (amended 2024-01-18 by user)
  Changed ACs: AC-NF-001
  Reason: "Performance target revised after load test results"

  AC-NF-001 before: "login endpoint responds in < 100ms at 100 rps"
  AC-NF-001 after:  "login endpoint responds in < 200ms at 500 rps"
```

If `spec_version` is 1 (no amendments): "Spec is at v1 — no amendments made."

**3. Re-run Critic pass on current spec** (same as Step 6 in full spec flow):
- Vague language scan
- Coverage check
- Testability check
- Consistency check

**4. Plan staleness check:**
If a `PLAN.md` exists for this phase, compare its recorded `spec_version` against current `acceptance.md` version. If stale, say so and list which tasks reference changed ACs.

**5. Report:**
```
Spec Review  Phase [N]  v[N]
─────────────────────────────
Amendments: [N versions — show brief list]
Critic score: STRONG / NEEDS REVISION
Plan staleness: UP TO DATE / STALE (v[plan] vs v[current])

[Critic findings if any]
```

---

## --fast Mode
For single-feature additions:
- Skip User Stories table (inline in feature row)
- Skip Technology Decisions (use existing stack)
- Generate 3 ACs minimum: 1 happy + 1 error + 1 NFR
- Skip Critic coverage check (only vague language scan)
- Token budget: ~8K

---

## Token cost report (print at end of spec lock)

Measure actual cost:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output from PRD.md + TDD.md + acceptance.md generated ÷ 4 = output tokens
3. Update `state.md → session_tokens_used` by adding this command's cost

Default output (minimal):
```
Spec locked — Phase [N] v[N]  ·  [N] ACs  ·  [N] revision cycles
Session: ~[N]K tokens
```

Verbose output (only if `verbose_context: true` in preferences.md):
```
Token Cost — /buildflow-spec
─────────────────────────────
Spec locked — Phase [N] v[N]
Features: [N]  User stories: [N]  ACs: [N]  Revision cycles: [N]
Context loaded:    ~[N]K tokens   (vision.md + SHIPPED.md files + preferences.md)
Output generated:  ~[N]K tokens   (PRD.md + TDD.md + acceptance.md)
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```
Update `light.md`: `last_spec_tokens: ~[N]K`

## Guided Next Step

Before printing this block, check session context usage. Because a locked spec is a phase boundary, recommend clearing the current AI session after saving `STATE.md` unless context is very small and the user is continuing immediately.

After printing the token line, always close with:

```
──────────────────────────────────────────────────
→ Next:  /buildflow-plan
   Why:  Your spec is locked — translate it into an executable wave plan
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If spec is NOT locked yet (still in review): `→ Next: /buildflow-spec` (continue review and lock).
If spec was amended and plan is now stale: `→ Next: /buildflow-plan` (regenerate plan against new spec version).

## Token Budget: ~20K (full) / ~8K (--fast)
