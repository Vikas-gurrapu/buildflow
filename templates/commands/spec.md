---
name: buildflow-spec
description: Generate formal PRD, Technical Design, and Acceptance Criteria before planning
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-spec

Spec-Driven Development layer. Produces three locked spec artifacts before any code is planned or written. The Architect, Builder, and Reviewer agents all reference these during execution.

Run this after `/buildflow-start` and before `/buildflow-plan`.

## Usage
- `/buildflow-spec` — generate full spec from vision
- `/buildflow-spec prd` — regenerate PRD only
- `/buildflow-spec tdd` — regenerate Technical Design only
- `/buildflow-spec acceptance` — regenerate acceptance criteria only
- `/buildflow-spec --review` — re-read and review existing specs without regenerating

## Context Packet (load only these — nothing else)
- `.buildflow/core/vision.md`
- `.buildflow/memory/light.md` (summary fields only: app_name, framework, phase)
- `.buildflow/specs/` (existing specs if regenerating)

## Step 1: Validate Vision Exists
Read `.buildflow/core/vision.md`.
If empty or missing: "Run /buildflow-start first to capture the project vision."

## Step 2: Clarify Ambiguities
Before writing specs, ask only questions that are unanswered in vision.md:
- What does success look like for the user? (measurable outcome, not a feature)
- What is explicitly OUT of scope for this phase?
- Are there known constraints? (tech stack lock-in, deadline, budget, team size)
- Any third-party integrations required?

Ask all questions at once. Do not ask one at a time.
Maximum 5 questions. Skip any already answered in vision.md.

## Step 3: Generate PRD
Write `.buildflow/specs/PRD.md`:

```markdown
# Product Requirements Document
**App:** [name]  **Phase:** [N]  **Date:** [today]

## Problem Statement
[One paragraph: what problem exists, who has it, why current solutions fail]

## Users
| User Type | Goal | Key Pain Point |
|-----------|------|----------------|
| [type] | [goal] | [pain] |

## Features — In Scope
| ID | Feature | Priority | Success Metric |
|----|---------|----------|----------------|
| F-01 | [name] | Must-have / Should-have / Nice-to-have | [measurable] |

## Out of Scope
- [what we are explicitly NOT building this phase]

## Constraints
- [tech, timeline, team, budget constraints]

## Success Criteria
Phase is complete when:
- [ ] [measurable outcome 1]
- [ ] [measurable outcome 2]
```

## Step 4: Generate Technical Design Doc
Write `.buildflow/specs/TDD.md`:

```markdown
# Technical Design Document
**App:** [name]  **Phase:** [N]  **Date:** [today]

## Architecture Overview
[Brief description of the system architecture]

## Components
| Component | Responsibility | Interface |
|-----------|---------------|-----------|
| [name] | [what it does] | [API / function / event] |

## Data Model
[Key entities and their relationships — use simple table or diagram]

## API Contracts
| Endpoint / Function | Input | Output | Auth Required |
|--------------------|-------|--------|---------------|
| [name] | [type] | [type] | yes/no |

## Technology Decisions
| Decision | Choice | Reason | Alternatives Rejected |
|----------|--------|--------|----------------------|
| [area] | [choice] | [why] | [what else was considered] |

## Known Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| [risk] | low/med/high | low/med/high | [how to mitigate] |
```

## Step 5: Generate Acceptance Criteria
Write `.buildflow/specs/acceptance.md`:

Each AC must be:
- **Testable** — a human or automated test can verify it
- **Binary** — pass or fail, no partial credit
- **Specific** — no vague terms like "works correctly"

```markdown
# Acceptance Criteria
**App:** [name]  **Phase:** [N]  **Date:** [today]

## [Feature F-01 name]
- AC-001: Given [context], when [action], then [outcome]
- AC-002: Given [context], when [action], then [outcome]

## [Feature F-02 name]
- AC-003: Given [context], when [action], then [outcome]

## Non-Functional
- AC-NF-001: [performance/security/accessibility requirement]
```

## Step 6: Spec Review Gate
Show a summary of all three specs. Ask:

> "Do these specs accurately capture what you want to build? (yes / revise [area])"

- If yes: lock specs. Update `light.md`:
  ```yaml
  spec_status: locked
  spec_phase: [N]
  ac_count: [N]
  ```
- If revise: ask what's wrong, update the relevant section, repeat Step 6.

Do not proceed until the user approves.

## Step 7: Next Step
"Specs locked. Run `/buildflow-plan` — the Architect will map tasks to your acceptance criteria."

## Token Budget: ~18K
