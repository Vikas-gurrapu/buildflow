# {{APP_NAME}} — Claude Code Configuration

This project uses **BuildFlow v5.0** for spec-driven, multi-agent development orchestration.

## Session Start Checklist (Run Every Time)

Before doing anything else at the start of every session:

1. **Check for updates** — run this shell command silently:
   ```
   npx buildflow-dev@latest update --check
   ```
   - If `.buildflow/core/UPDATE.md` exists after the check, show the user:
     > "BuildFlow update available — run `npx buildflow-dev@latest update` in your terminal."
     Then display the contents of UPDATE.md.
   - If the file does not exist, proceed silently.

2. **Prune memory** — read `.buildflow/memory/light.md`. If over 3K tokens, prune it silently:
   - Archive phase task lists and build timestamps to `phases/[last phase]/retro.md`
   - Keep: app_name, framework, language, current_phase, spec_status, style_fingerprint, last 2 decisions
   - Do NOT report this to the user unless `verbose_context: true` in `preferences.md`. Context management is invisible by default.

3. **Load state** — read `.buildflow/core/state.md` for current phase and status

4. **Detect git permission and availability** — read `.buildflow/you/preferences.md` first:
   - If `git.permission` is `denied`, `denied_permanent`, or `unavailable`: set `git_available: false` in `light.md` and **do not run git commands** this session, even if `.git/` exists.
   - If `git.permission` is `approved`: git operations are allowed. Then run:
   ```bash
   git rev-parse --git-dir 2>/dev/null && echo "GIT_OK" || echo "NO_GIT"
   ```
   - `GIT_OK` + `git.permission: approved` → set `git_available: true` in `light.md`. Git operations work normally.
   - `NO_GIT` → set `git_available: false` in `light.md`. Show **once per session**:
     > "⚠ Git not detected. BuildFlow is running in **no-git mode**: restore points use file snapshots, wave commits are tracked in PLAN.md, and phase tags are recorded in state.md instead. All core features still work."
   - Never let `light.md` override `preferences.md`. If `git.permission` is not `approved`, no-git mode wins.

5. **Drift check** — if `onboard_status: yes` in `light.md`, run the fast drift check from `/buildflow-start` Step 1b against `.buildflow/codebase/intel.json`. Report warnings if schema files or load-bearing files changed since last onboard. Silent if no drift.

6. **Reset session token counter** — update `state.md`:
   ```yaml
   session_tokens_used: 0
   session_start: [ISO datetime]
   ```
   This counter accumulates across every command run this session. Each command adds its cost before exiting.

---

## BuildFlow v5.0 Workflow

```
/buildflow-start    → capture vision
/buildflow-think    → research (optional)
/buildflow-spec     → generate PRD + TDD + Acceptance Criteria  ← NEW
/buildflow-plan     → map tasks to ACs, group into waves
/buildflow-build    → execute waves with auto-test + auto-fix
/buildflow-check    → verify all ACs satisfied
/buildflow-ship     → spec gate + security gate + context pruning
/buildflow-deploy   → pre-flight + deploy to staging/production
```

## Quick Reference

| Command | When to use |
|---------|-------------|
| `/buildflow-start` | Begin or continue the project |
| `/buildflow-spec` | Define PRD, TDD, Acceptance Criteria before planning |
| `/buildflow-plan` | Create spec-traced wave plan |
| `/buildflow-build` | Execute plan — auto-tests and auto-fixes each wave |
| `/buildflow-test` | Re-verify a wave or test a manual change |
| `/buildflow-check` | Verify all ACs satisfied + code quality |
| `/buildflow-check --strict` | Structural spec-to-code mirroring: contract names, component map, critical symbol coverage, AC branches |
| `/buildflow-ship` | Spec gate + security gate + context prune + git tag only when `git.permission: approved` |
| `/buildflow-deploy` | Pre-flight checks + deploy staging/production |
| `/buildflow-hotfix` | Fast-path fix — no planning, no waves |
| `/buildflow-debug` | Root-cause analysis when tests fail |
| `/buildflow-onboard` | One-time analysis of existing codebase |
| `/buildflow-modify` | Surgical change or bugfix to existing code |
| `/buildflow-workspace` | Multi-repo/monorepo cross-service impact analysis |
| `/buildflow-docker` | Docker scaffolding, build, run, push, and image security scan |
| `/buildflow-audit` | OWASP Top 10 security scan + container CVE scan |
| `/buildflow-status` | See current phase and progress |
| `/buildflow-help` | Diagnostic mode + recovery |

## Core Rules

- Each agent receives a **minimal context packet** — only what it needs, nothing else
- `light.md` must stay under 3K tokens — prune silently at session start if over
- Ask confidence (1-5) before locking major decisions
- Run `/buildflow-spec` before `/buildflow-plan` — no spec, no plan
- `/buildflow-ship` blocks if any Acceptance Criterion is unsatisfied
- Create restore points before destructive operations (file snapshot unless `git.permission: approved`)
- Run `/buildflow-audit` before every `/buildflow-ship`
- No-git mode: all features work — snapshots replace stash, PLAN.md tracks wave progress, state.md records phase milestones
- **Strict mode** — when `strict_mode: true` or phase planned with `--strict`: `/buildflow-check --strict` is mandatory before ship; strict violations have no override flag

## Strict Mode

Strict mode enforces structural spec-to-code mirroring for critical infrastructure phases. Enable it when code correctness must strictly mirror spec structure.

**When to use strict mode:**
- Auth systems, payment flows, crypto implementations
- Compliance-sensitive code (HIPAA, PCI, GDPR enforcement logic)
- Multi-service infrastructure where contract drift causes silent failures
- Any phase where "spec says X, code does Y" is a security or correctness defect

**What strict mode checks (in `/buildflow-check --strict`):**
1. **API contracts** — response/request field names must match TDD exactly (not just "a body exists")
2. **Component map** — every file created this phase must appear in the TDD Component Map
3. **Critical symbol coverage** — every exported function in critical modules must have an AC reference
4. **AC branch completeness** — every error/edge-case AC must have a corresponding code branch

**What strict mode does NOT do:**
- Does not check line-by-line code content (that is a human code review)
- Does not run on non-critical modules (utility, config, infra files)
- Does not block on warnings — only on structural divergences

**To enable per-phase:** `/buildflow-plan --strict`
**To enable globally:** set `strict_mode: true` in `.buildflow/you/preferences.md`
**Critical module patterns:** configurable via `strict_critical_modules` in preferences.md

## Guided Mode

**Every command ends with a `→ Next step:` block** — one specific, actionable recommendation based on current state. This is not optional and not a lookup table. It is a single instruction the developer can follow immediately without thinking.

Format (printed as the very last thing before the token line):
```
──────────────────────────────────────────────────
→ Next:  /buildflow-[command] [args if needed]
   Why:  [one sentence — what this will do for you right now]
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If multiple valid paths exist (e.g., fix an AC vs ship anyway): show the recommended path first with `→ Next:`, then show the alternative as `   Or:`.

Context management events (pruning, drift detection, token accumulation) are **never surfaced** unless they require action. The developer should never think about `light.md`.

The only context events that surface:
- `⚠ Onboard data may be stale` — when a load-bearing file or schema changed since last onboard
- `⚠ light.md is near limit` — only when pruning cannot be done silently (manual decision needed)
- Update available notification

## Token Cost Tracking

Every command measures and reports its actual token usage at the end:

**How it works:**
1. At the START of a command, measure the total size of all files in its Context Packet: sum of file character counts ÷ 4 = **input tokens**
2. At the END of a command, estimate output tokens from the length of text generated (character count ÷ 4)
3. **Command token cost** = input + output
4. **Add to running total** in `state.md → session_tokens_used`
5. Print the cost report at command end

**Token cost report format — two modes:**

**Default (minimal — one line):**
```
Session: ~[N]K tokens used this session
```

**Verbose (only if `verbose_context: true` in preferences.md):**
```
Token Cost — /buildflow-[command]
──────────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

The session line is always shown at the end of every command output — a single number, not a breakdown. The full breakdown is available any time via `/buildflow-status`.

**Why minimal is the default:**
- Developers care that costs are measured, not that they read them after every command.
- The number is always there when they want it. It is never in their way when they don't.

**To check session total at any time:** `/buildflow-status` shows full token spend breakdown.

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
├── core/
│   ├── vision.md       ← What we're building
│   └── state.md        ← Current phase and status
├── specs/              ← Generated by /buildflow-spec  ← NEW
│   ├── PRD.md          ← Product Requirements
│   ├── TDD.md          ← Technical Design
│   └── acceptance.md   ← Acceptance Criteria (AC-001, AC-002...)
├── you/
│   └── preferences.md  ← Experience level, style prefs
├── memory/
│   └── light.md        ← Persistent context (≤3K tokens, auto-pruned)
├── codebase/           ← Generated by /buildflow-onboard
│   ├── MAP.md
│   ├── PATTERNS.md
│   ├── DEPENDENCIES.md
│   └── HOTSPOTS.md
├── security/
│   ├── DEBT.md
│   └── reports/
├── phases/             ← Per-phase work and retros
├── snapshots/          ← File-based restore points (used when git unavailable)
└── learnings/
    ├── glossary.md
    └── decisions.md
```
