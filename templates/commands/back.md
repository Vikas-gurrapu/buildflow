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

Check available options in order:
1. Git commits (most reliable)
2. Named BuildFlow checkpoints in `.buildflow/phases/`
3. Git stash entries

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

For git restore:
```bash
git reset --hard [commit-hash]
```

For named checkpoint:
```bash
git checkout [checkpoint-tag]
```

## Step 5: Update State
Update `.buildflow/core/state.md` to reflect restored phase.
Update `.buildflow/memory/light.md` to match.

## Step 6: Confirm
Show: "Restored to: [checkpoint name] from [date]"
Suggest next action: "Run /buildflow-status to see current state."

## Token Budget: ~3K
