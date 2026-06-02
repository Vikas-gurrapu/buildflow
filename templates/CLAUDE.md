# {{APP_NAME}} — Claude Code Configuration

This project uses **BuildFlow v8.0** for spec-driven, multi-agent development orchestration.

## Session Start Checklist (Run Every Time)

Before doing anything else at the start of every session:

1. **Check for updates** — run this shell command silently:
   ```
   npx buildflow-dev@latest update --check
   ```
   - If `.buildflow/UPDATE.md` exists after the check, show the user:
     > "BuildFlow update available — run `npx buildflow-dev@latest update` in your terminal."
     Then display the contents of UPDATE.md.
   - If the file does not exist, proceed silently.

2. **Prune memory** — read `.buildflow/MEMORY.md`. If over 3K tokens, prune it silently:
   - Archive epic task lists and build timestamps to `.buildflow/epics/[last epic]/RETRO.md`
   - Keep: app_name, framework, language, current_epic, spec_status, style_fingerprint, last 2 decisions
   - Context management is invisible by default — do not report pruning to the user.

3. **Load state** — read `.buildflow/STATE.md` for current epic and status.
   - If `current_epic` is set (and not `none`), also read `.buildflow/epics/[current_epic]/STATE.md` if it exists.
   - Treat the epic `STATE.md` as the compact resume contract for fresh sessions: current status, active wave, decisions, important files, risks, test strategy, and next command.
   - If `STATE.md` conflicts with source-of-truth files (`ACCEPTANCE.md`, `PLAN.md`, `CHECK.md`, check reports, or `SHIPPED.md`), trust the source-of-truth file and update `STATE.md` before continuing.
   - If `paused_epics` list is non-empty, note available paused epics silently — do not surface unless user asks.

4. **Detect git permission and availability** — read `.buildflow/PREFERENCES.md` first:
   - If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: set `git_available: false` in `MEMORY.md` and **do not run git commands** this session, even if `.git/` exists.
   - If `git.permission` is `approved`: git operations are allowed. Then run:
   ```bash
   git rev-parse --git-dir 2>/dev/null && echo "GIT_OK" || echo "NO_GIT"
   ```
   - `GIT_OK` + `git.permission: approved` → set `git_available: true` in `MEMORY.md`. Git operations work normally.
   - `NO_GIT` → set `git_available: false` in `MEMORY.md`. Show **once per session**:
     > "⚠ Git not detected. BuildFlow is running in **no-git mode**: restore points use file snapshots, wave commits are tracked in PLAN.md, and epic tags are recorded in STATE.md instead. All core features still work."
   - Never let `MEMORY.md` override `PREFERENCES.md`. If `git.permission` is not `approved`, no-git mode wins.

5. **Drift check** — if `onboard_status: yes` in `MEMORY.md`, run the fast drift check from `/buildflow-start-epic` Step 1b against `.buildflow/codebase/intel.json`. Report warnings if schema files or load-bearing files changed since last onboard. Silent if no drift.

5b. **Global learnings check** — read `~/.buildflow/learnings/global.md` if it exists (cross-project insights written by `/buildflow-complete-epic`).
   - Filter entries matching the current framework or language (from `MEMORY.md`).
   - If 1–3 relevant entries exist, surface them silently as a one-line note: `💡 [N] global insight(s) from past projects — relevant to [framework]. Read with /buildflow-help.`
   - If no matches or file absent: proceed silently.
   - Never load more than 5 entries into context — take the 5 most recent matching ones.

---

## BuildFlow v8.0 Workflow

### Single-repo (run from inside a repo)
```
/buildflow-start-epic    → capture vision
/buildflow-think    → research (optional)
/buildflow-spec     → generate Requirements + Technical Design + Acceptance Criteria + wave plan
/buildflow-discuss  → clarify doubts on generated spec and plan — auto-updates artifacts on confirmation (optional)
/buildflow-review --spec-only  → parallel 4-agent spec review gate before build (AC completeness, technical design, security, plan feasibility)
/buildflow-build    → execute waves with auto-test + auto-fix
/buildflow-review   → parallel 4-agent code review after build (correctness, security, patterns, test coverage)
/buildflow-check    → verify all ACs satisfied
/buildflow-ship     → spec gate + security gate + context pruning
/buildflow-deploy   → pre-flight + deploy to staging/production
```

### Multi-repo (run from workspace root — parent folder of all repos)
```
/buildflow-workspace onboard   → onboard all sibling repos
/buildflow-workspace spec      → spec each affected repo in dependency order; XPLAN.md at workspace level
/buildflow-workspace discuss   → cross-repo clarifications; updates each repo's SPEC.md
/buildflow-workspace build     → build each repo in dependency order; wave files stay local per repo
/buildflow-workspace check     → aggregate AC verification across all repos
/buildflow-workspace ship      → ship each repo in dependency order
/buildflow-workspace complete  → archive cross-repo milestone; reset workspace state
```

Workspace state lives in `[workspace-root]/.buildflow/workspace/`. Repo artifacts (SPEC.md, PLAN.md, waves, CHECK.md, SHIPPED.md) always stay in each repo's own `.buildflow/epics/`.

## Quick Reference

| Command | When to use |
|---------|-------------|
| `/buildflow-start-epic` | Begin or continue the project |
| `/buildflow-spec` | Generate Requirements, Technical Design, Acceptance Criteria + wave plan in one pass |
| `/buildflow-discuss` | Clarify doubts on the generated spec and plan — auto-updates artifacts on confirmation |
| `/buildflow-review --spec-only` | Parallel 4-agent spec review gate before build — AC completeness, technical design, security, plan feasibility |
| `/buildflow-review` | Parallel 4-agent code review after build — correctness, security, patterns, test coverage |
| `/buildflow-build` | Execute plan — auto-tests and auto-fixes each wave |
| `/buildflow-test` | Re-verify a wave or test a manual change |
| `/buildflow-check` | Verify all ACs satisfied + code quality |
| `/buildflow-check --strict` | Structural spec-to-code mirroring: contract names, component map, critical symbol coverage, AC branches |
| `/buildflow-ship` | Spec gate + security gate + context prune + git tag only when `git.permission: approved` |
| `/buildflow-deploy` | Pre-flight checks + deploy staging/production |
| `/buildflow-hotfix` | Fast-path fix — no planning, no waves · `--continue` resumes interrupted sessions |
| `/buildflow-debug` | Root-cause analysis when tests fail · `--continue` resumes interrupted sessions |
| `/buildflow-perf` | Performance profiling — UI rendering, backend endpoints, DB queries |
| `/buildflow-pr` | Generate PR description from completed wave tasks, ACs, and verification results |
| `/buildflow-migrate` | Detect schema changes, generate migration files, flag destructive ops, produce rollback plan |
| `/buildflow-observe` | Audit + set up error tracking, structured logging, health endpoints, and APM |
| `/buildflow-onboard` | One-time analysis of existing codebase |
| `/buildflow-modify` | Surgical change or bugfix to existing code |
| `/buildflow-workspace` | Multi-repo/monorepo cross-service impact analysis (run from workspace root) |
| `/buildflow-workspace spec` | Spec all affected repos from workspace root |
| `/buildflow-workspace build` | Build all affected repos in dependency order |
| `/buildflow-workspace check` | Aggregate AC check across all repos |
| `/buildflow-workspace ship` | Ship all repos in dependency order |
| `/buildflow-docker` | Docker scaffolding, build, run, push, and image security scan |
| `/buildflow-audit` | OWASP Top 10 security scan + container CVE scan |
| `/buildflow-ui-spec` | Generate UI design contract — colors, typography, spacing, components |
| `/buildflow-ui-review` | Audit UI implementation against design contract across 6 dimensions |
| `/buildflow-status` | See current phase and progress |
| `/buildflow-complete-epic` | Archive milestone, tag release, reset for next cycle |
| `/buildflow-switch-epic` | Pause current epic and switch to another, or resume a paused epic |
| `/buildflow-settings` | Interactively view and update preferences |
| `/buildflow-help` | Diagnostic mode + recovery |

## Core Rules

- Each agent receives a **minimal context packet** — only what it needs, nothing else
- `MEMORY.md` must stay under 3K tokens — prune silently at session start if over
- Ask confidence (1-5) before locking major decisions
- Run `/buildflow-spec` before `/buildflow-build` — no spec, no build
- `/buildflow-ship` blocks if any Acceptance Criterion is unsatisfied
- Create restore points before destructive operations (file snapshot unless `git.permission: approved`)
- Run `/buildflow-audit` before every `/buildflow-ship`
- No-git mode: all features work — snapshots replace stash, PLAN.md tracks wave progress, STATE.md records phase milestones
- **Yolo mode** — when `workflow.skip_prompts: true` in `PREFERENCES.md`: auto-proceed at all non-destructive confirmation gates (wave start, coverage prompts, proceed-to-next-wave). Only destructive gates (full reset, permanent delete, force-ship with critical security findings) still require explicit confirmation
- Phase `STATE.md` is mandatory for phase-driving commands — load it at command start, use it to resume, and update it before command exit
- **Strict mode** — when `strict_mode: true` or phase planned with `--strict`: `/buildflow-check --strict` is mandatory before ship; strict violations have no override flag
- **Folder Access Guard** — check `path_permissions` before reading or writing any folder (see below)

## Folder Access Guard

Applies to every command that reads or writes files outside `.buildflow/`.

**Before accessing a folder for the first time this session:**

1. Extract the top-level folder of the target path — e.g., `src/auth/service.ts` → `src/`, `tests/auth/` → `tests/`, `config/db.ts` → `config/`.
2. Read `.buildflow/PREFERENCES.md` → `path_permissions.[folder]`:
   - **`approved`**: proceed immediately — no prompt.
   - **`denied`**: skip this path. Warn once: "Access to `[folder]/` is denied in PREFERENCES.md."
   - **not listed**: show the prompt below **once per folder per session**, then cache the response for the rest of the session.

**Access prompt (shown when folder is not listed in path_permissions):**
```
──────────────────────────────────────────────────
BuildFlow needs access to [folder]/
  [1] Yes         — allow this session, ask again next time
  [2] Yes, always — allow + save to preferences (never ask again)
  [3] No          — deny access to this folder
──────────────────────────────────────────────────
```

- **[1]:** Proceed. Cache approval for this session only — do not write to PREFERENCES.md.
- **[2]:** Use the **Write tool** to add `  [folder]/: approved` under `path_permissions` in `.buildflow/PREFERENCES.md`. Then proceed.
- **[3]:** Use the **Write tool** to add `  [folder]/: denied` under `path_permissions` in `.buildflow/PREFERENCES.md`. Skip this path for the rest of the session.

**Rules:**
- Ask once per folder per session — after the user responds, cache it and never ask again for files in that same folder this session.
- `.buildflow/` is always accessible — never prompt for it.
- If PREFERENCES.md is missing or `path_permissions` key is absent: treat all folders as not listed (prompt).
- Batch folders when a command needs multiple new folders at once — list them all in one prompt instead of asking separately for each.

## Strict Mode

Strict mode enforces structural spec-to-code mirroring for critical infrastructure phases. Enable it when code correctness must strictly mirror spec structure.

**When to use strict mode:**
- Auth systems, payment flows, crypto implementations
- Compliance-sensitive code (HIPAA, PCI, GDPR enforcement logic)
- Multi-service infrastructure where contract drift causes silent failures
- Any phase where "spec says X, code does Y" is a security or correctness defect

**What strict mode checks (in `/buildflow-check --strict`):**
1. **API contracts** — response/request field names must match `epics/[epic]/SPEC.md` exactly (not just "a body exists")
2. **Component map** — every file created this phase must appear in the `SPEC.md` Component Map
3. **Critical symbol coverage** — every exported function in critical modules must have an AC reference
4. **AC branch completeness** — every error/edge-case AC must have a corresponding code branch

**What strict mode does NOT do:**
- Does not check line-by-line code content (that is a human code review)
- Does not run on non-critical modules (utility, config, infra files)
- Does not block on warnings — only on structural divergences

**To enable per-phase:** `/buildflow-spec --strict`
**To enable globally:** set `strict_mode: true` in `.buildflow/PREFERENCES.md`
**Critical module patterns:** configurable via `strict_critical_modules` in PREFERENCES.md

## Guided Mode

**Every command ends with a `→ Next step:` block** — one specific, actionable recommendation based on current state. This is not optional and not a lookup table. It is a single instruction the developer can follow immediately without thinking.

Format (printed as the very last thing before the token line):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-[command] [args if needed]
   Why:  [one sentence — what this will do for you right now]
──────────────────────────────────────────────────
```

If multiple valid paths exist (e.g., fix an AC vs ship anyway): show the recommended path first with `→ Next:`, then show the alternative as `   Or:`.

Context management events (pruning, drift detection, token accumulation) are **never surfaced** unless they require action. The developer should never think about `MEMORY.md`.

The only context events that surface:
- `⚠ Onboard data may be stale` — when a load-bearing file or schema changed since last onboard
- `⚠ MEMORY.md is near limit` — only when pruning cannot be done silently (manual decision needed)
- Update available notification

## Epic STATE.md

For every active epic, maintain `.buildflow/epics/[epic]/STATE.md` as the compact cross-session resume file.

Major epic-driving commands (`/buildflow-think`, `/buildflow-spec`, `/buildflow-discuss`, `/buildflow-build`, `/buildflow-check`, `/buildflow-ship`) must:
1. Load `STATE.md` at the start if it exists.
2. Use it to resume the current status/wave instead of asking the user to restate context.
3. Update it before printing the final next-step block.

Use this shape:
```markdown
# Epic [epic] State
Last updated: [ISO datetime]
Last command: /buildflow-[command]

## Current State
Epic: [N-slug]
Wave: [current/M or none]
Status: [researching/spec_locked/plan_ready/build_in_progress/built/check_passed/shipped]
paused: [true / false — omit if false]
paused_at: [ISO date — omit if not paused]

## Decisions
- [decision] — [reason]

## Files That Matter
- [path] — [why]

## Next Command
/buildflow-[command]

## Risks / Open Questions
- [risk or NONE]

## Test Strategy
- [focused tests / impacted-area approval / ship regression gate]
```

Keep this file compact. It should help a fresh session continue without loading every prior artifact.

The global `.buildflow/STATE.md` also supports multi-epic tracking:
```yaml
current_epic: 1-auth     # actively working on
paused_epics:            # paused — can be resumed
  - epic: 2-payments
    paused_at: 2026-05-28
    last_status: build_in_progress
    last_wave: 2
    last_command: /buildflow-build
```

Use `/buildflow-switch-epic` to pause the active epic and switch to another.

## Context Clear Recommendation

After every major phase-driving command, check the current context window/session token use and update `STATE.md` first. Then include a context recommendation inside the final next-step block:

- If the session is large, noisy, or the command just finished a boundary (`think`, spec lock, plan ready, build complete, check complete, ship complete): recommend clearing the AI session before the next command.
- Use the active agent's native clear command. For Claude Code, Codex, and Gemini CLI this is usually `/clear`. If the active tool uses a different context reset command, name that command instead.
- Suggested line:
  `Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.`
- If context is still clean and the next command is small, say:
  `Context: OK to continue without clearing.`

## Agents

| Agent | Role |
|-------|------|
| Strategist | Vision, decisions, direction |
| Researcher | Parallel web research with sources |
| Synthesizer | Combines research findings |
| Architect | Spec-traced dependency planning |
| Builder | Code matching project style, AC-referenced |
| Reviewer | Spec compliance + quality checks |
| Cartographer | Maps existing codebases |
| Surgeon | Precise modifications to existing code |
| Security Auditor | OWASP Top 10 scanning |

Each agent gets a **fresh context window** with a **minimal context packet** — no context rot, no wasted tokens.

## Project Structure

```
.buildflow/
├── VISION.md           ← What we're building (global, all epics)
├── STATE.md            ← Current epic and status (global)
├── PREFERENCES.md      ← Experience level, style prefs, git permissions
├── MEMORY.md           ← Persistent context (≤3K tokens, auto-pruned)
├── GLOSSARY.md         ← Project and BuildFlow term definitions
├── UPDATE.md           ← Created by update --check when update available
├── debug/              ← /buildflow-debug sessions run outside any active epic
│   └── DEBUG-[N].md
├── hotfix/             ← /buildflow-hotfix records outside any active epic
│   └── HOTFIX-[N].md
├── epics/              ← Single source of truth per epic
│   └── [N-slug]/       ← e.g. 1-auth, 2-payments, 3-dashboard
│       ├── STATE.md        ← Cross-session resume contract
│       ├── CONTEXT.md      ← /buildflow-think output + /buildflow-discuss decisions log
│       ├── SPEC.md         ← /buildflow-spec: requirements + technical design
│       ├── ACCEPTANCE.md   ← /buildflow-spec: acceptance criteria (AC-001…)
│       ├── PLAN.md         ← /buildflow-spec: wave plan index
│       ├── waves/          ← wave task files (wave-1.md, wave-2.md, …)
│       ├── CHECK.md        ← /buildflow-check: AC coverage map + verification ledger
│       ├── AUDIT.md        ← /buildflow-audit: security scan report
│       ├── SHIPPED.md      ← /buildflow-ship: ship record
│       ├── DEBT.md         ← Technical debt accumulated during this epic
│       ├── RETRO.md        ← /buildflow-complete-epic: epic retrospective
│       ├── debug/
│       └── hotfix/
└── codebase/           ← Generated by /buildflow-onboard (existing projects)
    ├── CODEBASE.md     ← module map, entry points, folder roles, tech stack, physical layout
    ├── PATTERNS.md     ← code patterns, architectural style, feature inventory, locale support
    ├── DEPENDENCIES.md ← package dependencies, external integrations, import graph, fan-in/out
    ├── RISKS.md        ← high-risk files, code quality concerns, debt, fragile flows
    ├── TESTING.md      ← test framework, coverage, test patterns
    └── intel.json      ← machine-readable metadata
```
