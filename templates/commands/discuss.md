---
name: buildflow-discuss
max_context_kb: 40
model_tier: heavy
description: Post-spec clarification workshop — review doubts about the generated spec and plan, auto-updates artifacts on confirmation
allowed-tools: Read, Write, WebSearch
agent: strategist
multi-agent: true
---

# /buildflow-discuss

Structured post-spec review. Run after `/buildflow-spec` when you have doubts about the generated requirements, design, or wave plan. Surfaces questions, resolves them as locked decisions, then automatically updates spec artifacts on confirmation.

## Usage
- `/buildflow-discuss` — surface and resolve doubts about the current spec and plan
- `/buildflow-discuss <topic>` — focus the session on one area (e.g., "auth strategy", "wave ordering", "api design")
- `/buildflow-discuss --review` — list all captured decisions with confidence scores
- `/buildflow-discuss --reopen <title>` — revisit a previously closed decision

## Context Packet
- `.buildflow/VISION.md`
- `.buildflow/MEMORY.md`
- `.buildflow/epics/[epic]/SPEC.md` (generated spec — what to review)
- `.buildflow/epics/[epic]/ACCEPTANCE.md` (generated spec — what to review)
- `.buildflow/epics/[epic]/PLAN.md` (index — what to review)
- `.buildflow/epics/[epic]/CONTEXT.md` (if exists — prior locked decisions)
- `.buildflow/epics/[epic]/STATE.md` (if current phase exists)

---

**Pre-flight:** Read STATE.md + epic STATE.md. If decisions already captured: ask "Add more or review existing?" Before exiting: update STATE.md with decisions locked and next command. Agent protocol: Claude Code — parallel; other tools — sequential with `=== [Role] START/END ===`.

---

## Step 1: Surface Doubts and Open Questions

> **Production-failure lens:** For every decision, ask: "Have I seen this approach fail in production?" Patterns that look clean in a spec often break under real load, concurrent writes, partial failures, or rollback scenarios. Surface the failure mode before the team commits to the approach — it is far cheaper to change a spec than to revert a shipped feature.

Read SPEC.md, ACCEPTANCE.md, and PLAN.md (index + wave files as needed). Identify areas where the generated artifacts may have:
1. **Doubts** — anything that feels wrong, underspecified, or uncertain
2. **Missing requirements** — scope gaps the user spotted when reviewing the output
3. **Design questions** — why was X chosen over Y, what does a component actually do
4. **Plan concerns** — wave ordering, task breakdown, effort estimates, missing tasks
5. **Conflicts** — decisions in SPEC.md that contradict constraints or prior CONTEXT.md entries

If no topic specified: surface up to 5 open questions, ordered by impact on build correctness.
If a topic specified: focus entirely on that area.

Print a question board:

```
Open Questions — [Phase N / App Name]
──────────────────────────────────────
[1] Auth strategy in SPEC.md           → UNCLEAR  (could affect wave 2 tasks)
[2] Rate limiting scope in AC-007      → AMBIGUOUS (pass/fail boundary not specified)
[3] Wave ordering: UI before API       → CONCERN   (violates thin-slice order)
[4] Missing error handling in AC-003   → GAP       (no test coverage planned)
──────────────────────────────────────
Type a number to discuss, "all" to go through all, or "done" to finish.
```

---

## Step 2: Decision Workshop (per question selected)

### 2a — Frame the Question

```
Question: [title]
────────────────────────────────────────────
Context:  [what the spec currently says — 1–2 sentences]
Issue:    [what's unclear, wrong, or missing]
Options:  [A] [option 1]  |  [B] [option 2]  |  [C] [option 3]
Stakes:   [what happens downstream if we choose wrong]
```

### 2b — Research Gate

If this is a factual/technical question with meaningful tradeoffs:
- Ask: "Want me to research the options before deciding? (~2 min)"
- If yes — spawn one Researcher per option (max 3):

  **Claude Code** — spawn all in one response (true parallel):
  ```
  Agent({ description: "Researcher: [option A]", prompt: "You are a BuildFlow Researcher. Research option: [option A] for [project type]. Find: key strengths, key risks, best fit for this project type, source trust score 1–5. Be concise." })
  Agent({ description: "Researcher: [option B]", prompt: "You are a BuildFlow Researcher. Research option: [option B] for [project type]. Find: key strengths, key risks, best fit for this project type, source trust score 1–5. Be concise." })
  Agent({ description: "Researcher: [option C]", prompt: "You are a BuildFlow Researcher. Research option: [option C] for [project type]. Find: key strengths, key risks, best fit for this project type, source trust score 1–5. Be concise." })
  ```

  **Gemini CLI / Codex CLI / Cursor** — sequential:
  `=== Researcher [A]: [option A] START ===` → strengths, risks, fit, trust score → `=== END ===` (repeat per option)

- If no: proceed with the user's stated reasoning.

Use `research_depth` from PREFERENCES.md to set research thoroughness (quick/standard/thorough).

### 2c — Recommendation

After research (or if user skips):

```
Recommendation: [Option X]
────────────────────────────────────────────
Reason:     [top 2 factors driving the choice]
Risk:       [main downside of this option]
Confidence: [1–5]

If this turns out wrong:
  → [Option Y]: consider if [condition]
```

### 2d — Lock or Defer

```
  [L] Lock   — save to CONTEXT.md as a firm constraint; spec will be updated
  [D] Defer  — mark as open; flag as an explicit question in the next build wave
  [R] Revisit — discuss further (re-run step 2 with more context)
```

**If Lock:** use the **Write tool** to append to `.buildflow/epics/[epic]/CONTEXT.md`:

```markdown
## [decision title]

**Decision:** [option chosen]
**Rationale:** [reason]
**Confidence:** [1–5]
**Date:** [ISO date]
**Impact:** Affects: [REQUIREMENTS sections / DESIGN sections / ACs / PLAN waves]
**Status:** locked
```

Also add a one-line entry to `MEMORY.md → Key Decisions`:
```
- [title]: [choice] (confidence [N]/5, [date])
```

Report: `✓ Locked: [decision] → [choice] (confidence [N]/5)`

**If Defer:** append to `CONTEXT.md`:
```markdown
## [decision title]

**Status:** open
**Options considered:** [list]
**Deferred because:** [reason]
**Surfaces as:** explicit concern in build wave [N]
```

---

## Step 3: `--review` Mode

If invoked as `/buildflow-discuss --review`:

Read `CONTEXT.md` and print a summary table:

```
Decision Log — [App Name]
──────────────────────────────────────────────────────────────
Decision                         Status    Confidence  Date
──────────────────────────────────────────────────────────────
Database: PostgreSQL             LOCKED    5/5         2025-06-01
Auth: JWT + refresh tokens       LOCKED    4/5         2025-06-01
Wave ordering: DB first          LOCKED    4/5         2025-06-02
Error handling scope             OPEN      —           —
──────────────────────────────────────────────────────────────
To revisit a locked decision: /buildflow-discuss --reopen "decision title"
```

---

## Step 3: Decision Summary & Confirm

After all selected questions are processed:

```
Discussion Session Complete
──────────────────────────────────────────────
Locked (will be applied to spec and plan):
  ✓ Auth: JWT with refresh tokens (confidence 4/5)
  ✓ Wave ordering: DB → API → UI enforced (confidence 5/5)

Deferred (flagged as open concerns for build):
  ○ Rate limiting scope — revisit before wave 3

Not discussed today:
  • Error handling in AC-003 — /buildflow-discuss "error handling" to resolve
──────────────────────────────────────────────
```

Update `STATE.md` with all decisions locked this session.

---

### Confirmation Gate

After the session summary, ask:

```
──────────────────────────────────────────────────
Are you happy with these decisions?
  [Y] Yes — apply decisions to spec and plan, then proceed to /buildflow-build
  [N] No  — continue the discussion
──────────────────────────────────────────────────
```

**If [Y]:**

Automatically run `/buildflow-spec --update`:
- Read all decisions locked this session from `CONTEXT.md`
- Patch affected sections of SPEC.md, ACCEPTANCE.md
- Regenerate affected PLAN waves
- Print diff of all changes
- Increment `spec_version`

Then print:
```
Spec updated to v[N+1] — [N] decisions applied · [N] ACs changed
──────────────────────────────────────────────────
→ Next:  /buildflow-build
   Why:  Spec and plan are locked — start executing wave 1
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
```

**If [N]:**
Continue with Step 1 — surface remaining doubts or let the user name another topic.

---

## Guided Next Step (if no decisions were locked this session)

```
──────────────────────────────────────────────────
→ Next:  /buildflow-build
   Why:  No spec changes needed — proceed to execute wave 1
──────────────────────────────────────────────────
```

If invoked as `--review` only (no decisions changed):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-discuss <topic>  — resolve an open question
   Or:   /buildflow-build            — proceed with spec and plan as-is
──────────────────────────────────────────────────
```

If deferred decisions exist, add:
```
   Note: [N] deferred question(s) — these will surface as concerns during /buildflow-build
```


