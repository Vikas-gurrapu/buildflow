---
name: buildflow-think
description: Deep research, architecture review, build-vs-buy reasoning, and engineering cognition
allowed-tools: Read, Write, WebSearch
agents: strategist, researcher, synthesizer
---

# /buildflow-think

Research, reasoning, and architecture review. Spawns parallel Researchers when web evidence is needed. Synthesizes conflicting information into a concrete recommendation with confidence score.

Goes beyond research — includes engineering cognition modes for architecture review, build-vs-buy analysis, technical debt assessment, and complexity budgeting.

## Usage
- `/buildflow-think <topic>` — research a specific topic or technology
- `/buildflow-think tech-stack` — compare technology options
- `/buildflow-think risks` — surface technical and product risks
- `/buildflow-think --arch` — architecture review of current codebase or proposed design
- `/buildflow-think --build-vs-buy <capability>` — should we build it or use a library/service?
- `/buildflow-think --debt` — assess current technical debt and prioritize
- `/buildflow-think --complexity` — is the proposed plan too complex for the team/timeline?

## Context Packet
- `.buildflow/core/vision.md`
- `.buildflow/memory/light.md` (app_name, framework, key decisions only)
- `.buildflow/codebase/MAP.md` (for --arch, --debt, --complexity modes)
- `.buildflow/specs/TDD.md` (for --arch mode, if exists)

---

## Standard Research Mode (default)

### Step 1: Clarify Research Goal
If topic is specified, confirm understanding in one sentence.
If open-ended: "What are you trying to decide or understand?"

### Step 2: Decompose into Research Questions
Break the topic into 2–3 specific, answerable sub-questions.
Assign one to each Researcher agent.

### Step 3: Parallel Research
Spawn up to 3 Researcher agents simultaneously, each:
- Answering their specific sub-question
- Finding 2–3 sources
- Rating each source trust: 1 (blog opinion) → 5 (official docs / peer-reviewed)
- Summarizing key findings in bullet points

### Step 4: Synthesize
Synthesizer combines all findings:
- **Consensus:** what all sources agree on
- **Conflicts:** where sources disagree — flag explicitly with each position
- **Gaps:** what the research didn't answer
- **Recommendation:** concrete, actionable, with confidence (1–5)
- **Risks:** what could go wrong with the recommendation

### Step 5: Confidence Gate
If confidence < 3: "Low confidence. Here's what would increase it: [specific gaps to fill]"
If confidence ≥ 4: suggest next step (spec / plan / build)

### Step 6: Save
Write `.buildflow/research/[topic]-[date].md`
Update `light.md` key decisions if a choice was made.

---

## Architecture Review Mode (`--arch`)

Triggered when: designing a new system, evaluating a proposed approach, or onboarding to a codebase.

### Step 1: Load Architecture Context
Read `MAP.md`, `TDD.md` (if exists), `PATTERNS.md`.
If greenfield: work from vision + proposed TDD.

### Step 2: Structural Analysis
Evaluate:
- **Separation of concerns** — do modules have single, clear responsibilities?
- **Coupling** — are modules tightly bound in ways that make changes expensive?
- **Cohesion** — does each module contain related things?
- **Boundaries** — are module boundaries enforced or leaky?
- **Scalability** — will this design hold under 10× the current load/data?

### Step 3: Pattern Consistency
Does the proposed design follow existing patterns in the codebase?
If introducing new patterns: is there a good reason, or is it accidental inconsistency?

### Step 4: Failure Mode Analysis
For each major component, ask: "What happens when this fails?"
- Does the failure cascade?
- Is there a recovery path?
- Will the user see a clear error or silent corruption?

### Step 5: Engineering Smell Detection
Flag any of these if present:
- **God object** — one class/module doing too many things
- **Shotgun surgery** — a single logical change requires edits across many files
- **Primitive obsession** — using raw strings/numbers where domain types would be clearer
- **Anemic model** — data objects with no behavior, all logic in services
- **Circular dependency** — A imports B imports A
- **Distributed monolith** — microservices that can't deploy independently

### Step 6: Architecture Report
```
Architecture Review
───────────────────
Strengths:       [what's well-designed]
Concerns:        [issues with severity: HIGH / MEDIUM / LOW]
Smells detected: [list or NONE]
Failure modes:   [unhandled scenarios]
Recommendation:  [concrete changes or "proceed as-is"]
Confidence:      [1–5]
```

---

## Build vs Buy Mode (`--build-vs-buy <capability>`)

Triggered when evaluating whether to implement a capability in-house or use an external library/service.

### Step 1: Define the Capability
Exact scope: what does this need to do? What are the boundaries?

### Step 2: Research Options
Parallel Researchers investigate:
- **Build** — what would implementation cost? What's the maintenance burden?
- **Buy (OSS)** — what libraries exist? License, maintenance status, community health?
- **Buy (SaaS)** — what services exist? Cost, reliability, vendor lock-in risk?

### Step 3: Evaluation Matrix
| Factor | Build | OSS Library | SaaS |
|--------|-------|-------------|------|
| Time to working | [est] | [est] | [est] |
| Ongoing maintenance | high | low–med | none |
| Customization | full | partial | limited |
| Cost | dev time | free (usually) | $/mo |
| Vendor lock-in | none | low | HIGH |
| Compliance fit | full control | depends | verify |
| Team expertise needed | yes | some | low |

### Step 4: Recommendation
Given project constraints (team size, timeline, compliance from PRD):
- **Recommend:** [build / OSS / SaaS]
- **Reason:** [top 2 factors that drove the decision]
- **Risk:** [biggest downside of this choice]
- **Confidence:** [1–5]

---

## Technical Debt Mode (`--debt`)

### Step 1: Load Hotspots
Read `HOTSPOTS.md`. These are the known high-risk files.

### Step 2: Debt Classification
For each hotspot and any other known issues:

| Item | Type | Impact | Cost to Fix | ROI |
|------|------|--------|------------|-----|
| [issue] | CODE / ARCH / TEST / INFRA | HIGH/MED/LOW | S/M/L/XL | high/med/low |

Debt types:
- **CODE** — complexity, duplication, poor naming
- **ARCH** — wrong abstraction, bad module boundary, circular dep
- **TEST** — missing or shallow test coverage on critical paths
- **INFRA** — outdated deps, missing CI, manual steps that should be automated

### Step 3: Priority Recommendation
Sort by ROI (impact of fixing ÷ cost to fix). Top 3 items to address next.

---

## Complexity Budget Mode (`--complexity`)

Used before a plan is executed to ask: "Is this too much for the team/timeline?"

### Step 1: Load Plan
Read `phases/[N]/PLAN.md`. Sum effort estimates.

### Step 2: Complexity Assessment
```
Complexity Budget Check
───────────────────────
Total estimated effort: [sum]
XL tasks: [N] — [list them]  ← each XL is a risk
External dependencies: [N]   ← each is a coordination cost
New patterns introduced: [N] ← each needs learning time
Files touching hotspots: [N] ← each is higher risk

Verdict: FEASIBLE / RISKY / OVER-SCOPED
```

- **FEASIBLE** — proceed
- **RISKY** — flag XL tasks for `/buildflow-think` before building, consider splitting
- **OVER-SCOPED** — recommend cutting scope, suggest which features to defer

---

## Token Budget: ~30K (standard) / ~35K (--arch or --build-vs-buy) / ~20K (--debt or --complexity)
