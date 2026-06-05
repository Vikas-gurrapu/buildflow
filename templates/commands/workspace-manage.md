---
name: buildflow-workspace-manage
description: Module — workspace management subcommands (debug, pause, resume, switch, revert). Loaded by /buildflow-workspace.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Workspace Manage Module

Loaded by /buildflow-workspace when a management subcommand is invoked. Execute the relevant mode and return.
## Workspace Debug Mode (`/buildflow-workspace debug`)

Triages cross-repo failures. Determines whether a failing AC is a repo-internal bug or a contract mismatch between repos. Runs targeted debug per failing repo with shared contract context injected.

Use this when:
- `/buildflow-workspace check` reports FAIL ACs in one or more repos
- A feature works in isolation in one repo but breaks when integrated with another
- You suspect the root cause is in a different repo than where the failure surfaces

### Step DB1: Load State, Identify & Triage

Read:
- `.buildflow/workspace/STATE.md` â†’ current xepic, repos, build order
- `.buildflow/workspace/epics/[slug]/XPLAN.md` â†’ cross-repo contract
- `.buildflow/workspace/epics/[slug]/STATUS.md` â†’ per-repo AC counts
- For each repo with `status != checked` or known failing ACs: `[repo-path]/.buildflow/epics/[slug]/CHECK.md`

Build a failure map:

```
Cross-Repo Debug: [feature]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Failing repos:
  react-module   â€” AC-005: photo upload shows no preview after upload
  react-module   â€” AC-006: error toast missing on 413 response

Contract defined in: api-module
Contract status:     api-module built âœ“

Triage starting...
```

#### Contract Triage

Before running per-repo debug, check whether the failure is a contract mismatch:

1. Load the contract from XPLAN.md (endpoint shape, response fields, error codes)
2. For each failing AC in a consuming repo: check if the failure description references a field, status code, or behavior that is defined in the contract
3. Load the contract-defining repo's actual implementation â€” read the relevant route/handler/type file to confirm what it actually returns (not just what the spec says)
4. Compare expected contract (XPLAN.md) vs. actual implementation (source file)

**Contract mismatch detected â€” example:**
```
Contract Triage
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
XPLAN.md contract:
  POST /users/:id/photo â†’ { photo_url: string, updated_at: string }

api-module actual (src/routes/photo.ts):
  returns { url: string, updatedAt: string }   â† field names differ

Root cause: api-module returns `url` not `photo_url`, `updatedAt` not `updated_at`
Affects: react-module AC-005, AC-006 (consuming `photo_url` from response)

Options:
  [A] Fix contract in api-module (rename fields to match spec)
  [B] Update react-module to consume actual field names (update XPLAN.md to match)
  [C] Investigate further before deciding
```

**No contract mismatch â€” example:**
```
Contract Triage
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
api-module contract matches XPLAN.md âœ“
  POST /users/:id/photo â†’ { photo_url: string, updated_at: string } âœ“

Failures are repo-internal to react-module.
Proceeding to per-repo debug.
```

### Step DB2: Per-Repo Debug & Report

For each repo with failures, in build order (contract-defining repo first if it has a mismatch):

1. Print: `Debugging [N/total]: [repo-path]/ â”€â”€â”€â”€â”€â”€â”€â”€`
2. Set file context to that repo's root
3. Load context packet:
   - `[repo-path]/.buildflow/epics/[slug]/SPEC.md` (API contracts + failing AC descriptions)
   - `[repo-path]/.buildflow/epics/[slug]/CHECK.md` (failing AC details)
   - `[repo-path]/.buildflow/codebase/PATTERNS.md` (if exists)
   - Relevant XPLAN.md contract section (cross-repo boundary context)
4. For contract mismatch root cause: fix the contract-defining repo first, then re-verify the consuming repo's ACs against the corrected output before debugging the consuming repo independently
5. Run `/buildflow-debug` steps scoped to this repo's failing ACs â€” inject the cross-repo contract as fixed context so the debug session doesn't treat contract fields as unknowns
6. On fix applied:
   - Update `[repo-path]/.buildflow/epics/[slug]/CHECK.md`
   - Update `.buildflow/workspace/epics/[slug]/STATUS.md`
   - Update `.buildflow/workspace/STATE.md` â†’ `repos.[repo].status`

#### Root Cause Report

After all failing repos are debugged:

```
Cross-Repo Debug Complete â€” [feature]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Root cause summary:
  CONTRACT MISMATCH  api-module returned `url` instead of `photo_url`
                     Fixed: src/routes/photo.ts updated to match XPLAN.md contract
  REPO-INTERNAL      react-module AC-006: error toast not wired to 413 handler
                     Fixed: src/components/PhotoUpload.tsx

AC status after fixes:
| Repo         | ACs | Pass | Fail | Unverified |
|--------------|-----|------|------|------------|
| api-module   | 8   | 8    | 0    | 0          |
| react-module | 6   | 6    | 0    | 0          |
| **Total**    | 14  | 14   | 0    | 0          |

XPLAN.md contract: [updated if contract was corrected]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace check
   Why:  Fixes applied â€” re-run check to confirm all ACs pass before shipping
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

If contract was corrected during debug, XPLAN.md Cross-Repo Contract section is updated to reflect the actual implemented shape.

---

## Workspace Pause Mode (`/buildflow-workspace pause`)

Pauses the active xepic and preserves full per-repo state so work can resume exactly where it left off.

### Step PA1: Load State & Snapshot Code

Read `.buildflow/workspace/STATE.md`. If `current_xepic: none`: print "No active xepic to pause." and exit.

Show current state:
```
Active xepic: [slug] â€” [xepic_status]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  api-module     status: built        last: /buildflow-workspace build
  react-module   status: build_in_progress   last: wave 2 of 3
```

Ask: `Pause this xepic? [Y/n]`

#### Code Snapshot (no-git mode only)

Check each repo's `git.permission` in `[repo-path]/.buildflow/PREFERENCES.md`:

**Git enabled (per repo):** code is safe on the `buildflow/xepic-[slug]` branch â€” no snapshot needed. Record `snapshot_mode: git` in the paused entry.

**No-git mode (per repo):** create a file snapshot of all source files touched by this xepic's waves:

1. Read `[repo-path]/.buildflow/epics/[epic_slug]/waves/wave-*.md` â€” collect every file listed under `Files:` across all tasks
2. Copy each file to `.buildflow/workspace/snapshots/[slug]/[repo-name]/[relative-path]`
3. Write a snapshot manifest: `.buildflow/workspace/snapshots/[slug]/[repo-name]/SNAPSHOT.md`
   ```markdown
   # Snapshot: [repo-name] â€” xepic [slug]
   **Created:** [ISO datetime]
   **Reason:** workspace pause
   **Wave status at pause:** wave [N] of [M] (last completed task: [task name])

   ## Files Snapshotted
   - src/routes/photo.ts  (sha: [hash])
   - src/components/Gallery.tsx  (sha: [hash])
   ```
4. Record `snapshot_mode: file` and `snapshot_path: .buildflow/workspace/snapshots/[slug]/[repo-name]/` in the paused entry

If a file listed in waves doesn't exist yet (task not started): skip it â€” nothing to snapshot.

### Step PA2: Write Paused State & Report

Use the **Write tool** to update `.buildflow/workspace/STATE.md`:
- Add current xepic to `paused_xepics[]`:
  ```yaml
  paused_xepics:
    - slug: [current_xepic]
      paused_at: [ISO datetime]
      xepic_status: [current xepic_status]
      build_order: [current build_order]
      repos:
        [repo]:
          path: [path]
          epic_slug: [epic_slug]
          status: [status]
          last_command: [last_command]
          snapshot_mode: git | file
          snapshot_path: [path if file mode, null if git]
      rollback_branches: [current rollback_branches]
  ```
- Set `current_xepic: none`
- Set `xepic_status: none`
- Clear `build_order: []`, `repos: {}`, `rollback_branches: []`

#### Summary

```
â¸ Paused: [slug]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  api-module     saved at: built          [git branch âœ“]
  react-module   saved at: build_in_progress (wave 2/3)   [snapshot: 6 files]

Resume anytime with:
  /buildflow-workspace resume

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace switch "[new-feature]"
   Why:  Workspace is clear â€” start a new xepic or switch to a paused one
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---

## Workspace Resume Mode (`/buildflow-workspace resume`)

Lists paused xepics and resumes the selected one. Distinct from `build --resume` (which resumes an interrupted build mid-wave) â€” this restores a deliberately paused xepic as the active one.

### Step RE1: Load, Restore Code & Select

Read `.buildflow/workspace/STATE.md` â†’ `paused_xepics[]`.

If empty: print "No paused xepics found." and exit.

If `current_xepic` is already active: warn "Active xepic [slug] in progress. Pause it first with `/buildflow-workspace pause` before resuming another."

Show list:
```
Paused xepics
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  [1]  1-photo-upload    paused 2026-05-12   status: build_in_progress
         api-module: built Â· react-module: build_in_progress (wave 2/3)
  [2]  2-user-profiles   paused 2026-05-08   status: spec_ready
         api-module: spec_ready Â· react-module: pending

Resume which xepic? (enter number):
```

#### Code Restore Check

For each repo in the paused xepic, check `snapshot_mode`:

**Git mode (`snapshot_mode: git`):**
- Confirm the rollback branch still exists: `git branch --list buildflow/xepic-[slug]`
- If branch exists: code is intact â€” no restore needed. Print `[repo] âœ“ git branch intact`
- If branch missing: warn `âš  [repo] â€” rollback branch not found. Code may have been lost. Proceed manually.`

**File snapshot mode (`snapshot_mode: file`):**
1. Read `SNAPSHOT.md` from `snapshot_path`
2. For each snapshotted file: compare current file hash against the recorded hash
3. If **no drift** (files unchanged since pause): no restore needed. Print `[repo] âœ“ no drift detected`
4. If **drift detected** (files changed while paused):
   ```
   âš  Drift detected: react-module
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Files changed since pause:
     src/routes/photo.ts       â€” modified
     src/components/Gallery.tsx â€” missing

   Options:
   [R] Restore from snapshot â€” overwrite current files with paused state
   [K] Keep current files â€” resume with whatever is in working directory now
   [D] Show diff first
   ```
   - If [R]: copy files from `snapshot_path` back to their original locations. Print `[repo] âœ“ restored from snapshot ([N] files)`
   - If [K]: proceed with current state. Note in STATE.md that drift was accepted.
   - If [D]: show file-by-file diff, then re-prompt [R]/[K]

### Step RE2: Restore State & Report

Remove selected xepic from `paused_xepics[]`. Use the **Write tool** to restore it as the active xepic in STATE.md:
- Set `current_xepic: [slug]`
- Set `xepic_status: [saved xepic_status]`
- Restore `build_order`, `repos`, `rollback_branches` from the paused entry

#### Summary

```
â–¶ Resumed: [slug]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  api-module     picking up at: built          [git branch âœ“]
  react-module   picking up at: build_in_progress (wave 2/3)   [snapshot restored âœ“]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace build --resume
   Why:  react-module build was in progress â€” continue from wave 2
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Context: Run /clear before continuing â€” resuming a paused xepic is a context boundary.
```

---

## Workspace Switch Mode (`/buildflow-workspace switch "<xepic-slug>"`)

Pause the current xepic and activate another â€” either a paused xepic or a new one.

### Step SW1: Validate, Pause & Activate

Read STATE.md. If no `current_xepic` active: skip pause step, go directly to SW3.

If `<xepic-slug>` matches `current_xepic`: print "Already active." and exit.

#### Pause Current

Run Workspace Pause steps PA1â€“PA3 silently (no confirmation prompt â€” user already confirmed by running switch).

Print: `â¸ Paused: [current_xepic]`

#### Activate Target

Check `paused_xepics[]` for the target slug:

**If found (resuming a paused xepic):** run Resume steps RE2â€“RE3.

**If not found (new xepic):** set `current_xepic: [slug]`, `xepic_status: none`. Print:
```
â–¶ Switched to: [slug] â€” not yet started
  Run /buildflow-workspace spec "[slug]" to begin.
```

#### Summary

```
Switch Complete
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Paused:  [previous_xepic] â€” [last_status]
  Active:  [target_xepic]   â€” [status]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  [next command based on target status]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Context: Run /clear â€” switching xepics is a context boundary.
```

---

## Workspace Revert Mode (`/buildflow-workspace revert`)

Rolls back workspace state and per-repo branches for the active or a named xepic. Uses `rollback_branches` already recorded in STATE.md.

### Usage
- `/buildflow-workspace revert` â€” revert the active xepic (full rollback)
- `/buildflow-workspace revert [slug]` â€” revert a named xepic (active or paused)
- `/buildflow-workspace revert --wave <N> --repo <repo-name>` â€” revert a specific wave in a specific repo within the active xepic
- `/buildflow-workspace revert --wave <N>` â€” revert wave N across all repos in the active xepic (in reverse build order)
- `/buildflow-workspace revert --list` â€” show all xepics and per-repo wave revert status

### Step RV1: Resolve Target & Wave Revert Mode

Read STATE.md. If `--list`:
```
Xepic Revert Status
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â— Active:   1-photo-upload     rollback branches: 2 recorded (api-module âœ“, react-module âœ“)
â—‹ Paused:   2-user-profiles    rollback branches: 1 recorded (api-module âœ“)
â—‹ Complete: 0-initial-setup    shipped â€” revert removes workspace artifacts only
```
Then exit.

Resolve target in order:
1. Named slug from args
2. `current_xepic` from STATE.md
3. Most recently paused xepic

#### Wave Revert Mode

If `--wave <N>` is passed (with or without `--repo`):

**Single repo (`--wave <N> --repo <repo-name>`):**
1. Confirm the repo is in the active xepic's `repos` list
2. Delegate to that repo's `/buildflow-revert --wave <N>` steps (WR1â€“WR5) scoped to `[repo-path]/`
3. After revert: update `.buildflow/workspace/STATE.md` â†’ `repos.[repo].status: build_in_progress` (wave was reverted, needs rebuild)
4. Update `.buildflow/workspace/epics/[slug]/STATUS.md` â€” reset wave N's row for that repo

**All repos (`--wave <N>` without `--repo`):**
Revert wave N across every repo in the xepic that has completed wave N. Execute in **reverse build order** (consuming repos first, then contract-defining repo last):

```
Wave Revert: Wave [N] â€” all repos
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Reverting in reverse build order (consuming repos first):
  [1] react-module   wave [N] â†’ reverted
  [2] api-module     wave [N] â†’ reverted

Reason: consuming repo reverted before contract repo to avoid broken state.
```

Show impact per repo before executing (same format as single-repo WR2).
Require confirmation before proceeding: `Revert Wave [N] in [N] repos? [Y/n]`

After all repos reverted: update workspace STATE.md and STATUS.md for each repo.

Print:
```
âœ“ Wave [N] reverted across [N] repos
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  api-module     wave [N] â†’ NOT STARTED
  react-module   wave [N] â†’ NOT STARTED

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace build --resume
   Why:  Wave [N] reverted â€” resume build to re-implement from wave [N]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---

### Step RV2: Confirm, Execute & Report

```
Revert: [slug]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Workspace artifacts to remove:
  .buildflow/workspace/epics/[slug]/XPLAN.md
  .buildflow/workspace/epics/[slug]/STATUS.md
  .buildflow/workspace/STATE.md  (xepic entry cleared)

Per-repo rollback:
  api-module     branch: buildflow/xepic-[slug]   â†’ git checkout main && git branch -D buildflow/xepic-[slug]
  react-module   branch: buildflow/xepic-[slug]   â†’ git checkout main && git branch -D buildflow/xepic-[slug]

âš  Repos with no recorded rollback branch (build not started):
  [repo]  â€” no code changes to revert

Repo-level spec artifacts (SPEC.md, PLAN.md, waves/) will also be removed from each repo.
```

Ask:
```
Choose revert scope:
1. Workspace artifacts only â€” remove XPLAN.md, STATUS.md, clear STATE.md entry
2. Workspace + per-repo spec artifacts â€” also remove SPEC.md, PLAN.md, waves/ from each repo
3. Full revert â€” workspace + spec artifacts + code rollback (runs git branch cleanup per repo)
4. Cancel
```

Option 3 requires `git.permission: approved` in each repo's PREFERENCES.md. If not approved: hide option 3 and show: "Code rollback requires git permission â€” set `git.permission: approved` in each repo's `.buildflow/PREFERENCES.md`."

#### Execute Revert

**Scope 1 â€” workspace artifacts only:**
- Delete `.buildflow/workspace/epics/[slug]/XPLAN.md` and `STATUS.md`
- Remove xepic entry from STATE.md (or from `paused_xepics[]` if paused)
- Append revert record to `.buildflow/workspace/milestones/REVERT_LOG.md`

**Scope 2 â€” add per-repo spec artifacts:**
- For each repo in the xepic: delete `[repo]/.buildflow/epics/[epic_slug]/SPEC.md`, `ACCEPTANCE.md`, `PLAN.md`, `waves/`, `CHECK.md`, `STATE.md`
- Do not delete `APPROVALS.md` â€” append a revert record instead

**Scope 3 â€” add code rollback:**
- For each repo with a recorded rollback branch:
  ```bash
  cd [repo-path]
  git checkout main
  git branch -D buildflow/xepic-[slug]
  ```
- Print result per repo: `âœ“ [repo] â€” reverted` or `âœ— [repo] â€” [error]`

#### Summary

```
Revert Complete â€” [slug]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Scope: [workspace only / + spec artifacts / + code rollback]

  âœ“ Workspace artifacts removed
  âœ“ api-module     spec artifacts removed Â· branch deleted
  âœ“ react-module   spec artifacts removed Â· branch deleted

Revert log: .buildflow/workspace/milestones/REVERT_LOG.md

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â†’ Next:  /buildflow-workspace
   Why:  Workspace reset â€” map repos or start a new xepic
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
```

---

