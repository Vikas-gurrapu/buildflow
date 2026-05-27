---
name: buildflow-discuss
description: Pre-plan decision workshop — capture key architectural decisions before speccing or planning
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-discuss

Structured pre-plan decision capture. Run before `/buildflow-spec` or `/buildflow-plan` when you have real design choices to make. Saves locked decisions as constraints that carry through to every downstream command.

## Usage
- `/buildflow-discuss` — surface and resolve the most important open decisions for the current phase
- `/buildflow-discuss <topic>` — focus the session on one area (e.g., "auth strategy", "database choice", "api design")
- `/buildflow-discuss --review` — list all captured decisions with confidence scores
- `/buildflow-discuss --reopen <title>` — revisit a previously closed decision

## Context Packet
- `.buildflow/core/vision.md`
- `.buildflow/memory/light.md`
- `.buildflow/learnings/decisions.md` (if exists)
- `.buildflow/phases/[N]/STATE.md` (if current phase exists)
- `.buildflow/specs/REQUIREMENTS.md` (if exists — for phase-level discussions)

---

## Phase State Resume

Read `.buildflow/core/state.md`. If a current phase exists, read `.buildflow/phases/[N]/STATE.md`.

If `STATE.md` shows decisions already captured for this phase, surface them and ask:
- "Add more decisions?" or "Review existing ones?"

Before exiting, update `.buildflow/phases/[N]/STATE.md` with:
- Status: `decisions_captured`
- Decisions: list of decisions locked this session
- Next Command: `/buildflow-spec` (or `/buildflow-plan` if spec is already locked)

---

## Step 1: Surface Open Decisions

Read `vision.md`, any existing `REQUIREMENTS.md`, and `decisions.md`. Identify decisions that are:
1. **Blocking** — can't write a good spec without resolving these
2. **High-impact** — wrong choice is expensive to reverse
3. **Open** — not yet captured in `decisions.md`

If no topic specified: surface up to 5 open decisions, ordered by impact.
If a topic specified: focus entirely on that area.

Print a decision board:

```
Open Decisions — [Phase N / Project Name]
──────────────────────────────────────────
[1] Database choice                → OPEN  (blocking spec)
[2] Auth strategy (JWT vs session) → OPEN  (high impact)
[3] API design (REST vs GraphQL)   → OPEN  (high impact)
[4] Deployment target              → OPEN  (medium impact)
──────────────────────────────────────────
Type a number to discuss, "all" to go through all, or "skip" to exit.
```

---

## Step 2: Decision Workshop (per decision selected)

### 2a — Frame the Decision

```
Decision: [title]
────────────────────────────────────────────
Context:  [why this matters — 1–2 sentences]
Options:  [A] [option 1]  |  [B] [option 2]  |  [C] [option 3]
Stakes:   [what happens if we choose wrong]
```

### 2b — Research Gate

If this is a factual/technical decision with meaningful tradeoffs:
- Ask: "Want me to research the options before deciding? (~2 min)"
- If yes: spawn one Researcher per option (parallel, max 3), each producing:
  - Key strengths
  - Key risks
  - Best fit for this project type
  - Source trust score (1–5)
- If no: proceed with the user's stated reasoning.

Use `research_depth` from preferences.md to set research thoroughness (quick/standard/thorough).

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
  → [Option Z]: consider if [condition]
```

### 2d — Lock or Defer

```
  [L] Lock   — save to decisions.md as a firm constraint
  [D] Defer  — mark as open; flag as an explicit question in the next spec
  [R] Revisit — discuss further (re-run step 2 with more context)
```

**If Lock:** use the **Write tool** to append to `.buildflow/learnings/decisions.md`:

```markdown
## [decision title]

**Decision:** [option chosen]
**Rationale:** [reason]
**Confidence:** [1–5]
**Date:** [ISO date]
**Impact:** If revisited, affects: [files / systems / downstream commands]
**Status:** locked
```

Also add a one-line entry to `light.md → Key Decisions`:
```
- [title]: [choice] (confidence [N]/5, [date])
```

Report: `✓ Locked: [decision] → [choice] (confidence [N]/5)`

**If Defer:** append to `decisions.md`:
```markdown
## [decision title]

**Status:** open
**Options considered:** [list]
**Deferred because:** [reason]
**Surfaces as:** explicit open question in the next /buildflow-spec
```

---

## Step 3: `--review` Mode

If invoked as `/buildflow-discuss --review`:

Read `decisions.md` and print a summary table:

```
Decision Log — [App Name]
──────────────────────────────────────────────────────────────
Decision                         Status    Confidence  Date
──────────────────────────────────────────────────────────────
Database: PostgreSQL             LOCKED    5/5         2025-06-01
Auth: JWT + refresh tokens       LOCKED    4/5         2025-06-01
API design: REST                 LOCKED    4/5         2025-06-02
Deployment target                OPEN      —           —
──────────────────────────────────────────────────────────────
To revisit a locked decision: /buildflow-discuss --reopen "decision title"
```

---

## Step 4: Decision Summary (end of session)

After all selected decisions are processed:

```
Decision Session Complete
──────────────────────────────────────────────
Locked (carry forward as spec constraints):
  ✓ Database: PostgreSQL (confidence 5/5)
  ✓ Auth: JWT with refresh tokens (confidence 4/5)

Deferred (will appear as open questions in spec):
  ○ Deployment target — resolve during infrastructure planning

Not discussed today:
  • API design — /buildflow-discuss "api design" to resolve
──────────────────────────────────────────────
```

Update `STATE.md` with all decisions locked this session.

---

## Step 5: Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-spec
   Why:  Decisions locked — spec can now reference them as firm constraints
   Context: Saved to .buildflow/phases/[N]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If deferred decisions exist, add:
```
   Or:  /buildflow-discuss "[deferred topic]" — resolve before speccing
```

If invoked as `--review` only (no decisions changed):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-discuss <topic>  — resolve an open decision
   Or:   /buildflow-spec             — proceed with existing decisions as constraints
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

## Token Budget: ~20K (no research) / ~35K (with parallel researchers)
