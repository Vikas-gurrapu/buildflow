---
name: buildflow-review
description: Parallel multi-angle review — spec-only gate before build, or full code review after build
allowed-tools: Read, Write, Grep, Glob, Agent
agent: reviewer
---

# /buildflow-review

Parallel review using multiple focused reviewers. Each reviewer gets a scoped context packet and a single lens — no reviewer tries to catch everything.

**Default:** all reviewers run in parallel using the Agent tool. Results are synthesized into a single report.
**Fallback (only if the host tool does not support the Agent tool):** reviewers run sequentially in the same session. Same report format.

## Usage
- `/buildflow-review --spec-only` — review SPEC.md + ACCEPTANCE.md + PLAN.md before build starts (pre-build gate)
- `/buildflow-review` — review implemented code against spec after build (post-build gate)
- `/buildflow-review --wave <N>` — review a single wave's implementation only
- `/buildflow-review --fix` — apply low-risk findings automatically after review

## Context Packet (loaded by orchestrator before spawning)
- `.buildflow/MEMORY.md` (app_name, current_epic, spec_version)
- `.buildflow/epics/[epic]/STATE.md`
- Mode-specific context loaded per agent (see below)

---

## --spec-only Mode (pre-build gate)

Run before `/buildflow-build`. Reviews the spec artifacts — not code. Catches spec problems at the cheapest moment.

### Step SR0: Load Spec Artifacts

Read:
- `.buildflow/epics/[epic]/SPEC.md`
- `.buildflow/epics/[epic]/ACCEPTANCE.md`
- `.buildflow/epics/[epic]/PLAN.md`
- `.buildflow/epics/[epic]/waves/wave-*.md`

Confirm spec is locked (`status: LOCKED` in ACCEPTANCE.md). If not locked: block with "Spec not locked — run `/buildflow-spec` and approve before reviewing."

**Spec version history** (if `spec_version > 1`): read `changelog` array and show what changed:
```
Spec Version History  Phase [N]
────────────────────────────────
v1 → v2  (amended [date] by user)
  Changed ACs: AC-003, AC-007
  Reason: "[user's stated reason]"
```

**Plan staleness check:** compare `PLAN.md` spec_version against current `ACCEPTANCE.md` version. If stale — flag which tasks reference changed ACs before spawning reviewers.

---

### Step SR1: Spawn 4 Parallel Spec Reviewers

#### Agent SR-A — AC Completeness Reviewer
**Lens:** Are the acceptance criteria complete, unambiguous, and testable?
**Context:** `ACCEPTANCE.md`, `SPEC.md` (Part 1: Requirements section only)

Check:
- Every feature in SPEC.md has at least 2 ACs (1 happy path + 1 failure/edge case)
- Every user story US-XX is referenced in at least one AC
- No vague language: `correctly` `properly` `works` `fast` `good` `should` `appropriate` — flag each instance with a suggested replacement
- Every AC is binary (pass/fail) — flag any AC with subjective or partial outcomes
- Every AC references a specific observable outcome (not just "it works")

Output: list of findings with AC ID, issue type, and suggested fix.

---

#### Agent SR-B — Technical Design Reviewer
**Lens:** Is the technical design sound and buildable?
**Context:** `SPEC.md` (Part 2: Technical Design section), `PLAN.md`, `.buildflow/codebase/PATTERNS.md`, `.buildflow/codebase/CODEBASE.md`

Check:
- Component map entries all map to at least one feature — flag orphaned components
- API contracts are fully specified (method, request shape, response shape, all status codes, auth)
- Data model changes are sufficient to support all AC outcomes
- Technology decisions don't contradict constraints from SPEC.md Part 1
- No new patterns introduced that conflict with `PATTERNS.md`
- No new paths/layers that conflict with `CODEBASE.md` stack section
- Wave plan follows thin-slice order (DB → API → UI → tests)
- File ownership map has no conflicts (no file owned by two waves)

Output: list of findings with location (section + line description) and severity.

---

#### Agent SR-C — Security & Edge Case Reviewer
**Lens:** Are security requirements and edge cases represented in the spec?
**Context:** `ACCEPTANCE.md`, `SPEC.md` (API Contracts + NFRs), `.buildflow/codebase/RISKS.md`

Check:
- Every authenticated endpoint has an AC for the unauthenticated case (401)
- Every user input has an AC for invalid/boundary input (validation failure)
- Every file upload endpoint has ACs for type validation and size limit
- NFR section covers security requirements relevant to the feature (auth, rate limiting, CSRF if applicable)
- Known hotspot files from RISKS.md that this feature touches — do ACs account for their risk?
- No secrets or credentials referenced in ACs or spec narrative
- If locale support is flagged in MEMORY.md: ACs exist for default locale, fallback, and catalog sync

Output: list of missing security ACs and edge cases, each with suggested AC text.

---

#### Agent SR-D — Plan Feasibility Reviewer
**Lens:** Can this plan actually be executed as written?
**Context:** `PLAN.md`, `waves/wave-*.md`, `ACCEPTANCE.md`

Check:
- Every AC is covered by at least one task in the wave files — flag uncovered ACs
- No task is XL size without a note explaining why it wasn't split
- Every HARD dependency between waves is correct (A cannot compile without B)
- No circular dependencies
- External dependency checklist is complete (all env vars, services named)
- Every non-trivial task has an implementation approach with alternatives considered
- Test tasks are co-located with implementation tasks (post-change tests in same wave)

Output: list of feasibility gaps with wave number and task reference.

---

### Step SR2: Synthesize Spec Review Report

Collect all 4 agents' outputs. Deduplicate overlapping findings. Classify by severity:

```
Spec Review Report — [feature] v[spec_version]
────────────────────────────────────────────────────────
Reviewers: AC Completeness · Technical Design · Security · Plan Feasibility
Mode: spec-only (pre-build gate)

BLOCKING (must fix before build)
  [SR-A] AC-005: "uploads correctly" — vague. Suggest: "file appears in gallery within 2s"
  [SR-C] AC missing: POST /users/:id/photo — no AC for unauthenticated case (401)
  [SR-D] Wave 2 Task "Upload handler" — AC-007 uncovered by any task

ADVISORY (fix recommended, not blocking)
  [SR-B] Component "PhotoProcessor" has no linked feature — orphaned in Component Map
  [SR-D] Task "Integrate S3" is XL — consider splitting or running /buildflow-think first

PASS
  [SR-A] AC vague language: NONE
  [SR-B] File ownership map: no conflicts
  [SR-C] Auth edge cases: all endpoints covered
  [SR-D] Thin-slice order: ENFORCED

────────────────────────────────────────────────────────
Verdict: BLOCKED — 3 blocking findings must be resolved before build
  (or)
Verdict: ADVISORY — no blockers, 2 advisory items worth reviewing
  (or)
Verdict: PASS — spec is review-clean
────────────────────────────────────────────────────────
```

### Step SR3: Resolution Gate

If BLOCKED:
- Show each blocking finding with suggested fix
- Ask: "Fix these before building? [Y] to apply fixes, [N] to review manually"
- If Y and `--fix` flag: apply low-risk fixes (vague language replacements, add missing ACs) using the Write tool; flag structural issues (missing tasks, uncovered ACs) for manual resolution
- Do not proceed to build until all BLOCKING findings are resolved or explicitly overridden

If ADVISORY or PASS:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-build
   Why:  Spec review passed — safe to start executing wave 1
──────────────────────────────────────────────────
```

Write review record to `.buildflow/epics/[epic]/APPROVALS.md`:
```markdown
## Spec Review — v[spec_version] — [datetime]
- **Verdict:** [BLOCKED / ADVISORY / PASS]
- **Reviewers:** 4 parallel (AC, Technical Design, Security, Plan Feasibility)
- **Blocking findings:** [N]
- **Advisory findings:** [N]
- **Resolved before build:** [Y/N]
```

---

## Default Mode (post-build code review)

Run after `/buildflow-build` completes a wave or all waves. Reviews implemented code against the spec.

### Step CR0: Determine Scope

If `--wave <N>`: load wave-N.md tasks and the files they touched only.
If no flag: load all waves and all files modified in this epic.

Read:
- `.buildflow/epics/[epic]/ACCEPTANCE.md` (ACs to verify against)
- `.buildflow/epics/[epic]/waves/wave-[N].md` (task list + file list)
- `.buildflow/codebase/PATTERNS.md`
- Source files touched in the target wave(s)

---

### Step CR1: Spawn 4 Parallel Code Reviewers

#### Agent CR-A — Correctness Reviewer
**Lens:** Does the implementation do what the ACs require?
**Context:** `ACCEPTANCE.md`, wave file(s), source files touched

Check each AC:
- Can this AC pass given the current implementation?
- Are all happy-path behaviors implemented?
- Are all error/edge cases handled (validation, null, boundary conditions)?
- Are error responses consistent with the Error Response Format in SPEC.md?

Flag: AC ID + what's missing or wrong in the implementation.

---

#### Agent CR-B — Security Reviewer
**Lens:** Does the implementation introduce security vulnerabilities?
**Context:** source files touched, `SPEC.md` (API Contracts + auth requirements)

Check (scoped to changed files only):
- Auth middleware applied to all routes that SPEC.md marks auth: yes
- No SQL string concatenation (parameterized queries only)
- No user-controlled values passed to exec/eval/spawn
- Input validation present on all user-facing endpoints
- No secrets or credentials hardcoded
- File uploads: type + size validation present
- Error responses don't leak stack traces or internal details

Flag: file + line + OWASP category + severity (CRITICAL / HIGH / MEDIUM / LOW).

---

#### Agent CR-C — Patterns & Architecture Reviewer
**Lens:** Does the implementation follow established patterns and architecture?
**Context:** `PATTERNS.md`, `CODEBASE.md`, source files touched

Check:
- New files follow naming and location conventions from `PATTERNS.md`
- New components/services/repositories follow the established interface pattern
- No new global state introduced without an existing pattern for it
- No new direct DB calls outside the repository layer (if one exists)
- No new paths/layers that conflict with `CODEBASE.md` physical layout
- Locale/local support preserved if `local_support` / `locale_support` is set in MEMORY.md

Flag: deviation + pattern it should follow + file reference.

---

#### Agent CR-D — Test Coverage Reviewer
**Lens:** Are the ACs verifiable given the tests written?
**Context:** `ACCEPTANCE.md`, wave file(s), test files in the touched scope

Check:
- Every non-trivial AC has a corresponding test (unit or integration)
- Tests assert specific observable outcomes (not just "it doesn't throw")
- Happy path and failure/edge case both tested per feature
- Tests don't mock the layer they're testing (service tests shouldn't mock the service)
- AC-NF (non-functional) requirements have a test or a measurement method noted

Flag: AC ID + missing test description + suggested test approach.

---

### Step CR2: Synthesize Code Review Report

```
Code Review Report — [feature] Wave [N] / All Waves
────────────────────────────────────────────────────────
Reviewers: Correctness · Security · Patterns & Architecture · Test Coverage

CRITICAL
  [CR-B] src/routes/photo.ts:42 — A01 Broken Access Control: no auth middleware on POST /users/:id/photo

BLOCKING
  [CR-A] AC-005 not satisfied: gallery refresh not triggered after upload (src/components/Gallery.tsx)
  [CR-D] AC-007 has no test — add integration test for 413 response

ADVISORY
  [CR-C] src/services/PhotoService.ts: direct DB call outside repository layer (PATTERNS.md: use PhotoRepository)
  [CR-D] AC-NF-001 (p95 latency) has no load test or measurement method noted

PASS
  [CR-B] No hardcoded secrets
  [CR-C] File naming and location conventions: OK
  [CR-A] Error response format: consistent across all endpoints

────────────────────────────────────────────────────────
Verdict: BLOCKED — 1 critical, 2 blocking findings
────────────────────────────────────────────────────────
```

### Step CR3: Resolution Gate

If CRITICAL or BLOCKED:
- List findings with file + line + fix suggestion
- If `--fix` flag: apply ADVISORY and LOW-RISK fixes automatically; flag CRITICAL/BLOCKING for manual resolution
- Do not proceed to ship until all CRITICAL and BLOCKING findings resolved

If ADVISORY or PASS:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Code review passed — verify all ACs before shipping
──────────────────────────────────────────────────
```

Write review record to `.buildflow/epics/[epic]/APPROVALS.md`:
```markdown
## Code Review — Wave [N] / All — [datetime]
- **Verdict:** [BLOCKED / ADVISORY / PASS]
- **Reviewers:** 4 parallel (Correctness, Security, Patterns, Test Coverage)
- **Critical:** [N] · **Blocking:** [N] · **Advisory:** [N]
- **Auto-fixed:** [N items — or none]
```

---

## Circuit Breaker (Agent tool mode)

When running in parallel agent mode, each agent is bounded by its scoped context packet. If any agent:
- Exceeds its context without producing output → synthesizer marks that reviewer's section as `INCOMPLETE — re-run sequentially`
- Produces output that conflicts with another reviewer's finding → synthesizer flags the conflict explicitly and asks the user to arbitrate

No agent has access to the full codebase — only the files in its context packet. This is the primary token guard.

---

## Guided Next Step

After `--spec-only`:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-build
   Why:  Spec review passed — start executing wave 1
   Or:   /buildflow-discuss — revisit ambiguous spec decisions before building
──────────────────────────────────────────────────
```

After default (post-build):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  Code review passed — verify all ACs before shipping
──────────────────────────────────────────────────
```
