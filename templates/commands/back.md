---
name: buildflow-back
description: Undo recent changes and restore to a safe state
allowed-tools: Read, Write, Bash
agent: strategist
---

# /buildflow-back

Undo recent changes and restore to a known-good state.

## Usage
- `/buildflow-back` — undo last action
- `/buildflow-back 3` — undo last 3 actions
- `/buildflow-back --list` — show available restore points
- `/buildflow-back phase-1-complete` — restore to named checkpoint

## Step 1: List Restore Points

Before listing or using git restore points, read `.buildflow/you/preferences.md`.

- If `git.permission` is `approved`: git restore points may be listed and used.
- If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: **do not run git commands**. List only BuildFlow file snapshots and named phase checkpoints.
- If `preferences.md` is missing or `git.permission` is absent: ask the user before running any git command.

Check available options in order:
1. Named BuildFlow checkpoints in `.buildflow/phases/`
2. File snapshots in `.buildflow/snapshots/`
3. Git commits and stash entries (only if `git.permission: approved`)

Show numbered list with timestamps and descriptions.

## Step 2: Confirm Intent
Ask: "Which restore point do you want to go back to?"
Show what will be LOST if they go back.

## Step 3: Safety Check
If there are uncommitted changes:
```
⚠️  You have uncommitted changes.
    These will be lost: [list files]
    Type "yes, discard changes" to continue.
```

## Step 4: Restore

For git restore (only if `git.permission: approved`):
```bash
git reset --hard [commit-hash]
```

For named checkpoint (only if `git.permission: approved` and checkpoint is a git tag):
```bash
git checkout [checkpoint-tag]
```

For file snapshot restore:
Copy files from the selected `.buildflow/snapshots/...` directory back to their original paths.

## Step 5: Update State
Update `.buildflow/core/state.md` to reflect restored phase.
Update `.buildflow/memory/light.md` to match.

## Step 6: Confirm
Show: "Restored to: [checkpoint name] from [date]"
Suggest next action: "Run /buildflow-status to see current state."

## Token Budget: ~3K
