---
name: buildflow-build
max_context_kb: 80
description: Spec-traced wave execution with pattern-matched Builders, auto-test, auto-fix, and PR-ready commits
allowed-tools: Read, Write, Bash, Grep, Glob
agents: builder, reviewer
multi-agent: true
---

# /buildflow-build

Execute the current phase plan. Each Builder receives a precise context packet — task spec, AC refs, before/after contract, and the closest existing example to follow. Every wave auto-detects failures, proposes fixes, and reruns only with user approval. The next wave never starts until the current wave is fully passing.

## Usage
- `/buildflow-build` — execute all waves
- `/buildflow-build wave-2` — execute a specific wave
- `/buildflow-build <task>` — build a single task

## Context Packet for this command (load only these)
- `.buildflow/STATE.md`
- `.buildflow/MEMORY.md` (app_name, framework, language, current_epic, style_fingerprint, parked_changes, coverage/test baselines only)
- `.buildflow/PREFERENCES.md` (git.permission, path_permissions, workflow.skip_prompts, strict_mode only)
- `.buildflow/epics/[epic]/STATE.md` (if exists — resume wave/status, decisions, risks, test strategy)
- `.buildflow/epics/[epic]/ACCEPTANCE.md` (AC IDs + spec_version only — do not load full AC text)
- `.buildflow/epics/[epic]/PLAN.md` (header, wave index, task-to-AC map, file ownership map, completion markers only — not full task prose)
- `.buildflow/epics/[epic]/waves/wave-[N].md` (current wave only — do not load other wave files)
- `.buildflow/epics/[epic]/CHECK.md`
- `.buildflow/codebase/PATTERNS.md` (relevant sections for touched paths)
- `.buildflow/codebase/CODEBASE.md` (relevant sections for touched paths only)
- `.buildflow/codebase/DEPENDENCIES.md` (env vars, external service contracts, package constraints relevant to touched paths)
- `.buildflow/codebase/TESTING.md`
- `.buildflow/codebase/RISKS.md` (concerns relevant to touched paths only)
- `.buildflow/codebase/intel.json` (fields: `locale_support`, `local_support`, `entry_points`, `drift_baseline` only)

Do NOT load: full specs, full codebase, research, retros, old phases, other wave files.

---

## Step 0: Pre-flight

**Cross-repo check:** if `../.buildflow/workspace/STATE.md` has `current_xepic` set and current repo is in its `repos` list → suggest `cd .. && /buildflow-workspace build`. User may continue single-repo.

**State resume:** read STATE.md + MEMORY.md + PLAN.md (index) + current wave file + CHECK.md + epic STATE.md. Resume from last wave. Trust order on conflicts: PLAN.md > epic STATE.md > STATE.md. Update epic STATE.md before exiting each wave with: status, wave progress, deviations, files touched, next command, risks.

**Guards (apply throughout):**
- Git: read `git.permission` from PREFERENCES.md. If not `approved`: no-git mode — no commits, tags, worktrees, or resets.
- Folder access: check `path_permissions.[folder]` in PREFERENCES.md before any source file read/write. `approved` → proceed; `denied` → skip + warn; not listed → prompt once per folder per session.

---

## Step 1: Load, Validate & Confirm Plan
Read PLAN.md (header, wave index, task-to-AC map, file ownership, completion markers only). Report: "Phase [N] — [N] waves, [N] tasks, [N] ACs. Est: [total]. Starting Wave [N]."

**Parked-changes conflict check — runs before every build start:**

Read `parked_changes` array from `MEMORY.md`. If it is non-empty, cross-reference against the new phase's PLAN.md file lists:

For every file in the new plan's tasks, check if that file appears in `parked_changes`:

```
Parked Changes Conflict Detected
──────────────────────────────────
The following files have unresolved parked changes from a previous phase
AND are also listed in this phase's plan:

  src/auth/service.ts
    Parked: Phase 1, Wave 2 (2024-01-14)
    Reason: git commit failed
    Snapshot: .buildflow/snapshots/phase-1-wave-2-parked/
    New plan task: "Add refresh token logic" (Wave 2, this phase)

Building on top of parked changes means both features will be combined
in a single future git commit — you lose the ability to review or revert
them independently.

Options:
  [G] Resolve git first (recommended)
      Fix the git issue, commit Phase 1 changes, then start this phase.
      Run: /buildflow-help git-enable  OR  check your git remote/auth.

  [S] Stack and continue (acknowledged)
      BuildFlow will take a "stack snapshot" separating Phase 1 and Phase 2
      changes on these files before Phase 2 modifies them.
      When git is restored, you will see one combined diff — that is expected.
      Your PLAN.md will note which commits belong to which phase.

  [A] Abort this phase
      Come back after resolving the parked changes.
```

**If user chooses Stack and continue:**
1. Before Phase 2 writes anything to the overlapping files, copy their current state (which includes Phase 1's parked changes) into `.buildflow/snapshots/phase-[N-1]-final-state/`
2. Add a note to the new phase's PLAN.md:
   ```markdown
   ## Parked Changes Notice
   Files inherited with unresolved parked changes from Phase [N-1]:
     - src/auth/service.ts (parked wave 2, 2024-01-14)
   Stack snapshot: .buildflow/snapshots/phase-1-final-state/
   When git is restored: commit phase-1-final-state/ first, then commit current state.
   ```
3. Continue the build normally.

If `parked_changes` is empty: skip this check silently.

**Spec amendment gate — runs before every build start:**
1. Read `spec_version` from `PLAN.md` header (the version this plan was built against)
2. Read `spec_version` from `.buildflow/epics/[epic]/ACCEPTANCE.md` frontmatter (current version)
3. If they differ:
   ```
   🔴 BUILD BLOCKED — Spec Amended Since Plan Was Created

   Plan was built against spec v[plan version].
   Current spec is v[ACCEPTANCE.md version].

   The spec changed after this plan was locked. Some plan tasks may reference
   outdated ACs. Building against a stale plan risks implementing the wrong thing.

   Options:
     A) Run /buildflow-spec to regenerate the plan against the new spec (recommended)
     B) Run /buildflow-spec --review to see what changed between versions
     C) Continue anyway: /buildflow-build --accept-stale-spec
        (logs to epics/[epic]/DEBT.md: "Built against stale spec v[N] — current is v[M]")
   ```
4. If versions match: proceed silently.

Check external dependency checklist if present. If unchecked items: "Verify these before building: [list]"

---

**Scope-reduction check:** compare AC IDs in ACCEPTANCE.md vs PLAN.md. Dropped ACs: 0 → silent; 1–2 → warn [D]Deferred/[A]Accidental/[S]Scope-split; 3+ or >20% → BLOCK, run `/buildflow-spec`. If `parked_changes` in MEMORY.md overlap with plan files → prompt [G]Resolve git/[S]Stack/[A]Abort. Spec version mismatch (PLAN.md vs ACCEPTANCE.md) → BLOCK, run `/buildflow-spec --update`.

---

## Step 2 + 2b + 3 (Style Fingerprint): Detection Module

**Check for cached session first:** if `.buildflow/epics/[epic]/BUILD_SESSION.md` exists and matches current epic + spec_version — load it directly, skip detection.

Otherwise: → **Load module now:** Read `.claude/commands/buildflow-build-detect.md` and execute all steps in it. It will write `BUILD_SESSION.md` and return here.

After detection (cached or fresh), load the Test Framework Profile, Build Toolchain Profile, and Style Fingerprint from `BUILD_SESSION.md` into working context — every Builder in every wave needs these.

---

---

**Agent protocol:** Claude Code — spawn all non-overlapping Builders in a single response (true parallel). Other tools — sequential with `=== Builder: [name] START/END ===` markers. File-overlap tasks always serialize regardless of tool.

---

## Step 3: Wave Execution Loop

→ **Load module now:** Read `.claude/commands/buildflow-build-execute.md` and execute Steps 3a–3i for the current wave. Return here after each wave completes to start the next wave or proceed to Step 4.

---

## Step 2: Integration Check & Update Memory

Run targeted phase-level tests across all touched files + dependency neighborhoods. Ask once: [1] Defer to ship / [2] Impacted area / [3] Smoke / [4] Full suite. Check dangling imports. If regressions found in approved broader checks: fix before proceeding.

Update CHECK.md: mark ACs PASS/IN PROGRESS/FAIL/BLOCKED based on evidence. Refresh summary counts.

Update MEMORY.md: `last_build_date`, `plan_status: built`, `waves_completed`, `last_build_coverage`. Remove per-task details from previous builds.

---

## Guided Next Step

Before printing this block, check session context usage. After a completed wave or all-wave build, recommend clearing the current AI session after saving `STATE.md` when the session is large/noisy or a boundary has been reached; otherwise say it is OK to continue.

After all waves complete:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-check
   Why:  All waves complete — verify every AC is satisfied before shipping
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
```

If a wave failed and stopped: `→ Next: /buildflow-debug` (root-cause before retrying).
If all waves complete but tests are borderline: `→ Next: /buildflow-check` (check will surface what needs fixing).


