---
name: buildflow-auto
max_context_kb: 90
description: Autopilot — auto-resolves open discuss questions, drives every remaining build wave, then runs check and ship without stopping for non-critical confirmations. Never runs /buildflow-deploy.
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
agents: strategist, researcher, builder, reviewer, security-auditor
multi-agent: true
---

# /buildflow-auto

Unattended run across the rest of the current epic's lifecycle. Instead of you re-typing `/buildflow-discuss`, `/buildflow-build`, `/buildflow-check`, and `/buildflow-ship` in turn and answering each prompt, autopilot chains them: auto-locks open spec decisions, builds every remaining wave back-to-back, then runs check and ship — stopping on its own only where a human judgment call is genuinely required.

## Usage
- `/buildflow-auto` — run autopilot from the current epic's state through `/buildflow-ship`
- `/buildflow-auto --stop-at build` — auto-lock decisions + build all remaining waves + integration check, then stop (skip check/ship)
- `/buildflow-auto --stop-at check` — same, plus `/buildflow-check`, then stop before `/buildflow-ship`
- `/buildflow-auto --dry-run` — print the autopilot plan (what stages would run, what's already done) without executing anything
- `/buildflow-auto` (re-run after a stop) — resumes exactly where it stopped, same as any other BuildFlow command

## Context Packet for this command (load progressively — only the current stage's files, not all at once)
- `.buildflow/STATE.md`
- `.buildflow/PREFERENCES.md` (git.permission, path_permissions, workflow.skip_prompts, research_depth, strict_mode)
- `.buildflow/epics/[epic]/STATE.md`
- `.buildflow/epics/[epic]/CONTEXT.md` (Stage A only)
- `.buildflow/epics/[epic]/ACCEPTANCE.md`, `PLAN.md` (index + Wave Index status column), `waves/wave-[N].md` (current wave only), `CHECK.md` (Stage B/C)
- Everything `/buildflow-build`, `/buildflow-check`, and `/buildflow-ship` each declare in their own Context Packets, loaded only when that stage is active

---

## What Autopilot Changes (read once, applies to every stage below)

Autopilot does not invent new behavior — it removes the "wait for a reply" pause at gates that are safe to auto-resolve, and it chains commands that normally require you to type the next one. The gates below are **never** auto-resolved, autopilot mode or not:

| Always stops for a human | Why |
|---|---|
| HARD or SCOPE deviation (Step 3g in build) | Plan can't be followed as written — needs a decision, not a guess |
| Coverage drop ≥15%, bundle size >25% | Real quality regressions |
| Git commit failure | Never auto-retry or auto-park past a real git problem |
| Low-confidence (1–2/5) discuss recommendation | An unattended architectural guess is worse than asking |
| Any `/buildflow-check` AC not PASS, or a HIGH/CRITICAL security finding | Ship-blocking by design |
| Any `/buildflow-ship` gate BLOCK | Autopilot never applies `--skip-spec`, `--force`, or `--skip-telemetry` — those are typed, human overrides on purpose |
| `/buildflow-deploy` | Always out of scope for this command, regardless of `--stop-at` |

Everything else — the "proceed to next wave?" pause, the coverage 5–15% prompt, bounded test/gate retries, discuss's Lock/Defer choice — autopilot resolves itself using the same recommendation logic the manual command would show you, and logs the choice so it's reviewable afterward (not silent).

---

## Step 0: Pre-flight & Stage Detection

**Cross-repo check:** if `../.buildflow/workspace/STATE.md` has `current_xepic` set and this repo is in its `repos` list → suggest `cd .. && /buildflow-workspace build` instead. User may continue single-repo.

**Guards (apply throughout, identical to every other command):**
- Git: read `git.permission` from PREFERENCES.md. Not `approved` → no-git mode, no commits/tags/worktrees/resets anywhere in this run.
- Folder access: check `path_permissions.[folder]` before any source read/write, same rules as every other command.

**No active epic:** if `current_epic` is `none` → stop: "No active epic. Run `/buildflow-start-epic` first."

**No spec yet:** if `.buildflow/epics/[epic]/SPEC.md` or `PLAN.md` doesn't exist → stop: "Autopilot needs a locked spec and plan first. Run `/buildflow-spec`." Autopilot drives an existing plan; it does not invent scope.

**Determine remaining stages** from epic `STATE.md` status + artifact contents:

| Condition | Stage |
|---|---|
| `CONTEXT.md` has any decision with `Status: open`, or no `CONTEXT.md` exists yet for current `spec_version` | A — Auto-Discuss |
| `PLAN.md` Wave Index has any row with `Status != COMPLETE` | B — Auto-Build |
| All waves COMPLETE, epic status not yet `check_passed` | C — Auto-Check |
| `check_passed`, status not yet `shipped` | D — Auto-Ship |
| `shipped` | Nothing to do — report and recommend `/buildflow-deploy` or the next epic |

A run typically starts at whichever stage is earliest-incomplete and falls through the rest in order.

---

## Step 1: Print the Plan and Confirm Once

```
Autopilot Plan — [epic]
──────────────────────────────────────────────
[✓ done / ○ will run / — skipped by --stop-at] Stage A: Discuss  — [N] open question(s) to auto-resolve
[✓ done / ○ will run / — skipped by --stop-at] Stage B: Build    — wave [N] of [M] remaining
[✓ done / ○ will run / — skipped by --stop-at] Stage C: Check    — 4-agent verification
[✓ done / ○ will run / — skipped by --stop-at] Stage D: Ship     — spec + security + telemetry gate
──────────────────────────────────────────────
Stops early only on: HARD/SCOPE deviations, a real coverage/bundle regression, a git
failure, a low-confidence discuss question, a check FAIL, or a ship gate BLOCK.
Never runs /buildflow-deploy.
```

**If `--dry-run`:** print the plan above and stop. Execute nothing.

**Otherwise**, ask once (skip this single prompt if `workflow.skip_prompts: true` in PREFERENCES.md — already opted into unattended mode):
```
──────────────────────────────────────────────────
Start autopilot? It will run the stages above back-to-back without further prompts,
stopping early only at the gates listed.
  [Y] Yes — start
  [N] No  — cancel, use the manual commands instead
──────────────────────────────────────────────────
```
`[N]` → stop here, no changes made.

---

## Stage A — Auto-Discuss

**Trigger:** open questions exist, or discuss has never run for the current `spec_version`.

Surface doubts, missing requirements, design questions, plan concerns, and conflicts exactly as `/buildflow-discuss` Step 1 does. For each one, run the Decision Workshop with these autopilot overrides:

- **Frame the question** — unchanged (context, issue, options, stakes).
- **Research gate** — skip the "want research?" prompt. Spawn researchers automatically only if `research_depth: thorough` is set in PREFERENCES.md; otherwise reason from existing project context.
- **Recommendation** — unchanged: top choice, 2 driving factors, main risk, confidence 1–5.
- **Lock or Defer** — always **Lock**, using the recommendation. Autopilot never defers and never leaves a question open going into an unattended build.
  - **Exception — confidence 1–2:** STOP instead of locking. Print the question exactly as the manual workshop would and end the run here. A low-confidence architectural guess is the one place autopilot hands back to a human.
- Write to `CONTEXT.md` exactly as `/buildflow-discuss` would, plus one addition: append `**Auto-decided:** true (autopilot, [ISO date])` to the decision block so it reads distinctly from a human-locked decision on later review.

After all questions resolve: automatically apply `/buildflow-spec --update` (same as discuss's own confirmation-gate branch) — patch `SPEC.md`/`ACCEPTANCE.md`, regenerate affected `PLAN.md` waves, increment `spec_version`, print the diff.

Print: `Stage A complete — [N] decisions auto-locked (CONTEXT.md, marked Auto-decided). Spec → v[N+1].`

If a low-confidence question stopped the loop: skip straight to the Autopilot Session Summary (below) with that question surfaced, and end the run.

---

## Stage B — Auto-Build (all remaining waves)

**Trigger:** `PLAN.md` Wave Index has 1+ waves with `Status != COMPLETE`.

→ **Load module now:** Read `.claude/commands/buildflow-build-detect.md` and execute all steps in it. It will write `BUILD_SESSION.md` and return here.

For each remaining wave, in Wave Index order:

→ **Load module now:** Read `.claude/commands/buildflow-build-execute.md` and execute Steps 3a–3i for the current wave, applying these autopilot overrides at each gate:

| Gate | Manual mode | Autopilot override |
|---|---|---|
| 3b post-merge gate failure | Ask: rerun / fix now / defer | Auto-attempt ONE "rerun with corrected command" if the cause is clearly a command issue; otherwise STOP and surface |
| 3d coverage drop 5–15% | Prompt [F]/[P]/[S] | Auto `[P]` Proceed, log to `DEBT.md` |
| 3d coverage drop ≥15% | Prompt [F]/[P]/[S] | STOP — real quality risk |
| 3d bundle size >25% | BLOCK | unchanged — STOP |
| 3e test failure loop | Ask before each retry, max 3 | Auto-approve each retry up to the existing max of 3; STOP if still failing after 3 |
| 3g SOFT deviation | Choose simplest, log, continue | unchanged — already automatic |
| 3g HARD / SCOPE deviation | Stop, escalate | unchanged — STOP, autopilot never resolves these itself |
| 3h git commit failure | `[R]`etry / `[P]`ark / `[W]`ait | STOP — never auto-park or auto-retry past a real git failure |

Do not pause between waves to ask "proceed to next wave?" — the moment a wave's commit (3h) succeeds, continue immediately into the next wave's context packets (3a).

After the final wave: run the Final Integration Check (`/buildflow-build` Step 2), auto-selecting **[2] Impacted area** test scope (or the stricter equivalent if `strict_mode: true`) instead of asking. Update `CHECK.md` and `MEMORY.md` as normal.

Print: `Stage B complete — [N] of [M] waves built, [N] commits, [N] SOFT deviations auto-resolved.` If a HARD/SCOPE deviation or an unresolved gate stopped the loop early, print that instead and end the run.

**If `--stop-at build`:** end the run here → Guided Next Step recommends `/buildflow-check`.

---

## Stage C — Auto-Check

**Trigger:** all waves COMPLETE, epic status not yet `check_passed`.

Run the exact `/buildflow-check` flow — 4 parallel Reviewers (spec compliance, code correctness, code quality, security). No gate overrides needed: `/buildflow-check` has no interactive prompts in its default report path, so autopilot's only change is running it automatically instead of waiting for you to type it.

- Manual UAT (`/buildflow-check` Step 5b) cannot run unattended — skip it and note in the summary: `UAT: not run (autopilot) — run /buildflow-check manually before ship if this epic touches user-facing flows.`
- Any AC not PASS (or lacking fresh evidence), or any reviewer raising a HIGH/CRITICAL security finding → STOP. Print the check report exactly as `/buildflow-check` would and end the run.
- Otherwise: print the check summary, continue to Stage D.

**If `--stop-at check`:** end the run here → Guided Next Step recommends `/buildflow-ship`.

---

## Stage D — Auto-Ship

**Trigger:** `check_passed`, epic status not yet `shipped`.

Run the exact `/buildflow-ship` gates — spec compliance, security scan, build telemetry — automatically, no overrides:

- Any gate BLOCK → STOP. Print the blocking gate exactly as `/buildflow-ship` would and end the run. Autopilot never applies `--skip-spec`, `--force`, or `--skip-telemetry` — those stay typed, human overrides.
- All gates pass → ship completes: commit/tag per `git.permission`, `SHIPPED.md` written, context pruned — identical to a manual `/buildflow-ship`.

**Autopilot stops here unconditionally.** It never runs `/buildflow-deploy`, regardless of `--stop-at` — deploying to staging/production stays a separate, explicitly human-triggered command in every mode.

---

## Autopilot Session Summary (always printed, whatever stage it stops at)

```
Autopilot Session Summary — [epic]
──────────────────────────────────────────────────
Ran:      Stage A → B → C → D (mark which actually ran)
Stopped:  [stage] — [reason, or "completed all requested stages"]

Auto-decisions made this run (review before relying on them):
  • [decision] — CONTEXT.md, Auto-decided
  • ...

Waves built:      [N] of [M]
Commits:          [N]
Deviations:       [N] SOFT auto-resolved · [N] HARD/SCOPE stopped the run (if any)
Check result:     [PASS / FAIL / not run]
Ship result:      [shipped vN / blocked: reason / not run]
──────────────────────────────────────────────────
```

Update epic `STATE.md` before exiting with: status, stage reached, decisions locked, files touched, risks, next command — same contract every other epic-driving command follows.

## Guided Next Step

If stopped on a HARD/SCOPE deviation or low-confidence question:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-debug   (or resolve the flagged question manually)
   Why:  Autopilot hit a gate that needs your judgment, not a guess
   Then: /buildflow-auto — resume from exactly where it stopped
──────────────────────────────────────────────────
```

If stopped because `check` FAILed or `ship` was BLOCKed: recommend the fix path the report itself names (e.g. `/buildflow-debug`, `/buildflow-audit`), then `/buildflow-auto` to resume.

If all requested stages completed (including ship):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-deploy
   Why:  Epic shipped — deploy to staging/production when ready
   Or:   /buildflow-complete-epic  — archive this milestone and start the next
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
```

If `--stop-at` ended the run early but with no blocking gate: recommend the next manual command in the chain (`/buildflow-check` or `/buildflow-ship`).
