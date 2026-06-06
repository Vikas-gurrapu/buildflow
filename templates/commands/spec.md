---
name: buildflow-spec
max_context_kb: 60
model_tier: heavy
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
- `/buildflow-spec --review` — removed; use `/buildflow-review --spec-only` for pre-build spec review (4 parallel reviewers, BLOCKED/ADVISORY/PASS verdict)
- `/buildflow-spec --update` — apply locked decisions from CONTEXT.md to existing spec and plan (called automatically by `/buildflow-discuss`)
- `/buildflow-spec --strict` — mark this phase as strict mode: every task must trace to a SPEC.md component or API contract; `/buildflow-check --strict` mandatory before ship
- `/buildflow-spec --scaffold-first` — Wave 0 creates all file stubs before implementation begins

## Context Packet
- `.buildflow/VISION.md`
- `.buildflow/epics/[epic]/STATE.md` (if current epic exists — resume status, decisions, risks, next command)
- `.buildflow/codebase/CODEBASE.md` (if exists — runtime, frameworks, physical layout, entry points)
- `.buildflow/codebase/DEPENDENCIES.md` (if exists — external services, env contracts, webhooks, dependency chain)
- `.buildflow/codebase/TESTING.md` (if exists — test framework and validation patterns)
- `.buildflow/codebase/RISKS.md` (if exists — risks, debt, blind spots)
- `.buildflow/codebase/PATTERNS.md` (if exists — align spec with existing architecture, feature inventory)
- `.buildflow/codebase/intel.json` fields `features[]`, `local_support`, and `locale_support` (if exists)
- `.buildflow/MEMORY.md` (app_name, framework, current_epic only)
- `.buildflow/epics/[epic]/SPEC.md`, `ACCEPTANCE.md`, `PLAN.md` (if regenerating or updating)
- `.buildflow/epics/[epic]/CONTEXT.md` (if exists — carry locked decisions as spec constraints)

---

## Step 0: Pre-flight

**State check — jump to the right point:**
Read `STATE.md` + `MEMORY.md`. If `current_epic` is set, read `epics/[epic]/STATE.md`.
- `spec_locked` + `plan_ready` → skip to Guided Next Step
- `spec_locked` only → load `buildflow-spec-plan.md` (generate plan only)
- In progress → resume from last recorded step and note in STATE.md
- None → continue to Step 1

**Cross-repo check:**
If `../.buildflow/workspace/WORKSPACE.md` exists and the feature touches another repo:
```
⚠ Cross-repo scope detected → cd .. && /buildflow-workspace spec "[feature]"
Or continue here for single-repo mode.
```
If no workspace or no cross-repo signals: proceed silently.

Before exiting this command, update `epics/[epic]/STATE.md` with current status, decisions, key files, next command, and risks.

---

# PART 1 — SPEC

> **Architectural lens:** Evaluate every requirement and decision for long-term maintainability, reversibility, and system-wide impact. When two approaches both work, favour the one that is easier to change or delete later. Flag any choice that optimises for speed now but creates structural debt — name the debt explicitly so the team can make an informed call.

## Step 1: Load Context

Read `.buildflow/VISION.md` — if empty: stop, ask user to run `/buildflow-start-epic`.

**Codebase constraints** (apply if files exist): align all choices with CODEBASE.md paths, DEPENDENCIES.md contracts, TESTING.md conventions, RISKS.md hotspots. Treat PATTERNS.md feature inventory and `intel.json.features[]` as existing constraints — not new scope. Preserve `locale_support` / `local_support` unless explicitly asked to remove. If locale is in scope, add ACs for default locale, fallback, and catalog sync. If CONTEXT.md exists: all locked decisions are firm constraints — do not re-open them.

**Epic history** (if SHIPPED.md files exist): load last 2. Exclude already-shipped features, surface open debt as constraints, don't contradict prior architecture decisions. Print: "Prior epics: [N]. Shipped: [brief list]. Open debt: [N items]." Skip silently if none.

**Epic folder**: derive slug from vision (`[N]-[slug]`, e.g. `2-auth`). Create `.buildflow/epics/[epic]/` if needed. Update `STATE.md → current_epic` and `MEMORY.md → current_epic` before writing any files.

---

## Step 1c: Parallel Research Phase

Before asking clarification questions, run focused research to reduce unknowns. This minimizes the number of clarification questions needed in Step 2 and produces a richer spec.

**Default:** spawn all 3 researchers simultaneously in parallel using the Agent tool. Each agent receives a minimal scoped context packet — not the full codebase.

**Fallback (only if the host tool does not support the Agent tool):** run each researcher sequentially in the same session. Same outputs, same synthesis step.

---

### Spawn 3 Parallel Researchers

#### Agent R1 — Domain Researcher
**Scope:** Understand what the user is trying to accomplish and what already exists.
**Context packet:**
- `.buildflow/VISION.md`
- `.buildflow/MEMORY.md` (app_name, current_epic, framework only)
- `.buildflow/epics/*/SHIPPED.md` (last 2 — already-shipped capabilities)
- `intel.json` fields: `features[]` only

**Task:** Analyze the feature request against existing shipped features. Identify:
- What user outcome this feature enables (job-to-be-done)
- Which existing features overlap or are adjacent
- Likely user stories (2–4 max)
- Any domain constraints visible from the vision (compliance, locale, accessibility)

**Output:** `RESEARCH_DOMAIN.md` (temp, in-memory — not written to disk)

---

#### Agent R2 — Technical Researcher
**Scope:** Understand what the codebase can and cannot do.
**Context packet:**
- `.buildflow/codebase/CODEBASE.md`
- `.buildflow/codebase/PATTERNS.md`
- `.buildflow/codebase/DEPENDENCIES.md`
- `intel.json` fields: `local_support`, `locale_support`, `entry_points[]` only

**Task:** Analyze the technical landscape for this feature. Identify:
- Which existing patterns must be followed (component, service, repository patterns)
- Which files will likely be touched (entry points, relevant modules)
- External dependencies or env vars required
- Any stack constraints (framework version locks, incompatible libraries)
- Whether locale/local support is in scope based on existing `local_support` / `locale_support` flags

**Output:** `RESEARCH_TECHNICAL.md` (temp, in-memory — not written to disk)

---

#### Agent R3 — Risk Researcher
**Scope:** Surface known risks, debt, and testing constraints before planning begins.
**Context packet:**
- `.buildflow/codebase/RISKS.md`
- `.buildflow/codebase/TESTING.md`
- `.buildflow/epics/[last-epic]/SHIPPED.md` (open debt section only)

**Task:** Identify risks that will constrain the spec. Produce:
- Known hotspot files relevant to this feature (from RISKS.md)
- Open debt from prior epics that this feature may collide with
- Test framework constraints (what kinds of tests are feasible)
- Non-functional requirements likely to apply (performance, security, accessibility)

**Output:** `RESEARCH_RISKS.md` (temp, in-memory — not written to disk)

---

### Step 1d: Synthesize Research

After all 3 agents complete (or after sequential execution), synthesize their outputs:

```
Research Summary
────────────────────────────────────────
Domain:
  Feature type:       [new capability / enhancement / replacement]
  User outcome:       [job-to-be-done in one line]
  Existing overlap:   [features that partially address this, or NONE]
  Domain constraints: [compliance / locale / accessibility — or NONE]

Technical:
  Patterns to follow: [component/service/repository pattern names]
  Files likely touched: [list — max 5]
  External deps needed: [env vars, services — or NONE]
  Stack constraints:  [version locks, incompatibilities — or NONE]

Risks:
  Hotspot files:      [files with known complexity/risk — or NONE]
  Open debt collisions: [prior epic debt items relevant here — or NONE]
  Test constraints:   [what test types are feasible]
  NFRs likely needed: [performance / security / accessibility — or NONE]

Unknowns remaining (feed into Step 2 clarification queue):
  - [item that research could not resolve]
```

Print the Research Summary before proceeding to Step 2. Use it to pre-fill the clarification queue — skip any topic already answered by research.

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

Skip any topic already answered clearly by existing context or CONTEXT.md.

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

## Step 3: Generate SPEC.md (both parts — requirements then technical design in one pass)
Use the **Write tool** to create `.buildflow/epics/[epic]/SPEC.md`. Write both Part 1 and Part 2 to disk in this step. Do not output content as text.

→ **Format:** Read .buildflow/templates/tpl-spec.md for the full SPEC.md structure.

---

## Step 4: Generate Acceptance Criteria
Use the **Write tool** to create `.buildflow/epics/[epic]/ACCEPTANCE.md`. Do not output the content as text — write it to disk.

**Rules for every AC:**
- Binary — pass or fail only, no partial credit
- Testable — an automated test or explicit manual step can verify it
- Specific — no vague words (see Critic pass below)
- Covers both happy path AND at least one failure/edge case per feature

→ **Format:** Read `.buildflow/templates/tpl-acceptance.md` for the ACCEPTANCE.md structure.

---

## Step 5: Critic Pass + Lock

Before presenting specs to the user, self-review all three docs as a Spec Critic:

### Vague Language Scan
Search every AC for these banned words. Flag any found:
`correctly` `properly` `works` `fast` `quickly` `slow` `good` `bad` `easy` `easily`
`should` `appropriate` `reasonable` `nice` `clean` `simple` `obvious` `intuitive`

For each flagged word: replace with a specific, measurable alternative or mark `[NEEDS SPECIFICITY]`.

### Coverage Check
- Every feature in SPEC.md (requirements section) has at least 2 ACs (1 happy + 1 error/edge) — flag if not
- Every user story US-XX is referenced in at least one AC's feature section — flag orphans
- Every component in SPEC.md (technical design section) maps to at least one feature — flag orphans
- Every NFR in SPEC.md (technical design section) has a corresponding AC-NF — flag gaps

### Testability Check
For each AC, verify it can be answered as a pass/fail automated test or explicit manual step.

### Consistency Check
- API contracts in SPEC.md (technical design section) match any referenced endpoints in ACs
- Data model changes in SPEC.md (technical design section) are sufficient to support all AC outcomes
- Technology decisions don't contradict any constraints in the requirements section of SPEC.md

### Critic Report
Show the user:
```
Spec Critic Report
──────────────────
Vague language:   [N found — fixed N, flagged N]
Coverage gaps:    [list any orphaned features/stories/components]
Testability:      [list any ACs needing rework]
Consistency:      [any SPEC.md technical design/requirements conflicts]
Overall quality:  STRONG / NEEDS REVISION
```

---

### User Review Gate
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

## Step 6: Spec Amendment (when spec must change after locking)

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





