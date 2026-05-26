---
name: buildflow-revert
description: Revert the current or named BuildFlow spec/workflow safely
allowed-tools: Read, Write, Bash, Glob
agent: strategist
---

# /buildflow-revert

Safely remove or roll back BuildFlow workflow artifacts for the current, last, named, or all specs.

This command reverts BuildFlow planning/spec metadata first. It only reverts source code after explicit user confirmation, and only for the current in-progress workflow.

## Usage
- `/buildflow-revert` - revert the current in-progress spec/workflow; if none is active, revert the last spec
- `/buildflow-revert --spec <name-or-slug>` - revert a specific spec folder or task/spec name
- `/buildflow-revert --task <name-or-slug>` - alias for `--spec`; useful when the user remembers the task name
- `/buildflow-revert --last` - revert the most recently created spec/workflow
- `/buildflow-revert --all` - delete all generated spec workflow folders and latest spec files after confirmation
- `/buildflow-revert --list` - list known specs/workflows and their status

## Scope

Spec/workflow artifacts include:
- `.buildflow/specs/[spec-slug]/REQUIREMENTS.md`
- `.buildflow/specs/[spec-slug]/TECHINICALDESIGN.md`
- `.buildflow/specs/[spec-slug]/acceptance.md`
- `.buildflow/specs/[spec-slug]/approvals.md`
- `.buildflow/specs/[spec-slug]/meta.md`
- latest compatibility files under `.buildflow/specs/REQUIREMENTS.md`, `TECHINICALDESIGN.md`, and `acceptance.md` when they point to the reverted spec
- phase artifacts linked to the spec: `.buildflow/phases/[N]/PLAN.md`, `VERIFICATION.md`, `STATE.md`, `STRICT-REPORT.md`, `COVERAGE-MAP.md` when their header/frontmatter references the target `spec_slug`, `spec_name`, or `spec_version`

Do not delete `.buildflow/specs/approvals.md`. Append a revert record there instead. It is the permanent audit trail.

## Step 1: Load Registry

Read:
- `.buildflow/specs/index.md` if it exists
- `.buildflow/memory/light.md`
- `.buildflow/core/state.md`
- `.buildflow/specs/*/meta.md`
- `.buildflow/phases/*/STATE.md` and `.buildflow/phases/*/PLAN.md` only as needed to map phases to a spec

If `--list`:
Print:
```
Known BuildFlow specs
─────────────────────
1. [spec_slug] — [spec_name] — status: [draft/locked/planned/building/shipped/reverted] — phase: [N] — updated: [date]
```
Then stop.

## Step 2: Resolve Target

Resolve target in this order:
1. `--all`: target all spec folders under `.buildflow/specs/*/`
2. `--spec <name-or-slug>` or `--task <name-or-slug>`: match against folder slug, `meta.md` spec name, task name, title, or index row
3. `--last`: newest spec by `meta.md` updated/created date; if unavailable, newest folder modified time
4. default: current active spec from `light.md` (`current_spec_slug`, `spec_slug`, or current phase `STATE.md`)
5. if no current spec exists: last spec

If multiple targets match a name, show choices and ask the user to select one.
If no target matches, show known specs and stop.

## Step 3: Determine Status

Classify the target:
- **current/in-progress**: status is draft, locked, planned, building, check_failed, or current phase points to it
- **completed**: status is shipped, archived, or phase has `SHIPPED.md`
- **unknown**: no phase/status metadata is available

For current/in-progress specs, source code may have been changed. For completed specs, do not revert source code from this command; delete only BuildFlow markdown artifacts unless the user explicitly runs `/buildflow-back` for a restore point.

## Step 4: Show Impact and Confirm

For a single target:
```
Revert target: [spec_name] ([spec_slug])
Status: [current/in-progress/completed/unknown]

BuildFlow files to remove/update:
- [list exact files]

Phase files affected:
- [list exact phase files]

Source code:
- [if current/in-progress] Code changes may exist for this workflow.
- [if completed] Code will not be reverted by this command.
```

Ask:
```
Choose revert scope:
1. Spec files only - delete BuildFlow spec/phase markdown for this workflow
2. Spec files + code revert - only available for current/in-progress workflows
3. Cancel
```

Rules:
- Option 2 requires `git.permission: approved` or a BuildFlow snapshot that clearly maps to this workflow.
- If `git.permission` is not approved, do not run git commands. Offer snapshot restore if an exact matching snapshot exists; otherwise say code revert needs `/buildflow-back` or manual review.
- For completed specs, hide option 2 and state: "Completed workflows only remove BuildFlow markdown here. Use `/buildflow-back` with an explicit restore point for code rollback."

For `--all`, require stronger confirmation:
```
This will delete all generated spec workflow folders and latest spec files.
Type: delete all buildflow specs
```

## Step 5: Revert BuildFlow Files

For each selected target:
1. Delete the target folder `.buildflow/specs/[spec-slug]/`.
2. Delete phase markdown files linked to that target:
   - `PLAN.md`
   - `VERIFICATION.md`
   - `STATE.md`
   - `STRICT-REPORT.md`
   - `COVERAGE-MAP.md`
   - Do not delete `SHIPPED.md` or `retro.md` unless `--all` and user explicitly confirms completed history deletion.
3. If latest compatibility files under `.buildflow/specs/` match the target, remove them or replace them with the newest remaining spec's files:
   - `REQUIREMENTS.md`
   - `TECHINICALDESIGN.md`
   - `acceptance.md`
4. Update `.buildflow/specs/index.md`:
   - mark reverted specs as `reverted` with timestamp, or remove them entirely when `--all` was confirmed
   - set `current: false`
   - set the newest remaining non-reverted spec as current
5. Append to `.buildflow/specs/approvals.md`:
   ```
   ## Reverted — [spec_slug] — [datetime]
   Reason: user requested /buildflow-revert [args]
   Scope: spec files only / spec files + code revert / all
   ```

## Step 6: Optional Code Revert for Current Workflows

Only run this step if the user selected "Spec files + code revert".

Before any git command, read `.buildflow/you/preferences.md`.

If `git.permission: approved`:
- Prefer a BuildFlow-created branch/tag/checkpoint that maps to the target.
- If no exact checkpoint exists, show changed files and ask before reverting.
- Never run `git reset --hard` without an explicit restore point and explicit confirmation.

If no-git mode:
- Restore only from a BuildFlow snapshot whose metadata maps to this spec/workflow.
- If no exact snapshot exists, stop and explain which files likely need manual review.

## Step 7: Update State

Update `.buildflow/memory/light.md`:
- Clear `current_spec_slug`, `current_spec_name`, `spec_status`, and `spec_version` if the reverted target was current.
- Clear `current_phase` only when its phase artifacts were removed.
- Set `last_revert: [datetime] [spec_slug]`.

Update `.buildflow/core/state.md`:
- Add a phase/history note that `[spec_slug]` was reverted.
- If another spec remains current, point next action to `/buildflow-plan` or `/buildflow-build` based on that spec's status.

## Step 8: Result

Print:
```
Reverted: [spec_name] ([spec_slug])
Scope: [spec files only / spec files + code / all]
Files removed: [N]
Latest spec now: [spec_slug or none]

Next: /buildflow-status
```

If context is large after the revert, recommend:
`/clear`, then `/buildflow-status`.

## Token Budget: ~4K
