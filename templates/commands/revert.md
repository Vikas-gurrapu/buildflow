---
name: buildflow-revert
description: Revert the current or a named phase's spec and plan artifacts safely
allowed-tools: Read, Write, Bash, Glob
agent: strategist
---

# /buildflow-revert

Safely remove or roll back BuildFlow planning and spec artifacts for the current or a named phase.

This command reverts BuildFlow planning/spec metadata first. It only reverts source code after explicit user confirmation, and only for the current in-progress phase.

## Usage
- `/buildflow-revert` — revert the current in-progress phase; if none is active, revert the last phase
- `/buildflow-revert --phase <N>` — revert a specific phase by number
- `/buildflow-revert --wave <N>` — revert a specific wave's code changes within the current phase
- `/buildflow-revert --wave <N> --phase <P>` — revert wave N within a specific phase
- `/buildflow-revert --task <name>` — revert a specific task's file changes within the current wave
- `/buildflow-revert --last` — revert the most recently created phase
- `/buildflow-revert --all` — delete all phase folders and spec artifacts after confirmation
- `/buildflow-revert --list` — list known phases, waves, and their revert status

## Scope

Phase artifacts that can be reverted:
- `.buildflow/epics/[epic]/SPEC.md`
- `.buildflow/epics/[epic]/ACCEPTANCE.md`
- `.buildflow/epics/[epic]/PLAN.md`
- `.buildflow/epics/[epic]/waves/` (all wave files)
- `.buildflow/epics/[epic]/CHECK.md`
- `.buildflow/epics/[epic]/STATE.md`

Do not delete `.buildflow/epics/[epic]/APPROVALS.md`. Append a revert record there instead — it is the permanent audit trail.
Do not delete `SHIPPED.md` or `RETRO.md` unless `--all` and the user explicitly confirms completed history deletion.

---

## Wave Revert (`--wave <N>`)

Reverts a specific wave's code changes without touching other waves or spec artifacts. Use this when a wave was built but doesn't meet requirements — the spec stays locked, only the implementation is rolled back.

### Step WR1: Locate, Show Impact & Confirm

Read `.buildflow/epics/[epic]/PLAN.md` wave index. Find wave N's completion status and snapshot reference.

**Git mode (`git.permission: approved`):**
- Read PLAN.md wave N header — find the commit hash recorded at wave completion
- If no commit hash recorded: scan git log for the commit message pattern `[type](scope): ... [Wave: N of M]`
- Show: `Wave [N] commit: [hash] — "[message]" — [date]`

**No-git mode:**
- Check `.buildflow/snapshots/phase-[P]-wave-[N]-complete/` for the wave snapshot
- Read `SNAPSHOT.md` inside it for the file list and timestamp
- Show: `Wave [N] snapshot: [N] files — [date]`

If neither found: "No revert point found for Wave [N]. Wave may not have completed or snapshot was deleted."

#### Show Impact

```
Wave Revert: Wave [N] — [wave name]
────────────────────────────────────────
Files this wave owns (will be reverted):
  src/routes/photo.ts          (modified in wave [N])
  src/services/PhotoService.ts (created in wave [N])
  src/services/PhotoService.test.ts (created in wave [N])

ACs covered by this wave (will return to NOT STARTED):
  AC-005, AC-006, AC-007

Waves that depend on this wave (will be affected):
  Wave [N+1] — [name] (HARD dependency — may break if Wave [N] is reverted)

Spec artifacts: unchanged — SPEC.md and ACCEPTANCE.md stay locked.
```

If downstream waves were already built on top of wave N: warn strongly — reverting wave N without reverting the downstream waves may leave the codebase in a broken state. Recommend reverting downstream waves first (highest wave number first).

#### Confirm

```
Choose revert scope for Wave [N]:
1. Code only — restore wave [N] files to pre-wave state
2. Code + CHECK.md — also reset wave [N]'s ACs to NOT STARTED in CHECK.md
3. Cancel
```

### Step WR2: Execute & Update State

**Git mode:**
```bash
git revert [wave-N-commit-hash] --no-commit
git add [wave-N-files]
git commit -m "revert(wave-[N]): revert wave [N] — did not meet requirements"
```
If the wave commit merged multiple tasks: revert each file individually to its pre-wave state using `git checkout [pre-wave-commit] -- [file]`.

**No-git mode:**
- Copy each file from `.buildflow/snapshots/phase-[P]-wave-[N]-complete/` back to its original location, overwriting the current version
- If a file was *created* in wave N (didn't exist before): delete it

#### Update State

- Update `PLAN.md` wave N status: `REVERTED [datetime] — reason: user requested`
- If scope 2: update `CHECK.md` — set wave N's ACs back to `NOT STARTED`, clear evidence
- Update `STATE.md`: `last_wave_completed: [N-1]`, add revert note
- Append to `APPROVALS.md`: `## Wave [N] Reverted — [datetime] — Reason: user requested`

Print:
```
✓ Wave [N] reverted — [N] files restored
ACs reset: AC-005, AC-006, AC-007 → NOT STARTED

──────────────────────────────────────────────────
→ Next:  /buildflow-build wave-[N]
   Why:  Wave reverted — re-run build to implement wave [N] again
──────────────────────────────────────────────────
```

---

## Task Revert (`--task <name>`)

Reverts a specific task's file changes within the current wave. Use when one task in a wave didn't meet requirements but the rest of the wave is fine.

### Step TR1: Assess & Execute — Locate, Show Impact, Confirm & Revert

Read the current wave's wave file. Find the task by name. Extract its `Files:` list — these are the only files this task owns.

#### Show Impact

```
Task Revert: "[task name]" — Wave [N]
────────────────────────────────────────
Files owned by this task (will be reverted):
  src/services/PhotoService.ts  (created)
  src/services/PhotoService.test.ts (created)

ACs this task covers: AC-005, AC-006
Other tasks in Wave [N] that depend on this task's output: [list or NONE]
```

If other tasks in the same wave depend on this task (HARD dependency): warn — reverting this task may break those tasks too.

#### Confirm + Execute

**Git mode:**
- For each file owned by this task: `git checkout [pre-wave-commit] -- [file]`
- For files *created* by this task: `git rm [file]` then delete
- Commit: `revert(task): revert "[task name]" — did not meet requirements`

**No-git mode:**
- Check task-level snapshot if exists: `.buildflow/snapshots/phase-[P]-wave-[N]-task-[name]/`
- If no task snapshot: restore from wave pre-state snapshot (`.buildflow/snapshots/phase-[P]-wave-[N]-start/` if recorded) for this task's files only
- If no snapshot at all: list the task's owned files and ask user to restore manually

#### Update State

- Mark task as `REVERTED` in `PLAN.md` wave N task list
- Update `CHECK.md` — reset this task's ACs to `NOT STARTED`
- Append revert record to `APPROVALS.md`

Print:
```
✓ Task "[name]" reverted — [N] files restored
ACs reset: AC-005, AC-006 → NOT STARTED

──────────────────────────────────────────────────
→ Next:  /buildflow-build wave-[N] --task "[name]"
   Why:  Task reverted — re-run to rebuild this task only
──────────────────────────────────────────────────
```

---

## Step 1: Load, Resolve & Assess

Read:
- `.buildflow/MEMORY.md`
- `.buildflow/STATE.md`
- `.buildflow/epics/*/STATE.md` (header only — phase number, status, last command)

If `--list`:
Print:
```
Known BuildFlow phases
──────────────────────
1. Phase [N] — status: [draft/spec_locked/plan_ready/build_in_progress/built/check_passed/shipped/reverted] — updated: [date]
```
Then stop.

### Resolve Target

Resolve target in this order:
1. `--all`: target all phase folders under `.buildflow/epics/*/`
2. `--phase <N>`: match the exact phase number
3. `--last`: newest phase by `STATE.md` updated date; if unavailable, newest folder modified time
4. default: current active phase from `MEMORY.md` (`current_epic`) or `STATE.md`
5. if no current phase exists: last phase

If no target matches, show known phases and stop.

### Determine Status

Classify the target:
- **current/in-progress**: status is draft, spec_locked, plan_ready, build_in_progress, built, check_passed, or check_failed
- **completed**: status is shipped or phase has `SHIPPED.md`
- **unknown**: no phase/status metadata available

For current/in-progress phases, source code may have been changed. For completed phases, do not revert source code from this command; delete only BuildFlow markdown artifacts unless the user explicitly uses a restore point.

## Step 2: Confirm & Revert BuildFlow Files

For a single target:
```
Revert target: Phase [N]
Status: [current/in-progress/completed/unknown]

BuildFlow files to remove/update:
- [list exact files]

Source code:
- [if current/in-progress] Code changes may exist for this phase.
- [if completed] Code will not be reverted by this command.
```

Ask:
```
Choose revert scope:
1. Spec files only - delete BuildFlow phase markdown for this phase
2. Spec files + code revert - only available for current/in-progress phases
3. Cancel
```

Rules:
- Option 2 requires `git.permission: approved` or a BuildFlow snapshot that clearly maps to this phase.
- If `git.permission` is not approved, do not run git commands. Offer snapshot restore if an exact matching snapshot exists; otherwise say code revert needs manual review.
- For completed phases, hide option 2 and state: "Completed phases only remove BuildFlow markdown here. Use a restore point for code rollback."

For `--all`, require stronger confirmation:
```
This will delete all phase folders and their artifacts.
Type: delete all buildflow phases
```

### Revert BuildFlow Files

For each selected target:
1. Delete these phase markdown files from `.buildflow/epics/[epic]/`:
   - `SPEC.md`
   - `ACCEPTANCE.md`
   - `PLAN.md`
   - `waves/` (all wave files)
   - `CHECK.md`
   - `STATE.md`
2. Do not delete: `APPROVALS.md`, `SHIPPED.md`, `RETRO.md` (unless `--all` with explicit confirmation).
3. Append to `.buildflow/epics/[epic]/APPROVALS.md`:
   ```
   ## Reverted — Phase [N] — [datetime]
   Reason: user requested /buildflow-revert [args]
   Scope: spec files only / spec files + code revert / all
   ```

## Step 3: Code Revert & Update State

Only run this step if the user selected "Spec files + code revert".

Apply Git Permission Guard: read `git.permission` from `PREFERENCES.md`. If not `approved`: no git commands this session.


### Update State

Update `.buildflow/MEMORY.md`:
- Clear `current_epic`, `spec_status`, and `spec_version` if the reverted phase was current.
- Set `last_revert: [datetime] Phase [N]`.

Update `.buildflow/STATE.md`:
- Add a history note that Phase [N] was reverted.
- If another phase is still active, point next action to `/buildflow-spec` or `/buildflow-build` based on that phase's status.

## Step 4: Result

Print:
```
Reverted: Phase [N]
Scope: [spec files only / spec files + code / all]
Files removed: [N]

Next: /buildflow-status
```

If context is large after the revert, recommend:
`/clear`, then `/buildflow-status`.


