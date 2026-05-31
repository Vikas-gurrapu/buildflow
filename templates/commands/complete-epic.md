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
- All `.buildflow/epics/*/SHIPPED.md` files (each ≤500 tokens — safe to load all)

Do NOT load: full phase PLAN.md files, spec files, retros, codebase maps.

---

## Git Permission Guard
Before any git command, read `.buildflow/PREFERENCES.md`.
- `git.permission: approved` → git tagging is allowed
- Anything else → skip tagging; record milestone version in STATE.md only

---

## Step 1: Verify All Epics Are Shipped

Collect all epics from `STATE.md → Epic History` table. For each epic in the current milestone cycle:

```bash
# List all epic directories
ls .buildflow/epics/
# Check each for SHIPPED.md
ls .buildflow/epics/*/SHIPPED.md 2>/dev/null
```

For any epic that has no `SHIPPED.md`:

**First, run an AC check** — read `.buildflow/epics/[N-slug]/CHECK.md`:
- Count total ACs and how many are PASS / FAIL / UNVERIFIED
- If CHECK.md does not exist: treat all ACs as UNVERIFIED

Then show:
```
⚠ Epic [N-slug] — "[name]" has not been shipped yet.

AC Status:  [N] PASS  /  [N] FAIL  /  [N] UNVERIFIED  (from CHECK.md)
[If any FAIL or UNVERIFIED:]
  Failing ACs: AC-001 [title], AC-004 [title] ...

Options:
  [S] Ship it now   — run /buildflow-ship for Epic [N-slug] first, then return here
                      (recommended — runs full gates + prune + AC verification)
  [I] Include anyway — mark as incomplete in the milestone summary
                      (requires typing "include-unverified" to confirm)
  [X] Exclude        — treat as deferred to next milestone
```

- If the user chooses **[I]**: require typing `include-unverified` before proceeding. Record unverified AC count in the milestone summary and append to `DEBT.md`.
- If the user chooses **[S]**: stop here — user must run `/buildflow-ship` first, then re-run `/buildflow-complete-epic`.
- If all ACs are PASS but SHIPPED.md is simply missing: surface as a warning only, not a block.

If any epic is excluded or incomplete, note it in the milestone summary.

---

## Step 2: Collect Milestone Content

Load every `SHIPPED.md` from epics in this milestone (already in context packet).

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

## Epics

| Epic     | Description | ACs | Coverage | Shipped |
|----------|-------------|-----|----------|---------|
| 1-auth   | [name]      | N/N | N%       | [date]  |
| 2-payment| [name]      | N/N | N%       | [date]  |

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

## Step 5: Archive Epics

Record completed epic references in the milestone folder:

```bash
mkdir -p .buildflow/milestones/[slug]/
```

Use the **Write tool** to create `.buildflow/milestones/[slug]/EPICS.md`:
```markdown
# Epic Archive — Milestone: [Name]

Epic artifacts from this milestone are preserved in their original locations for reference.
Active development uses `.buildflow/epics/` for the current milestone cycle.

## Epics in this Milestone
- [N-slug]: [description]
- [N-slug]: [description]
```

Do NOT delete or move the actual epic folders — they stay at `.buildflow/epics/[N-slug]/` as the authoritative record. The milestone folder is a summary layer, not a physical move.

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

## Step 7: Fallback Prune (if any epic was not shipped via /buildflow-ship)

Check: did every epic in this milestone have a `SHIPPED.md`?

If **any epic was included without going through `/buildflow-ship`** (chose [I] Include anyway, or SHIPPED.md was simply absent):

Run the same cleanup that `/buildflow-ship` would have performed for that epic:

1. **Prune epic MEMORY.md entries** — in `.buildflow/MEMORY.md`, remove wave-level build notes, task summaries, and build timestamps for that epic. Keep only: style_fingerprint, key_decisions (last 3), current_focus.
2. **Write a synthetic SHIPPED.md** — use the **Write tool** to create `.buildflow/epics/[N-slug]/SHIPPED.md`:
   ```markdown
   # [Epic Name] — Completed via /buildflow-complete-epic
   **Completed:** [today]
   **Note:** /buildflow-ship was not run. ACs: [N PASS / N FAIL / N UNVERIFIED].
   [If any FAIL/UNVERIFIED:] Unverified ACs logged to DEBT.md.

   ## What Was Built
   [3–5 bullets from SPEC.md features]
   ```
3. **Append to DEBT.md** — log any FAIL or UNVERIFIED ACs with a timestamp:
   ```
   [date] /buildflow-complete-epic — ship gate bypassed for epic [N-slug].
   Unverified ACs: [list]. Reason: included without /buildflow-ship.
   ```

If all epics had `SHIPPED.md`: skip this step entirely.

---

## Step 7b: Reset State for Next Milestone

Use the **Write tool** to update `.buildflow/STATE.md`:
- Set `Epic: none` (cleared — ready for next epic)
- Set `Status: Initialized`
- Append milestone summary row to Epic History table:
  ```
  | [Epics N–M] | [Milestone Name] | ✅ Milestone Complete | [today] |
  ```
- Clear `paused_epics: []` — milestone complete means all epics in this cycle are done

Use the **Write tool** to update `.buildflow/MEMORY.md`:
- Set `current_epic: none`
- Update `last_session:` to today
- Clear `parked_changes: []` if empty
- Add or update `last_milestone:` with the version/name just completed
- Deep-prune: remove all wave-level build notes, old epic task summaries, and build timestamps — keep only style_fingerprint, key_decisions (last 3), and current_focus

---

## Step 7c: Write to Global Learnings Store

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
```

---
