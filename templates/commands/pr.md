---
name: buildflow-pr
description: Generate a production-ready pull request description from wave tasks, ACs covered, and verification results
allowed-tools: Read, Write, Bash, Grep, Glob
agent: strategist
---

# /buildflow-pr

Generate a complete, ready-to-paste pull request description from the current wave or phase. Reads what was built (wave tasks), what it proves (ACs), what changed (git diff), and what was verified (CHECK.md) — then writes a PR description a senior engineer would be proud of.

## Usage
- `/buildflow-pr` — generate PR for the most recently completed wave
- `/buildflow-pr --phase` — generate PR for the entire phase (all waves)
- `/buildflow-pr wave-2` — generate PR for a specific wave
- `/buildflow-pr --draft` — mark PR as draft (adds `[Draft]` prefix to title)
- `/buildflow-pr --branch` — also suggest branch name based on epic + wave

## Context Packet (load only these)
- `.buildflow/epics/[epic]/ACCEPTANCE.md` — ACs to reference
- `.buildflow/epics/[epic]/PLAN.md` — wave index and goal
- `.buildflow/epics/[epic]/waves/wave-[N].md` — task details for target wave(s)
- `.buildflow/epics/[epic]/CHECK.md` — which ACs passed and what was verified
- `.buildflow/MEMORY.md` — app name, framework, repo URL
- `.buildflow/STATE.md` — current phase and wave

Changed files (for scope):
- **If `git.permission: approved`:** `git diff --name-only HEAD~[wave-count]..HEAD -- src/`
- **If `git.permission` is not `approved`:** read file lists from completed wave task files

---

## Step 1: Determine Scope

Resolve the target scope:
- No arg → find the most recently completed wave (highest wave-N with status COMPLETE in PLAN.md)
- `--phase` → all waves in current phase
- `wave-N` → that specific wave only

Load the relevant wave file(s). If wave is still in progress, warn: "Wave [N] not yet marked complete — generating PR from in-progress tasks."

---

## Step 2: Extract Build Summary

From the wave file(s), extract:
- **Goal** — the wave goal sentence
- **Tasks completed** — list of task names with their type (NEW / MODIFY)
- **ACs covered** — all AC IDs referenced across tasks
- **Files changed** — from git diff or wave file task lists
- **Test status** — from CHECK.md (PASS count, FAIL count, PARTIAL count)
- **Schema changed?** — check if any migration file or schema file is in the changed set
- **API changed?** — check if any route/controller/endpoint file is in the changed set
- **Breaking changes?** — check if any MODIFY task changed a public interface (exported function sig, API response shape, DB column rename/remove)

---

## Step 3: Generate PR Title

Format: `[type]([scope]): [description]`

Type rules:
- New AC implementation → `feat`
- Bug fix from hotfix session → `fix`
- Refactor only → `refactor`
- Test only → `test`
- Migration only → `chore`
- Breaking change → append `!` (e.g., `feat!`)

Scope: epic slug or affected module (e.g., `auth`, `payments`, `api`)

Description: one sentence, imperative, ≤72 chars total title.

Examples:
```
feat(auth): add JWT login, refresh token, and email verification
fix(payments): correct refund amount calculation for partial orders
feat!(api): replace session auth with token-based auth
```

If `--draft`: prefix with `[Draft] `.

---

## Step 4: Generate PR Body

Write the full PR description in this format:

```markdown
## What
[2–4 bullet points describing what was built — each maps to a task or group of tasks]
- Added [X] — [brief what it does]
- Modified [Y] to [outcome]
- Created [Z] for [purpose]

## Why
[1–2 sentences explaining the business/product reason — derived from the epic goal and ACs]

## Acceptance Criteria covered
| AC | Requirement | Status |
|----|-------------|--------|
| AC-001 | [exact AC summary from ACCEPTANCE.md] | ✓ PASS |
| AC-002 | [exact AC summary] | ✓ PASS |

## How to test
[Numbered steps a reviewer can follow to manually verify the key ACs]
1. [step]
2. [step]
3. Expected result: [outcome]

## Files changed
<details>
<summary>[N] files changed</summary>

**New:**
- `src/...` — [what it is]

**Modified:**
- `src/...` — [what changed]

</details>

## Migration notes
[Include ONLY if schema changed — otherwise omit this section entirely]
⚠️ Schema migration required. Run:
```bash
[migration command for the detected ORM]
```
[Any destructive operations flagged here with: "⚠ Destructive: [what it does] — verify data before running in production"]

## Breaking changes
[Include ONLY if breaking change detected — otherwise omit]
⚠️ Breaking: [what changed and what callers need to update]

## Test results
- [N] ACs: ✓ PASS
- [N] ACs: ✗ FAIL (list them)
- [N] ACs: ⚠ PARTIAL
```

---

## Step 5: Branch Name (if --branch)

Suggest: `[type]/[epic-slug]-wave-[N]-[short-description]`

Example: `feat/auth-wave-2-jwt-login`

---

## Step 6: Write Output

Use the **Write tool** to save the PR description to:
`.buildflow/epics/[epic]/PR-wave-[N].md` (or `PR-phase-[N].md` for `--phase`)

Then print the full PR description to the terminal with:

```
PR description written → .buildflow/epics/[epic]/PR-wave-[N].md

Copy the section below into your PR:
─────────────────────────────────────────────────────
[full PR description]
─────────────────────────────────────────────────────
```

Also print a one-line CLI hint if `git.permission: approved`:
```
To open a PR:  gh pr create --title "[generated title]" --body "$(cat .buildflow/epics/[epic]/PR-wave-[N].md)"
```
