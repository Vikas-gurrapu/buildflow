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
- `.buildflow/codebase/PATTERNS.md` (if exists — align spec with existing architecture)
- `.buildflow/memory/light.md` (app_name, framework, phase only)
- `.buildflow/specs/` (if regenerating)

---

## Step 1: Validate Vision
Read `.buildflow/core/vision.md`.
If empty: "Run `/buildflow-start` first."

If `PATTERNS.md` exists: note the existing architectural style (component structure, naming, API patterns).
The TDD must align with these — don't invent new patterns unless explicitly asked.

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
Write `.buildflow/specs/PRD.md`:

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
Write `.buildflow/specs/TDD.md`:

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
Write `.buildflow/specs/acceptance.md`:

**Rules for every AC:**
- Binary — pass or fail only, no partial credit
- Testable — an automated test or explicit manual step can verify it
- Specific — no vague words (see Critic pass below)
- Covers both happy path AND at least one failure/edge case per feature

```markdown
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

- **Approve:** lock specs. Update `light.md`:
  ```yaml
  spec_status: locked
  spec_phase: [N]
  ac_count: [N]
  us_count: [N]
  spec_critic: strong/revised
  ```
- **Revise:** apply changes to the named section, re-run Critic pass, repeat Step 7.

Do not proceed until user approves.

---

## --fast Mode
For single-feature additions:
- Skip User Stories table (inline in feature row)
- Skip Technology Decisions (use existing stack)
- Generate 3 ACs minimum: 1 happy + 1 error + 1 NFR
- Skip Critic coverage check (only vague language scan)
- Token budget: ~8K

---

## Token Budget: ~20K (full) / ~8K (--fast)
