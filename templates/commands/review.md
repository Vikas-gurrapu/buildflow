---
name: buildflow-review
max_context_kb: 40
model_tier: light
description: Parallel multi-angle review â€” spec-only gate before build, or full code review after build
allowed-tools: Read, Write, Grep, Glob, Agent
agent: reviewer
---

# /buildflow-review

Parallel review using multiple focused reviewers. Each reviewer gets a scoped context packet and a single lens â€” no reviewer tries to catch everything.

**Default:** all reviewers run in parallel using the Agent tool. Results are synthesized into a single report.
**Fallback (only if the host tool does not support the Agent tool):** reviewers run sequentially in the same session. Same report format.

## Usage
- `/buildflow-review --spec-only` â€” review SPEC.md + ACCEPTANCE.md + PLAN.md before build starts (pre-build gate)
- `/buildflow-review` â€” review implemented code against spec after build (post-build gate)
- `/buildflow-review --wave <N>` â€” review a single wave's implementation only
- `/buildflow-review --fix` â€” apply low-risk findings automatically after review

## Context Packet (loaded by orchestrator before spawning)
- `.buildflow/MEMORY.md` (app_name, current_epic, spec_version, locale_support, local_support)
- `.buildflow/PREFERENCES.md` (git.permission only)
- `.buildflow/epics/[epic]/STATE.md`
- Mode-specific context loaded per agent (see below)

---

## --spec-only Mode (pre-build gate)

Run before `/buildflow-build`. Reviews the spec artifacts â€” not code. Catches spec problems at the cheapest moment.

### Step SR0: Load Spec Artifacts

Read:
- `.buildflow/epics/[epic]/SPEC.md`
- `.buildflow/epics/[epic]/ACCEPTANCE.md`
- `.buildflow/epics/[epic]/PLAN.md`
- `.buildflow/epics/[epic]/waves/wave-*.md`

Confirm spec is locked (`status: LOCKED` in ACCEPTANCE.md). If not locked: block with "Spec not locked â€” run `/buildflow-spec` and approve before reviewing."

**Spec version history** (if `spec_version > 1`): read `changelog` array and show what changed:
```
Spec Version History  Phase [N]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
v1 â†’ v2  (amended [date] by user)
  Changed ACs: AC-003, AC-007
  Reason: "[user's stated reason]"
```

**Plan staleness check:** compare `PLAN.md` spec_version against current `ACCEPTANCE.md` version. If stale â€” flag which tasks reference changed ACs before spawning reviewers.

---

### Step SR1: Spawn 4 Parallel Spec Reviewers

**Shared preamble — extract once, pass to every reviewer:**
```
app_name: [from MEMORY.md]
current_epic: [from STATE.md]
spec_version: v[from ACCEPTANCE.md]
```
Each reviewer receives this preamble + its own task-specific context only (no full codebase).

#### Agent SR-A â€” AC Completeness Reviewer
**Lens:** Are the acceptance criteria complete, unambiguous, and testable?
**Context:** `ACCEPTANCE.md`, `SPEC.md` (Part 1: Requirements section only), `.buildflow/codebase/TESTING.md`

Check:
- Every feature in SPEC.md has at least 2 ACs (1 happy path + 1 failure/edge case)
- Every user story US-XX is referenced in at least one AC
- No vague language: `correctly` `properly` `works` `fast` `good` `should` `appropriate` â€” flag each instance with a suggested replacement
- Every AC is binary (pass/fail) â€” flag any AC with subjective or partial outcomes
- Every AC references a specific observable outcome (not just "it works")
- Every AC is verifiable using the test framework and conventions in `TESTING.md` â€” flag ACs that require test types not supported by the project's current setup

Output: list of findings with AC ID, issue type, and suggested fix.

---

#### Agent SR-B â€” Technical Design Reviewer
**Lens:** Is the technical design sound and buildable?
**Context:** `SPEC.md` (Part 2: Technical Design section), `PLAN.md`, `.buildflow/codebase/PATTERNS.md`, `.buildflow/codebase/CODEBASE.md`, `.buildflow/codebase/DEPENDENCIES.md`

Check:
- Component map entries all map to at least one feature â€” flag orphaned components
- API contracts are fully specified (method, request shape, response shape, all status codes, auth)
- Data model changes are sufficient to support all AC outcomes
- Technology decisions don't contradict constraints from SPEC.md Part 1
- No new patterns introduced that conflict with `PATTERNS.md`
- No new paths/layers that conflict with `CODEBASE.md` stack section
- New env vars, external services, or package additions in the spec don't conflict with existing contracts in `DEPENDENCIES.md`
- Wave plan follows thin-slice order (DB â†’ API â†’ UI â†’ tests)
- File ownership map has no conflicts (no file owned by two waves)

Output: list of findings with location (section + line description) and severity.

---

#### Agent SR-C â€” Security & Edge Case Reviewer
**Lens:** Are security requirements and edge cases represented in the spec?
**Adversarial lens:** Assume all user input is hostile and all external systems are untrusted. Think in attack vectors first, happy paths second. A missing AC for a failure case is a spec defect, not an edge case to handle later.
**Context:** `ACCEPTANCE.md`, `SPEC.md` (API Contracts + NFRs), `.buildflow/codebase/RISKS.md`, `.buildflow/codebase/intel.json` (locale_support, local_support fields only)

Check:
- Every authenticated endpoint has an AC for the unauthenticated case (401)
- Every user input has an AC for invalid/boundary input (validation failure)
- Every file upload endpoint has ACs for type validation and size limit
- NFR section covers security requirements relevant to the feature (auth, rate limiting, CSRF if applicable)
- Known hotspot files from RISKS.md that this feature touches â€” do ACs account for their risk?
- No secrets or credentials referenced in ACs or spec narrative
- If `locale_support` or `local_support` is set in `intel.json`: ACs exist for default locale, fallback, and catalog sync

Output: list of missing security ACs and edge cases, each with suggested AC text.

---

#### Agent SR-D â€” Plan Feasibility Reviewer
**Lens:** Can this plan actually be executed as written?
**Context:** `PLAN.md`, `waves/wave-*.md`, `ACCEPTANCE.md`

Check:
- Every AC is covered by at least one task in the wave files â€” flag uncovered ACs
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
Spec Review Report â€” [feature] v[spec_version]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Reviewers: AC Completeness Â· Technical Design Â· Security Â· Plan Feasibility
Mode: spec-only (pre-build gate)

BLOCKING (must fix before build)
  [SR-A] AC-005: "uploads correctly" â€” vague. Suggest: "file appears in gallery within 2s"
  [SR-C] AC missing: POST /users/:id/photo â€” no AC for unauthenticated case (401)
  [SR-D] Wave 2 Task "Upload handler" â€” AC-007 uncovered by any task

ADVISORY (fix recommended, not blocking)
  [SR-B] Component "PhotoProcessor" has no linked feature â€” orphaned in Component Map
  [SR-D] Task "Integrate S3" is XL â€” consider splitting or running /buildflow-think first

PASS
  [SR-A] AC vague language: NONE
  [SR-B] File ownership map: no conflicts
  [SR-C] Auth edge cases: all endpoints covered
  [SR-D] Thin-slice order: ENFORCED

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Verdict: BLOCKED â€” 3 blocking findings must be resolved before build
  (or)
Verdict: ADVISORY â€” no blockers, 2 advisory items worth reviewing
  (or)
Verdict: PASS â€” spec is review-clean
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

### Step SR3: Resolution Gate

If BLOCKED:
- Show each blocking finding with suggested fix
- Ask: "Fix these before building? [Y] to apply fixes, [N] to review manually"
- If Y and `--fix` flag: apply low-risk fixes (vague language replacements, add missing ACs) using the Write tool; flag structural issues (missing tasks, uncovered ACs) for manual resolution
- Do not proceed to build until all BLOCKING findings are resolved or explicitly overridden

If ADVISORY or PASS:
```
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-build
   Why:  Spec review passed â€” safe to start executing wave 1
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

Write review record to `.buildflow/epics/[epic]/APPROVALS.md`:
```markdown
## Spec Review â€” v[spec_version] â€” [datetime]
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

If `--wave <N>`: scope to wave-N.md tasks and the files they touched only.
If no flag: scope to the last completed wave by default. Loading all waves at once risks blowing the context window â€” only expand to all waves if the user explicitly requests a full-epic review.

Read:
- `.buildflow/epics/[epic]/ACCEPTANCE.md` (ACs to verify against)
- `.buildflow/epics/[epic]/CHECK.md` (which ACs are already PASS â€” skip re-reviewing those)
- `.buildflow/epics/[epic]/waves/wave-[N].md` (task list + file list for scoped wave)
- `.buildflow/codebase/PATTERNS.md`
- Source files touched in the scoped wave(s)

---

### Step CR1: Spawn 4 Parallel Code Reviewers

**Shared preamble — extract once, pass to every reviewer:**
```
app_name: [from MEMORY.md]
current_epic: [from STATE.md]
spec_version: v[from ACCEPTANCE.md]
scoped_wave: [N or "all"]
changed_files: [list from wave file or git diff]
```
Each reviewer receives this preamble + its own task-specific context only.

#### Agent CR-A â€” Correctness Reviewer
**Lens:** Does the implementation do what the ACs require?
**Context:** `ACCEPTANCE.md`, `SPEC.md` (Error Response Format section only), wave file(s), source files touched

Check each AC:
- Can this AC pass given the current implementation?
- Are all happy-path behaviors implemented?
- Are all error/edge cases handled (validation, null, boundary conditions)?
- Are error responses consistent with the Error Response Format in SPEC.md?

Flag: AC ID + what's missing or wrong in the implementation.

---

#### Agent CR-B â€” Security Reviewer
**Lens:** Does the implementation introduce security vulnerabilities?
**Adversarial lens:** Assume every input field is an injection attempt, every unauthenticated request is deliberate, and every error message is a potential information leak. Review as someone who has investigated production breaches â€” not as someone checking a compliance checklist.
**Context:** source files touched, `SPEC.md` (API Contracts + auth requirements), `.buildflow/codebase/RISKS.md`

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

#### Agent CR-C â€” Patterns & Architecture Reviewer
**Lens:** Does the implementation follow established patterns and architecture?
**Context:** `PATTERNS.md`, `CODEBASE.md`, `DEPENDENCIES.md`, source files touched

Check:
- New files follow naming and location conventions from `PATTERNS.md`
- New components/services/repositories follow the established interface pattern
- No new global state introduced without an existing pattern for it
- No new direct DB calls outside the repository layer (if one exists)
- No new paths/layers that conflict with `CODEBASE.md` physical layout
- No new env vars, external service calls, or webhook changes without a corresponding update to `DEPENDENCIES.md`
- Locale/local support preserved if `local_support` / `locale_support` is set in `intel.json`

Flag: deviation + pattern it should follow + file reference.

---

#### Agent CR-D â€” Test Coverage Reviewer
**Lens:** Are the ACs verifiable given the tests written?
**Context:** `ACCEPTANCE.md`, `CHECK.md` (skip ACs already marked PASS), wave file(s), test files in the touched scope, `.buildflow/codebase/TESTING.md`

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
Code Review Report â€” [feature] Wave [N] / All Waves
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Reviewers: Correctness Â· Security Â· Patterns & Architecture Â· Test Coverage

CRITICAL
  [CR-B] src/routes/photo.ts:42 â€” A01 Broken Access Control: no auth middleware on POST /users/:id/photo

BLOCKING
  [CR-A] AC-005 not satisfied: gallery refresh not triggered after upload (src/components/Gallery.tsx)
  [CR-D] AC-007 has no test â€” add integration test for 413 response

ADVISORY
  [CR-C] src/services/PhotoService.ts: direct DB call outside repository layer (PATTERNS.md: use PhotoRepository)
  [CR-D] AC-NF-001 (p95 latency) has no load test or measurement method noted

PASS
  [CR-B] No hardcoded secrets
  [CR-C] File naming and location conventions: OK
  [CR-A] Error response format: consistent across all endpoints

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Verdict: BLOCKED â€” 1 critical, 2 blocking findings
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

### Step CR3: Resolution Gate

If CRITICAL or BLOCKED:
- List findings with file + line + fix suggestion
- If `--fix` flag: apply ADVISORY and LOW-RISK fixes automatically; flag CRITICAL/BLOCKING for manual resolution
- Do not proceed to ship until all CRITICAL and BLOCKING findings resolved

If ADVISORY or PASS:
```
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-check
   Why:  Code review passed â€” verify all ACs before shipping
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

Write review record to `.buildflow/epics/[epic]/APPROVALS.md`:
```markdown
## Code Review â€” Wave [N] / All â€” [datetime]
- **Verdict:** [BLOCKED / ADVISORY / PASS]
- **Reviewers:** 4 parallel (Correctness, Security, Patterns, Test Coverage)
- **Critical:** [N] Â· **Blocking:** [N] Â· **Advisory:** [N]
- **Auto-fixed:** [N items â€” or none]
```

---

## Circuit Breaker (Agent tool mode)

When running in parallel agent mode, each agent is bounded by its scoped context packet. If any agent:
- Exceeds its context without producing output â†’ synthesizer marks that reviewer's section as `INCOMPLETE â€” re-run sequentially`
- Produces output that conflicts with another reviewer's finding â†’ synthesizer flags the conflict explicitly and asks the user to arbitrate

No agent has access to the full codebase â€” only the files in its context packet. This is the primary token guard.

---

## Guided Next Step

After `--spec-only`:
```
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-build
   Why:  Spec review passed â€” start executing wave 1
   Or:   /buildflow-discuss â€” revisit ambiguous spec decisions before building
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

After default (post-build):
```
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-check
   Why:  Code review passed â€” verify all ACs before shipping
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```


