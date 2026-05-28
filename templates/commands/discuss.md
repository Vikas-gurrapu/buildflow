---
name: buildflow-discuss
description: Post-spec clarification workshop — review doubts about the generated spec and plan, auto-updates artifacts on confirmation
allowed-tools: Read, Write, WebSearch
agent: strategist
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
- `.buildflow/phases/[N]/REQUIREMENTS.md` (generated spec — what to review)
- `.buildflow/phases/[N]/DESIGN.md` (generated spec — what to review)
- `.buildflow/phases/[N]/ACCEPTANCE.md` (generated spec — what to review)
- `.buildflow/phases/[N]/PLAN.md` (generated plan — what to review)
- `.buildflow/phases/[N]/DECISIONS.md` (if exists — prior locked decisions)
- `.buildflow/phases/[N]/STATE.md` (if current phase exists)

---

## Phase State Resume

Read `.buildflow/STATE.md`. If a current phase exists, read `.buildflow/phases/[N]/STATE.md`.

If `STATE.md` shows decisions already captured for this phase, surface them and ask:
- "Add more decisions?" or "Review existing ones?"

Before exiting, update `.buildflow/phases/[N]/STATE.md` with:
- Status: `decisions_captured` (if spec not yet updated) or `plan_ready` (after spec --update runs)
- Decisions: list of decisions locked this session
- Next Command: `/buildflow-build`

---

## Step 1: Surface Doubts and Open Questions

Read REQUIREMENTS.md, DESIGN.md, ACCEPTANCE.md, and PLAN.md. Identify areas where the generated artifacts may have:
1. **Doubts** — anything that feels wrong, underspecified, or uncertain
2. **Missing requirements** — scope gaps the user spotted when reviewing the output
3. **Design questions** — why was X chosen over Y, what does a component actually do
4. **Plan concerns** — wave ordering, task breakdown, effort estimates, missing tasks
5. **Conflicts** — decisions in DESIGN.md that contradict constraints or prior DECISIONS.md entries

If no topic specified: surface up to 5 open questions, ordered by impact on build correctness.
If a topic specified: focus entirely on that area.

Print a question board:

```
Open Questions — [Phase N / App Name]
──────────────────────────────────────
[1] Auth strategy in DESIGN.md         → UNCLEAR  (could affect wave 2 tasks)
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
- If yes: spawn one Researcher per option (parallel, max 3), each producing:
  - Key strengths
  - Key risks
  - Best fit for this project type
  - Source trust score (1–5)
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
  [L] Lock   — save to DECISIONS.md as a firm constraint; spec will be updated
  [D] Defer  — mark as open; flag as an explicit question in the next build wave
  [R] Revisit — discuss further (re-run step 2 with more context)
```

**If Lock:** use the **Write tool** to append to `.buildflow/phases/[N]/DECISIONS.md`:

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

**If Defer:** append to `DECISIONS.md`:
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

Read `DECISIONS.md` and print a summary table:

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

## Step 4: Decision Summary (end of session)

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

## Step 5: Confirmation Gate

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
- Read all decisions locked this session from `DECISIONS.md`
- Patch affected sections of REQUIREMENTS.md, DESIGN.md, ACCEPTANCE.md
- Regenerate affected PLAN waves
- Print diff of all changes
- Increment `spec_version`

Then print:
```
Spec updated to v[N+1] — [N] decisions applied · [N] ACs changed
──────────────────────────────────────────────────
→ Next:  /buildflow-build
   Why:  Spec and plan are locked — start executing wave 1
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
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
Session: ~[N]K tokens
```

If invoked as `--review` only (no decisions changed):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-discuss <topic>  — resolve an open question
   Or:   /buildflow-build            — proceed with spec and plan as-is
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If deferred decisions exist, add:
```
   Note: [N] deferred question(s) — these will surface as concerns during /buildflow-build
```

## Token Budget: ~20K (no research) / ~35K (with parallel researchers)
