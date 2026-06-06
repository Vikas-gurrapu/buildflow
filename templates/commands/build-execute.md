---
name: buildflow-build-execute
max_context_kb: 40
description: Module â€” wave execution loop (context packets, parallel builders, tests, telemetry, commit). Loaded per-wave by /buildflow-build.
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
---

# Build Execute Module

Loaded by `/buildflow-build` at the start of each wave. Executes Steps 3aâ€“3i for the current wave, then returns to the build command for the next wave or final integration check.

---

## Step 3: Wave Execution Loop

Repeat for each wave:

### 3a â€” Build Context Packets + Overlap Detection

**Before spawning Builders, check for file overlap within this wave:**

List all files each task in this wave will touch (from the File Ownership Map in PLAN.md). If two tasks in the same wave list the same file:

```
âš  File overlap detected in Wave [N]:
  src/auth/service.ts is claimed by:
    Task "Implement login" (modifying)
    Task "Add refresh token" (modifying)

Auto-serialization applied: these two tasks will run sequentially, not in parallel.
Order: "Implement login" â†’ "Add refresh token"
```

Overlapping tasks are **serialized automatically**. No manual intervention needed unless tasks have conflicting Beforeâ†’After contracts (escalate to user if so).

For each task in this wave, assemble a Builder Task Packet:

```
## Builder Task Packet

Task:           [name]
Goal:           [one sentence â€” what this task makes true]
AC refs:        [AC-001, AC-003]
Before:         [what currently exists â€” "file doesn't exist" or "function X does Y"]
After:          [what must be true when this task is done]

Files allowed to create/modify:   [explicit list â€” max 5]
Files forbidden to touch:         [all other files in the ownership map for this wave]
Closest existing example:         [path/to/similar/file.ts â€” "follow this structure exactly"]
Key pattern to follow:            [specific convention from PATTERNS.md]
Approach:                         [implementation approach from wave file â€” follow exactly unless a blocker is found]
External dependencies:            [env vars, services, package constraints from DEPENDENCIES.md â€” or NONE]
Tests to add/run:                 [test file(s) to write + focused test command to run after]
Known risks:                      [hotspot files or debt from RISKS.md â€” or NONE]
Locale impact:                    [INCLUDE intel.json locale_support section if task references i18n â€” otherwise OMIT]
Definition of done:               [linked ACs that must pass]
Serialized after:                 [task name, or "none â€” runs in parallel"]
```

The "closest existing example" is the most important field. Builders replicate proven patterns, not invent new ones.

### 3b â€” Parallel Build (with serialization where overlap detected)

**Git worktree isolation â€” check Git Permission Guard first:**

**If `git.permission: approved`:**
```bash
git worktree add .buildflow/worktrees/wave-[N]-task-[name] -b buildflow/wave-[N]-[name]
```
After all complete:
```bash
git merge buildflow/wave-[N]-[task-A] --no-ff -m "merge: wave [N] task [A]"
git worktree remove .buildflow/worktrees/wave-[N]-task-[name]
git branch -d buildflow/wave-[N]-[name]
```
Merge conflicts = undeclared ownership violation â†’ log as SCOPE deviation.

**If `git.permission` is not `approved` (no-git mode):**
Skip worktree isolation. Use Step 3a serialization as the sole safety net.

**Claude Code** â€” spawn one Builder per non-overlapping task in a single response. If `model_routing.heavy_tasks` is set (not `default`), add `model: [resolved model]` to each Agent call (Builders are heavy-tier work):
```
Agent({ description: "Builder: [task name]", model: [from model_routing.heavy_tasks if set], prompt: "You are a BuildFlow Builder. Your context packet:\n---\nTask: [task name]\nAC refs: [AC-001, AC-003]\nBefore: [what currently exists]\nAfter: [what must be true when done]\nFiles allowed: [list]\nFiles forbidden: [list]\nClosest existing example: [path/to/file]\nKey pattern: [convention]\nApproach: [from wave file â€” follow exactly unless a blocker is found]\nDefinition of done: [linked ACs]\n---\nWrite code satisfying the Beforeâ†’After contract. Follow the planned approach and closest example exactly. Write focused tests in the same task." })
```

**Gemini CLI / Codex CLI / Cursor** â€” sequential:
`=== Builder: [task name] START ===` â†’ execute using only this task's packet â†’ `=== Builder: [task name] END ===`

Each Builder:
- Writes code satisfying the Before â†’ After contract
- Follows the closest existing example's structure
- Covers referenced ACs
- **Writes focused tests after code change â€” not later, not optional**
- Adds `LEARN:` comment only for patterns not present elsewhere

**For every new source file:** create a corresponding test file using the detected framework convention. Minimum: 1 happy path + 1 error/edge case per exported function.

**For every modified source file:** add/update test cases for changed behavior. Do NOT delete passing test cases.

Builder reports back:
```
Task: [name] â€” COMPLETE
Files created:  [list]
Files modified: [list]
Test files written/updated: [list with case count]
ACs addressed: [AC-001 âœ“, AC-003 âœ“]
Pattern followed: [example file used]
```

### 3b-post-merge â€” Post-Merge Gate

After all worktrees merge or serialized tasks complete:

1. Run smallest build/type-check command for the merged touched area (5-min timeout)
2. Run smallest post-merge test command for the merged touched area (5-min timeout)
3. Run each once. Do not automatically rerun failures.

If gate fails:
```
Post-merge gate failed after Wave [N].
Command: [exact command]
Likely cause: [merge conflict / command issue / real failure / timeout]

Options:
1. Rerun with corrected command
2. Fix now
3. Defer â€” record as wave risk (only if no AC is blocked)
```

**Focused testing fast path:** If a task ONLY touches `.css`, `.scss`, locale/label catalogs, or static assets â€” skip focused unit tests unless a relevant snapshot test already exists.

Run only new/changed test files. After they pass: update `CHECK.md` ACs to `PASS` or `IN PROGRESS`, append exact command to `## Test Runs`.

If focused test fails â€” classify as command issue or code issue, ask before rerunning. Max 3 user-approved attempts.

### 3b-locale â€” Locale Catalog Sync

**Triggered when:** task references label/copy/i18n keys, task type is `copy_locale`, or Builder added new i18n key references.

**If NOT triggered:** skip entirely.

1. Read `intel.json â†’ locale_support` for catalog paths, supported locales, catalog type
2. For each new key: add real value to primary catalog, `[TRANSLATE: <value>]` to all others
3. For each changed value: update primary, mark others as `[TRANSLATE: <new-value>]`
4. For each removed key: grep all source files to verify no references, then remove from all catalogs
5. Write each catalog using the Write tool
6. Add to Builder report: keys changed, catalogs updated, TRANSLATE placeholders remaining

### 3c â€” Reviewer Check

Reviewer reads each Builder's output:
- Does it satisfy referenced ACs?
- Does it match the style fingerprint and closest example?
- Are tests present for non-trivial logic?
- Any security concerns?
- Did the Builder follow the Before â†’ After contract?

Flag any deviation â€” Builders should blend in, not stand out.

### 3d â€” Build Telemetry Check

**1. Type Check** (errors BLOCK commit):
```bash
npx tsc --noEmit   # TypeScript
mypy .             # Python
go vet ./...       # Go
cargo check        # Rust
```
Type error fix loop â€” max 3 attempts, then escalate.

**2. Lint** (errors BLOCK, warnings non-blocking):
```bash
npx eslint src/ --max-warnings=0   # JS/TS
ruff check .                        # Python
golangci-lint run                   # Go
cargo clippy -- -D warnings         # Rust
```

**3. Focused Coverage Check** (scoped to touched files only):
```bash
npx jest [specific-test-file] --coverage --coverageReporters=json-summary   # Jest
pytest [specific-test-file] --cov=[touched-module]                           # pytest
go test ./[touched-package] -cover                                           # Go
cargo tarpaulin --out Stdout [touched-test-target]                           # Rust
```

Coverage drop thresholds:
- 0â€“5%: warn, non-blocking
- 5â€“15% or >15%: prompt [F] Fix now / [P] Proceed (log debt) / [S] Skip wave

**4. Bundle Size Check (JS/TS only):**
- >+10% â†’ warn, non-blocking
- >+25% â†’ BLOCK, investigate before proceeding

```
Build Telemetry  Wave [N]
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Type-check:   âœ“ PASS  (0 errors)
Lint:         âš  WARN  (3 warnings â€” non-blocking)
Coverage:     âš  WARN  (74% â†’ 71%, -3%)
Bundle size:  âœ“ PASS  (142 KB â†’ 144 KB, +1.4%)
```

Only proceed to 3e after type-check PASS and lint errors fixed.

### 3e â€” Targeted Test + Fix Loop

Build targeted test set: source files touched â†’ their direct tests â†’ dependency-neighborhood tests (importers + importees) â†’ contract/API tests for changed exports.

Do not run full suite. Full-suite approval is requested once in the final integration check.

On test failure: classify (command issue / code issue / unclear), ask before rerunning. Max 3 user-approved attempts. If AC blocked after 3: mark FAIL/BLOCKED in CHECK.md, surface to user.

### 3f â€” Schema Drift Check

If wave touched schema-defining files (`*.prisma`, `*.entity.ts`, `models.py`, `schema.sql`, migrations):
1. Check if migration was added alongside schema change â€” missing migration BLOCKS commit
2. Dry-run migration where possible (`prisma migrate dev --create-only`, `manage.py makemigrations --check`)
3. Note migration in wave commit body

If no schema files touched: skip.

### 3g â€” Deviation Handling

If a Builder discovers the plan's Before â†’ After contract cannot be satisfied as written:

1. Stop immediately
2. Record:
   ```
   DEVIATION  Wave [N]  Task: [name]
   Expected: [what the plan said]
   Actual:   [what is true]
   Blocker:  [why plan cannot be followed]
   Impact:   [which ACs are at risk]
   Options:  A) ... B) ... C) Defer
   ```
3. Surface to user â€” do not choose unilaterally unless SOFT deviation

| Type | Action |
|------|--------|
| HARD | Stop wave, escalate immediately |
| SOFT | Choose simplest approach, log, continue |
| SCOPE | Stop, propose plan amendment |

Log resolution in `PLAN.md â†’ ## Deviations`.

### 3h â€” Wave Commit

**Git mode:**
```bash
git add [changed files â€” explicit list, not -A]
git commit -m "[type](scope): [what changed]

[Body: why, which ACs satisfied]
[AC refs: AC-001, AC-003]
[Wave: N of M]"
```

On git failure: [R] Retry / [P] Park (snapshot + mark parked in PLAN.md + log to MEMORY.md parked_changes) / [W] Wait

**No-git mode:**
1. Snapshot all wave files to `.buildflow/snapshots/phase-[P]-wave-[N]-complete/`
2. Mark wave COMPLETE in PLAN.md with snapshot path
3. Record `last_wave_completed: [N]` in STATE.md

Update CHECK.md: mark ACs PASS/IN PROGRESS/FAIL/DEFERRED based on evidence. Append test commands to `## Test Runs`. Refresh summary counts.

### 3i â€” Codebase Map Drift Note (non-blocking)

Classify structural changes against CODEBASE.md:

| Category | Trigger |
|---|---|
| `new_dir` | new directory not in CODEBASE.md |
| `route` | new route/API/page/screen |
| `migration` | schema/migration file |
| `barrel` | new index.ts/js export |
| `dependency` | package/lock/build config changed |
| `integration` | API client/webhook/env contract changed |
| `copy_locale` | locale catalog changed |

If drift exists: note in wave report (non-blocking). If 3+ drift elements: show to user after wave. Do not auto-run onboarding.

---

Return to `/buildflow-build` â€” continue to next wave or Step 4 (Final Integration Check).

