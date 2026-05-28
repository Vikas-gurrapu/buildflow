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
- `/buildflow-revert` - revert the current in-progress phase; if none is active, revert the last phase
- `/buildflow-revert --phase <N>` - revert a specific phase by number
- `/buildflow-revert --last` - revert the most recently created phase
- `/buildflow-revert --all` - delete all phase folders and spec artifacts after confirmation
- `/buildflow-revert --list` - list known phases and their status

## Scope

Phase artifacts that can be reverted:
- `.buildflow/epics/[epic]/REQUIREMENTS.md`
- `.buildflow/epics/[epic]/DESIGN.md`
- `.buildflow/epics/[epic]/ACCEPTANCE.md`
- `.buildflow/epics/[epic]/PLAN.md`
- `.buildflow/epics/[epic]/VERIFICATION.md`
- `.buildflow/epics/[epic]/STATE.md`
- `.buildflow/epics/[epic]/COVERAGE.md`

Do not delete `.buildflow/epics/[epic]/APPROVALS.md`. Append a revert record there instead — it is the permanent audit trail.
Do not delete `SHIPPED.md` or `RETRO.md` unless `--all` and the user explicitly confirms completed history deletion.

## Step 1: Load Registry

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

## Step 2: Resolve Target

Resolve target in this order:
1. `--all`: target all phase folders under `.buildflow/epics/*/`
2. `--phase <N>`: match the exact phase number
3. `--last`: newest phase by `STATE.md` updated date; if unavailable, newest folder modified time
4. default: current active phase from `MEMORY.md` (`current_epic`) or `STATE.md`
5. if no current phase exists: last phase

If no target matches, show known phases and stop.

## Step 3: Determine Status

Classify the target:
- **current/in-progress**: status is draft, spec_locked, plan_ready, build_in_progress, built, check_passed, or check_failed
- **completed**: status is shipped or phase has `SHIPPED.md`
- **unknown**: no phase/status metadata available

For current/in-progress phases, source code may have been changed. For completed phases, do not revert source code from this command; delete only BuildFlow markdown artifacts unless the user explicitly uses a restore point.

## Step 4: Show Impact and Confirm

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

## Step 5: Revert BuildFlow Files

For each selected target:
1. Delete these phase markdown files from `.buildflow/epics/[epic]/`:
   - `REQUIREMENTS.md`
   - `DESIGN.md`
   - `ACCEPTANCE.md`
   - `PLAN.md`
   - `VERIFICATION.md`
   - `STATE.md`
   - `COVERAGE.md`
2. Do not delete: `APPROVALS.md`, `SHIPPED.md`, `RETRO.md` (unless `--all` with explicit confirmation).
3. Append to `.buildflow/epics/[epic]/APPROVALS.md`:
   ```
   ## Reverted — Phase [N] — [datetime]
   Reason: user requested /buildflow-revert [args]
   Scope: spec files only / spec files + code revert / all
   ```

## Step 6: Optional Code Revert for Current Phases

Only run this step if the user selected "Spec files + code revert".

Before any git command, read `.buildflow/PREFERENCES.md`.

If `git.permission: approved`:
- Prefer a BuildFlow-created branch/tag/checkpoint that maps to the target phase.
- If no exact checkpoint exists, show changed files and ask before reverting.
- Never run `git reset --hard` without an explicit restore point and explicit confirmation.

If no-git mode:
- Restore only from a BuildFlow snapshot whose metadata maps to this phase.
- If no exact snapshot exists, stop and explain which files likely need manual review.

## Step 7: Update State

Update `.buildflow/MEMORY.md`:
- Clear `current_epic`, `spec_status`, and `spec_version` if the reverted phase was current.
- Set `last_revert: [datetime] Phase [N]`.

Update `.buildflow/STATE.md`:
- Add a history note that Phase [N] was reverted.
- If another phase is still active, point next action to `/buildflow-spec` or `/buildflow-build` based on that phase's status.

## Step 8: Result

Print:
```
Reverted: Phase [N]
Scope: [spec files only / spec files + code / all]
Files removed: [N]

Next: /buildflow-status
```

If context is large after the revert, recommend:
`/clear`, then `/buildflow-status`.

## Token Budget: ~4K

