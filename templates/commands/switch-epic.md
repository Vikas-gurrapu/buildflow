---
name: buildflow-switch-epic
max_context_kb: 15
description: Pause the current epic and switch to another, or resume a paused epic
allowed-tools: Read, Write, Bash, Glob
agent: strategist
---

# /buildflow-switch-epic

Pause the active epic and activate a different one, or resume a previously paused epic. Epic context is fully preserved â€” the paused epic picks up exactly where it left off.

## Usage
- `/buildflow-switch-epic` â€” show active + paused epics, prompt to switch
- `/buildflow-switch-epic 2-payments` â€” switch directly to a named epic
- `/buildflow-switch-epic --list` â€” list all epics (active, paused, not started)
- `/buildflow-switch-epic --resume` â€” list paused epics and pick one to resume

## Step 1: Load Current State

Read `.buildflow/STATE.md` and `.buildflow/MEMORY.md`.

Identify:
- `current_epic` â€” the active epic
- `paused_epics[]` â€” any previously paused epics
- All epic directories under `.buildflow/epics/`

## Step 2: Show Epic Status

Print the current state:

```
Epic Status
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â— Active:   [current_epic] â€” "[name]"  ([last_status], wave [N])
â—‹ Paused:   [epic-slug] â€” "[name]"     ([last_status], wave [N])  paused [date]
â—‹ Paused:   [epic-slug] â€” "[name]"     ([last_status])            paused [date]
â—‹ Pending:  [epic-slug] â€” "[name]"     (not started)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

If no target was passed via args, prompt:
```
Switch to which epic? (enter slug or press Enter to cancel):
>
```

## Step 3: Validate Target

If the target epic slug is the current active epic: print "Already active â€” no switch needed." and exit.

If the target epic directory does not exist under `.buildflow/epics/`: print "Epic '[slug]' not found. Run /buildflow-start-epic to create it." and exit.

## Step 4: Pause the Current Epic

Read `.buildflow/epics/[current_epic]/STATE.md`.

Use the **Write tool** to update `.buildflow/STATE.md`:
- Add the current epic to `paused_epics[]`:
  ```yaml
  - epic: [current_epic]
    paused_at: [today ISO date]
    last_status: [current status from epic STATE.md]
    last_wave: [current wave number, or null if no wave active]
    last_command: [last_command from epic STATE.md]
  ```
- Set `current_epic: [target-epic]`

Use the **Write tool** to update `.buildflow/epics/[current_epic]/STATE.md`:
- Add `paused: true` and `paused_at: [today]` to Current State block

Print:
```
â¸ Paused: [current_epic] at [last_status] (wave [N])
```

## Step 5: Activate Target Epic

Check if the target epic is in `paused_epics[]`:

**Resuming a paused epic:**
- Remove it from `paused_epics[]` in STATE.md
- Update `.buildflow/epics/[target]/STATE.md`: remove `paused: true`, set `last_resumed: [today]`
- Load the epic's STATE.md and print the resume summary:
  ```
  â–¶ Resumed: [target] â€” picking up from [last_status]
     Last command: [last_command]
     Next command: [next_command from STATE.md]
  ```

**Activating a new (not-yet-started) epic:**
- Set `current_epic: [target]` in STATE.md
- Print:
  ```
  â–¶ Activated: [target] â€” ready to start
     Run /buildflow-spec to generate requirements and plan.
  ```

## Step 6: Update MEMORY.md

Use the **Write tool** to update `.buildflow/MEMORY.md`:
- Set `current_epic: [target]`
- Update `last_session: [today]`

## Step 7: Print Summary

```
Switch Complete
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Paused:   [previous_epic] â€” [last_status]
Active:   [target_epic] â€” [status]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  [next_command from target epic's STATE.md]
   Why:  [resume context â€” what was happening when this epic was last active]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Context: Saved to STATE.md. Run /clear before continuing â€” switching epics is a context boundary.
```

