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

2. **Prune memory** — read `.buildflow/memory/light.md`. If over 3K tokens, prune it:
   - Archive phase task lists and build timestamps to `phases/[last phase]/retro.md`
   - Keep: app_name, framework, language, current_phase, spec_status, style_fingerprint, last 2 decisions
   - Report: "Context pruned: light.md [X] → [Y] tokens"

3. **Load state** — read `.buildflow/core/state.md` for current phase and status

4. **Detect git availability** — run silently:
   ```bash
   git rev-parse --git-dir 2>/dev/null && echo "GIT_OK" || echo "NO_GIT"
   ```
   - `GIT_OK` → set `git_available: true` in `light.md`. All git operations work normally.
   - `NO_GIT` → set `git_available: false` in `light.md`. Show **once per session**:
     > "⚠ Git not detected. BuildFlow is running in **no-git mode**: restore points use file snapshots, wave commits are tracked in PLAN.md, and phase tags are recorded in state.md instead. All core features still work."
   - If `git_available` was already set in `light.md`, skip this check and use the stored value.

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
| `/buildflow-ship` | Spec gate + security gate + context prune + git tag |
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
- `light.md` must stay under 3K tokens — prune at session start if over
- Ask confidence (1-5) before locking major decisions
- Run `/buildflow-spec` before `/buildflow-plan` — no spec, no plan
- `/buildflow-ship` blocks if any Acceptance Criterion is unsatisfied
- Create restore points before destructive operations (git stash OR file snapshot — see no-git mode)
- Run `/buildflow-audit` before every `/buildflow-ship`
- No-git mode: all features work — snapshots replace stash, PLAN.md tracks wave progress, state.md records phase milestones

## Token Cost Tracking

Every command measures and reports its actual token usage at the end:

**How it works:**
1. At the START of a command, measure the total size of all files in its Context Packet: sum of file character counts ÷ 4 = **input tokens**
2. At the END of a command, estimate output tokens from the length of text generated (character count ÷ 4)
3. **Command token cost** = input + output
4. **Add to running total** in `state.md → session_tokens_used`
5. Print the cost report at command end

**Token cost report format (used by all commands):**
```
Token Cost — /buildflow-[command]
──────────────────────────────────
Context loaded: ~[N]K tokens   ([list of files with char counts])
Output generated: ~[N]K tokens
This command: ~[N]K tokens
Session total: ~[N]K tokens   (since [session_start])
```

**Why this is accurate:**
- Context loading is the dominant cost. Measuring actual loaded file sizes gives real numbers, not guesses.
- Output estimation (chars ÷ 4) is accurate to ±10% for prose and code.
- Session total accumulates across all commands — you see total spend for the session.

**To check session total at any time:** `/buildflow-status` shows `Session tokens: ~[N]K` from state.md.

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
