---
name: buildflow-complete-epic
description: Archive a completed milestone, tag the release, and prepare state for the next version cycle
allowed-tools: Read, Write, Bash, Glob
agent: strategist
---

# /buildflow-complete-epic

Archive all shipped phases into a named milestone, write a milestone summary, create a release tag, deep-prune memory, and reset state for the next development cycle.

Run after every phase in the milestone is `/buildflow-ship`'ed.

## Usage
- `/buildflow-complete-epic` — interactive: prompts for name and tag
- `/buildflow-complete-epic --tag v2.0.0` — specify the release tag explicitly
- `/buildflow-complete-epic --no-tag` — archive without creating a git tag
- `/buildflow-complete-epic --dry-run` — preview what would be archived, no writes

## Context Packet (load only these)
- `.buildflow/STATE.md`
- `.buildflow/MEMORY.md`
- `.buildflow/VISION.md` (summary section only)
- All `.buildflow/phases/*/SHIPPED.md` files (each ≤500 tokens — safe to load all)

Do NOT load: full phase PLAN.md files, spec files, retros, codebase maps.

---

## Git Permission Guard
Before any git command, read `.buildflow/PREFERENCES.md`.
- `git.permission: approved` → git tagging is allowed
- Anything else → skip tagging; record milestone version in STATE.md only

---

## Step 1: Verify All Phases Are Shipped

Collect all phases from `STATE.md → Phase History` table. For each phase in the current milestone cycle:

```bash
# List all phase directories
ls .buildflow/phases/
# Check each for SHIPPED.md
ls .buildflow/phases/*/SHIPPED.md 2>/dev/null
```

For any phase that has no `SHIPPED.md`:
```
⚠ Phase [N] — "[name]" has not been shipped yet.

Options:
  [S] Ship it now — run /buildflow-ship for Phase [N] first, then return here
  [I] Include anyway — mark as incomplete in the milestone summary
  [X] Exclude — treat as deferred to next milestone
```

If any phase is excluded or incomplete, note it in the milestone summary.

---

## Step 2: Collect Milestone Content

Load every `SHIPPED.md` from phases in this milestone (already in context packet).

From each `SHIPPED.md`, extract:
- What was built (features, capabilities)
- AC count and coverage %
- Key decisions made
- Debt deferred

From `MEMORY.md`:
- Stack/framework
- `parked_changes` — if non-empty, warn before archiving

---

## Step 3: Prompt for Milestone Metadata

If not provided via flags, ask:

```
Milestone Details
──────────────────
  Name:    [e.g., "Auth & User Profiles" or "v2.0"]
  Version: [e.g., v2.0.0 — used for git tag; press enter to skip tagging]
  Notes:   [optional release notes or highlights]
```

If the user presses enter on Version: proceed with `--no-tag` behavior.

---

## Step 4: Write MILESTONE.md

Use the **Write tool** to create `.buildflow/milestones/[slug]/MILESTONE.md`:

```markdown
# Milestone: [Name]

**Version:** [tag or untagged]
**Completed:** [today]
**Phases:** [N] shipped[, N incomplete/deferred]

---

## What Was Built

[3–8 bullet points summarizing the features shipped across all phases in this milestone]

---

## Phases

| Phase | Description | ACs | Coverage | Shipped |
|-------|-------------|-----|----------|---------|
| 1     | [name]      | N/N | N%       | [date]  |
| 2     | [name]      | N/N | N%       | [date]  |

---

## Key Decisions

[Architectural and technology decisions made during this milestone — extracted from SHIPPED.md files]

---

## Inherited Debt

[Deferred items, open debt entries — extracted from SHIPPED.md files]
[If none: "None — clean milestone."]

---

## Notes

[User-provided release notes, or empty]
```

---

## Step 5: Archive Phases

Move completed phase directories into the milestone archive:

```bash
mkdir -p .buildflow/milestones/[slug]/phases/
```

Use the **Write tool** to create `.buildflow/milestones/[slug]/phases/README.md`:
```markdown
# Phase Archive — Milestone: [Name]

Phase artifacts from this milestone are preserved here for reference.
Active development uses `.buildflow/phases/` for the current milestone cycle.
```

Do NOT delete or move the actual phase folders — they stay at `.buildflow/phases/[N]/` as the authoritative record. The milestone folder is a summary layer, not a physical move.

---

## Step 6: Create Git Tag (if git.permission: approved and version provided)

```bash
git tag -a [version] -m "Milestone: [Name]

[3-line summary of what was built]

Phases: [N] — ACs: [total passing] — Coverage: [avg]%"
```

Print:
```
✓ Git tag [version] created
  To push: git push origin [version]
```

If `--no-tag` or git unavailable:
```
Version recorded in STATE.md (no git tag — use 'git tag [version]' later if needed)
```

---

## Step 7: Reset State for Next Milestone

Use the **Write tool** to update `.buildflow/STATE.md`:
- Set `Phase: [next number]` (highest completed phase + 1)
- Set `Status: Initialized`
- Append milestone summary row to Phase History table:
  ```
  | [Phases N–M] | [Milestone Name] | ✅ Milestone Complete | [today] |
  ```
- Reset `session_tokens_used: 0`

Use the **Write tool** to update `.buildflow/MEMORY.md`:
- Update `phase:` to next phase number
- Update `last_session:` to today
- Clear `parked_changes: []` if empty
- Add or update `last_milestone:` with the version/name just completed
- Deep-prune: remove all wave-level build notes, old phase task summaries, and build timestamps — keep only style_fingerprint, key_decisions (last 3), and current_focus

---

## Step 7b: Write to Global Learnings Store

Extract 2–4 cross-project insights from this milestone — things that would be useful in a future project using the same framework or language.

Good candidates:
- A non-obvious tradeoff that the team discovered (e.g., "JWT refresh pattern X caused race condition under load")
- A library or pattern that worked well or poorly for this framework
- A testing approach that caught bugs early
- A dependency or integration that was harder than expected

Use the **Write tool** to append to `~/.buildflow/learnings/global.md` (create if absent):

```markdown
## [Milestone Name] — [Framework] — [ISO date]

**Project type:** [app type from VISION.md]
**Framework:** [framework]
**Language:** [language]

**Learnings:**
- [insight 1 — concrete, actionable, framework-specific]
- [insight 2]
- [insight 3 — optional]

---
```

Rules:
- Only write insights that a *different project* using the same framework could act on
- Skip generic advice ("test your code", "use version control")
- If no meaningful cross-project insights exist: skip this step silently

---

## Step 8: Print Milestone Summary

```
Milestone Complete — [Name] [version]
──────────────────────────────────────
Phases shipped:   [N]
ACs satisfied:    [total] / [total]
Avg coverage:     [N]%
[Debt items: N]   [or "Clean — no deferred debt"]
[Git tag: [v]]    [or "No tag created"]

Archived to: .buildflow/milestones/[slug]/MILESTONE.md

──────────────────────────────────────────────────
→ Next:  /buildflow-spec "[first feature of next milestone]"
   Why:  Milestone archived. Memory pruned. Ready for the next development cycle.
   Context: Saved to STATE.md. Run /clear before starting next phase — milestone boundary.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

---

## Token Cost Report

Measure actual cost at the end:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output from text generated ÷ 4 = output tokens
3. Update `STATE.md → session_tokens_used`

## Token Budget: ~12K
