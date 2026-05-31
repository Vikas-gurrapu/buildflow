---
name: buildflow-settings
description: Interactive settings configurator — view and update BuildFlow preferences without editing markdown
allowed-tools: Read, Write
agent: strategist
---

# /buildflow-settings

View and update BuildFlow preferences interactively. Reads `.buildflow/PREFERENCES.md` and writes your changes back — no manual markdown editing required.

## Usage
- `/buildflow-settings` — show all current settings, then present the change menu
- `/buildflow-settings show` — print current settings only (no changes)
- `/buildflow-settings experience` — change experience level only
- `/buildflow-settings git` — change git permission only
- `/buildflow-settings coverage` — adjust spec coverage threshold
- `/buildflow-settings strict` — toggle strict mode
- `/buildflow-settings parallel` — toggle parallel agents / set max researchers
- `/buildflow-settings security` — toggle pre-ship security gate
- `/buildflow-settings workflow` — toggle workflow gates and behavior
- `/buildflow-settings reset` — restore all settings to BuildFlow defaults (asks for confirmation)

## Context Packet (load only these)
- `.buildflow/PREFERENCES.md`

Do NOT load any other file.

---

## Step 1: Load and Display Current Settings

Read `.buildflow/PREFERENCES.md` and extract current values. Display a clean summary:

```
BuildFlow Settings
──────────────────────────────────────────────────────────
  [1] Experience level        [junior / mid / senior]           current: [value]
  [2] Git permission          [approved / denied / denied_permanent] current: [value]
  [3] Spec coverage threshold [0–100%]                          current: [value]%
  [4] Spec coverage strict    [on / off]                        current: [value]
  [5] Strict mode             [on / off]                        current: [value]
  [6] Parallel agents         [on / off]                        current: [value]
  [7] Max parallel researchers [1–5]                            current: [value]
  [8] Pre-ship security gate  [on / off]                        current: [value]
  [9] Learning aids           [on / off]                        current: [value]
 [10] Undo / restore points   [on / off]                        current: [value]
 [11] Workflow toggles        [require_think / require_check / skip_prompts / research_depth] current: [summary]
──────────────────────────────────────────────────────────
Type one or more numbers to change settings (comma-separated, e.g. "1,3,7"), or "done" to finish.
```

If the user enters multiple numbers (e.g. `1,3,13`): process each setting in order, one after another — no need to return to the menu between them.

If invoked with a specific target (`experience`, `git`, `coverage`, etc.), skip the menu and go directly to that setting's prompt.

If invoked as `show`: print the table above and exit.

---

## Step 2: Change Loop

For each setting the user selects, show the current value and the available options:

---

### [1] Experience Level

```
Experience level controls how much explanation BuildFlow adds to generated code and decisions.

  [J] Junior — more explanations, analogies, LEARN: comments in generated code
  [M] Mid     — balanced; assumes framework knowledge, skips basics
  [S] Senior  — concise; assumes full-stack knowledge, no hand-holding

Current: [value]
New value: 
```

Update `experience:` in `PREFERENCES.md`.

---

### [2] Git Permission

```
Git permission controls whether BuildFlow uses git for commits, tags, and restore points.

  [A] Approved         — use git for commits, wave tracking, and restore points
  [D] Denied           — use file snapshots instead (can re-enable later)
  [P] Denied permanent — always use file snapshots, never ask again

Current: [value]
⚠ Changing this takes effect in your next AI session.
New value:
```

Update `git.permission:` in `PREFERENCES.md`.
Also update `git_available:` in `.buildflow/MEMORY.md` to match (`true` if approved, `false` otherwise).

---

### [3] Spec Coverage Threshold

```
Spec coverage threshold is the minimum % of business-logic files that must have AC traceability.
Below this threshold, /buildflow-check and /buildflow-ship prompt you (never a hard block).

  Enter a number 0–100 (current: [value]%, default: 70%)
  
  Suggested values:
    50  — lenient: only flag if coverage is very low
    70  — balanced (recommended)
    90  — strict: flag any significant uncovered business logic

New threshold (%):
```

Update `spec_coverage.threshold:` in `PREFERENCES.md`.

---

### [4] Spec Coverage Strict Mode

```
Strict coverage mode prompts on ANY drop below threshold, even 1%.

  [Y] On  — prompt whenever coverage drops, even slightly below threshold
  [N] Off — only prompt when coverage is materially below threshold (default)

Current: [value]
New value:
```

Update `spec_coverage.strict_mode:` in `PREFERENCES.md`.

---

### [5] Strict Mode (Spec-to-Code Mirroring)

```
Strict mode enforces structural spec-to-code mirroring for auth, payments, crypto, and compliance code.
When enabled, /buildflow-check --strict is mandatory before ship for every phase.

  [Y] On  — strict violations BLOCK ship; no override flag
  [N] Off — standard mode (default); use /buildflow-spec --strict for per-phase opt-in

⚠ Enabling globally is recommended only for projects where spec-code divergence is a security defect
  (e.g., fintech, healthcare, compliance-bound applications).

Current: [value]
New value:
```

Update `strict_mode:` in `PREFERENCES.md`.

---

### [6] Parallel Agents

```
Parallel agents run multiple Researchers or Builders simultaneously for faster execution.

  [Y] Enable  — run independent tasks in parallel (default)
  [N] Disable — serialize all agent execution (useful for debugging or quota-limited accounts)

Current: [value]
New value:
```

Update `parallel.enabled:` in `PREFERENCES.md`.

---

### [7] Max Parallel Researchers

```
Max parallel researchers controls how many Researcher agents run simultaneously in /buildflow-think.

  Enter a number 1–5 (current: [value], default: 3)
  
  1 = serial research (cheapest tokens, slowest)
  3 = recommended balance
  5 = maximum parallel (fastest, highest token cost)

New value:
```

Update `parallel.max_researchers:` in `PREFERENCES.md`.

---

### [8] Pre-Ship Security Gate

```
Pre-ship security gate runs /buildflow-audit before every /buildflow-ship.
Critical findings block ship. High findings warn but allow override.

  [Y] Enable  — security gate active (recommended)
  [N] Disable — skip security scan at ship time

Current: [value]
New value:
```

Update `security.pre_ship_gate:` in `PREFERENCES.md`.

---

### [9] Learning Aids

```
Learning aids add explanations, confidence checks, and source citations to agent responses.
Recommended for junior and mid-level developers; can be noisy for senior users.

  [Y] Enable  — show explanations, confidence scores, and research citations
  [N] Disable — terse output, no learning scaffolding

Current: [value]
New value:
```

Update `learning.show_explanations:`, `learning.confidence_calibration:`, `learning.source_citations:` together in `PREFERENCES.md`.

---

### [10] Undo / Restore Points

```
Restore points automatically snapshot files before destructive operations so /buildflow-back can undo.

  [Y] Enable  — create restore points (recommended)
  [N] Disable — no snapshots; /buildflow-back will have nothing to restore from

Current: [value]
New value:
```

Update `safety.enable_undo:` and `safety.restore_points:` in `PREFERENCES.md`.

---

### [11] Workflow Toggles

Show all toggles at once and let the user select **multiple** to change in one pass:

```
Workflow Toggles
──────────────────────────────────────────────────
Which toggles do you want to change? (comma-separated numbers, e.g. "1,3"):

  [1] require_think   [on / off]               current: [value]
        Require /buildflow-think before /buildflow-spec
  [2] require_check   [on / off]               current: [value]  (recommended: on)
        Require /buildflow-check before /buildflow-ship
  [3] skip_prompts    [on / off]               current: [value]
        Autonomous mode — skip confirmation prompts (yolo)
  [4] research_depth  [quick/standard/thorough] current: [value]
        Default depth for /buildflow-think
  [5] auto_wave_retry [on / off]               current: [value]
        Auto-retry a failed wave once before surfacing error

⚠ skip_prompts: on removes confirmation gates. Use only in trusted, low-risk projects.

Your selection (or "back"):
```

For each selected toggle, ask its new value inline:
- `[1] require_think` → `New value [on/off]:`
- `[2] require_check` → `New value [on/off]:`
- `[3] skip_prompts`  → `New value [on/off]:`
- `[4] research_depth` → `New value [quick/standard/thorough]:`
- `[5] auto_wave_retry` → `New value [on/off]:`

Apply all selected changes together, then confirm what changed.

Update the corresponding `workflow.*` keys in `PREFERENCES.md`.

---

### Reset to Defaults

```
⚠ Reset Confirmation

This will restore all preferences to BuildFlow defaults:
  experience: junior · git: approved · coverage: 70%
  strict_mode: off · parallel: on · max_researchers: 3 · security gate: on
  learning aids: on · restore points: on · skip_prompts: off
  require_think: off · require_check: on · research_depth: standard

Type "reset" to confirm, or anything else to cancel:
```

If confirmed: use the **Write tool** to rewrite the relevant yaml blocks in `PREFERENCES.md` with default values.

---

## Step 3: Write Changes

For each changed setting, use the **Write tool** to update the corresponding yaml block in `.buildflow/PREFERENCES.md`. Preserve all other content in the file — only replace the specific yaml value that changed.

After all changes are written, print:

```
Settings saved to .buildflow/PREFERENCES.md

Changed:
  experience: junior → senior

Changes take effect in your next AI session.
──────────────────────────────────────────────────
→ Next:  Continue with your current command
   Why:  Settings are saved. No restart needed — changes apply from your next session start.
──────────────────────────────────────────────────
```

If no changes were made, print: "No changes made."

