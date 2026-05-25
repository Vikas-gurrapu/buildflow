---
name: buildflow-help
description: Diagnostic help, recovery paths, and feature suggestions after milestone completion
allowed-tools: Read, Bash, WebSearch
agent: strategist
---

# /buildflow-help

Diagnostic mode, recovery guide, and post-milestone advisor. Use when stuck, when something failed, or after completing a feature to discover what to build next.

## Usage
- `/buildflow-help` — orientation + current situation diagnosis
- `/buildflow-help stuck` — structured recovery from common failure states
- `/buildflow-help reset` — safely abandon current phase or full reset
- `/buildflow-help <error message>` — diagnose a specific error
- `/buildflow-help next` — what features/improvements to build next (post-milestone)
- `/buildflow-help standards` — check if your app meets industry standards for its type
- `/buildflow-help git-enable` — enable git after initially declining
- `/buildflow-help git-resolve-parked` — commit parked changes once git is restored

---

## Step 1: Load Current State
Read `.buildflow/core/state.md`, `.buildflow/memory/light.md`, and `.buildflow/security/DEBT.md`.
Check if `.buildflow/` is properly structured.

Print a one-paragraph "here's where you are" summary:
```
Situation
─────────
Project: [app_name]  Phase: [N]  Framework: [framework]
Status: [what's happening — "mid-build wave 2", "tests failing", "just shipped phase 1", etc.]
Outstanding debt: [N items in DEBT.md]
Last action: [last command + date from light.md]
```

---

## Step 2: Diagnose

### If `.buildflow/` is missing:
"BuildFlow isn't initialized here. Run: `npx buildflow-dev init`"

### If state.md is corrupted:
Re-detect project and recreate state.md. Read package.json / go.mod / Cargo.toml to infer framework.

### If stuck mid-build (tests failing repeatedly):
Read `phases/[N]/PLAN.md` and the last fix log entries. Diagnose:
- Which wave failed?
- What was the last attempted fix?
- Has the same error appeared more than twice? → likely a root cause issue, not a symptom

### If error message provided:
Classify the error:
- **Build/type error** → point to specific file:line, suggest fix pattern
- **Test failure** → identify which AC it covers, suggest debugging approach
- **BuildFlow config error** → repair the config field
- **AI tool integration error** → check CLAUDE.md / .gemini / .cursorrules is correctly installed

---

## Step 3: Recovery Paths

| Situation | Recovery action |
|-----------|----------------|
| Tests failing after wave | `/buildflow-debug` — root-cause analysis before retrying |
| Spec changed mid-phase | `/buildflow-spec --review` to see diff, then `/buildflow-plan` to regenerate |
| Plan feels wrong | `/buildflow-plan` again — re-run with `--risk-first` flag |
| Wave has too many failures | Split the failing task into smaller tasks manually, then continue |
| Wrong files modified | `/buildflow-back` to restore, then `/buildflow-modify` with narrower scope |
| DEBT.md is growing fast | Stop and do a debt-clearing phase: `/buildflow-think --debt` first |
| Lost track of what's done | `/buildflow-status` for current state, `/buildflow-check` for AC verification |
| Onboard feels stale | `/buildflow-onboard --update` to refresh changed modules only |
| Build is very slow | Check if context packets are loading too much — read CLAUDE.md "Context Packet" rules |

### Safe abandon (current phase only):

Before any git command, read `.buildflow/you/preferences.md`.

**If `git.permission: approved`:**
```bash
git stash push -m "abandoned phase [N] work"
```

**If `git.permission` is not `approved` (no-git mode):**
The last wave snapshot in `.buildflow/snapshots/phase-[N]-wave-[M]-complete/` is your restore point.
To roll back to before the current wave: copy files from that snapshot back to their original paths.
To see what snapshots exist: `ls .buildflow/snapshots/`

In both modes: reset `plan_status: none` in `light.md`. The spec remains — restart from `/buildflow-plan`.

### Full reset (destructive — asks for confirmation):
Removes `.buildflow/` entirely. Requires typing "RESET" to confirm.

---

## Step 3b: Git-Specific Recovery

### `/buildflow-help git-enable`
Enable git after initially declining during setup:

1. Verify git is installed: `git --version`
   - If not installed: direct to https://git-scm.com/downloads
2. If no repo exists: `git init`
3. Update `.buildflow/you/preferences.md`:
   ```yaml
   git:
     permission: approved
   ```
4. Update `light.md`: `git_permission: approved`, `git_available: true`
5. If any `parked_changes` exist in `light.md`: offer to commit them now (see `git-resolve-parked`)
6. Confirm: "Git enabled. From this session forward, BuildFlow will use commits, tags, and restore points."

---

### `/buildflow-help git-resolve-parked`
Commit parked changes in the correct order once git is restored:

Only run git commands here if `.buildflow/you/preferences.md` has `git.permission: approved`.
If permission is denied, explain that the user must run `/buildflow-help git-enable` first or keep using snapshots.

1. Read `parked_changes` from `light.md` — list all parked entries sorted by `parked_at` (oldest first)
2. For each parked entry:
   ```
   Parked: Phase [N], Wave [W] — [date]
   Files:  [list]
   Snapshot: .buildflow/snapshots/phase-[N]-wave-[W]-parked/

   These files are already in your working tree (you continued building on them).
   The snapshot is the state AT THE TIME of parking — used only as reference.
   ```
3. Commit each in order:
   ```bash
   git add [files from parked entry]
   git commit -m "feat: phase [N] wave [W] (delayed commit — was parked [date])"
   ```
4. After each successful commit: remove that entry from `parked_changes` in `light.md`
5. After all committed: `parked_changes: []` — confirm "All parked changes committed. Working tree is clean."

**If files were modified by a subsequent phase (stacked):** the commit will include both phases' changes for those files — that is expected and noted in the commit message:
```bash
git commit -m "feat: phase [N] wave [W] + phase [M] stacked changes (delayed commit)
  
  Note: src/auth/service.ts includes changes from both phases.
  Stack snapshot: .buildflow/snapshots/phase-[N]-final-state/"
```

---

## Step 4: All Commands Reference

### Core workflow
| Command | When |
|---------|------|
| `/buildflow-start` | Begin project or new session |
| `/buildflow-think [topic]` | Research before speccing or planning |
| `/buildflow-spec` | Define PRD + ACs before planning |
| `/buildflow-plan` | Create wave plan from spec |
| `/buildflow-build` | Execute plan — auto-tests, auto-fix |
| `/buildflow-check` | Verify all ACs satisfied |
| `/buildflow-ship` | Finalize with all gates |
| `/buildflow-deploy` | Deploy to staging/production |

### Targeted changes
| Command | When |
|---------|------|
| `/buildflow-modify "desc"` | Surgical change to existing code |
| `/buildflow-hotfix "desc"` | Fast emergency fix |
| `/buildflow-refactor [scope]` | Quality improvement without behavior change |
| `/buildflow-debug` | Root-cause analysis when stuck |

### Existing codebase
| Command | When |
|---------|------|
| `/buildflow-onboard` | First-time codebase analysis |
| `/buildflow-workspace` | Multi-repo / monorepo mapping |

### Docker & containers
| Command | When |
|---------|------|
| `/buildflow-docker scaffold` | Generate Dockerfile + docker-compose.yml |
| `/buildflow-docker build` | Build image locally |
| `/buildflow-docker run` | Start all services |
| `/buildflow-docker scan` | Security scan built image |
| `/buildflow-docker push [registry]` | Tag and push to registry |

### Verification & security
| Command | When |
|---------|------|
| `/buildflow-test` | Re-run tests after manual change |
| `/buildflow-audit` | OWASP Top 10 security scan |

### Utility
| Command | When |
|---------|------|
| `/buildflow-status` | Where am I? |
| `/buildflow-explain <term/file>` | Explain code or concept |
| `/buildflow-back [n]` | Undo recent changes |
| `/buildflow-help next` | What to build next |

---

## Step 5: Post-Milestone Feature Advisor (`/buildflow-help next` or `/buildflow-help standards`)

Run this after shipping a phase to discover what to build next based on:
1. What similar apps in the market offer that yours doesn't yet
2. What industry standards and engineering protocols your app type requires

### 5a — App Type Classification
Read `vision.md` and `light.md` to classify the app type:
```
App type detected: [e.g., SaaS dashboard / e-commerce / REST API / mobile app / dev tool / fintech / healthtech / social platform]
Core features shipped so far: [list from shipped phases]
```

### 5b — Market Research (parallel)
Spawn two parallel Researchers:

**Researcher A — Competitor feature set:**
Search for the top 3–5 apps in the same category. For each, identify:
- Core features that are standard/expected in this category
- Differentiating features that drive user retention
- Features your app has vs doesn't have yet

Example output:
```
Market Feature Gap Analysis — [App Type]
─────────────────────────────────────────
Category: Project management SaaS

Standard features (expected by users):
  ✓ Task creation and assignment       — you have this
  ✓ Due dates                          — you have this
  ✗ Recurring tasks                    — NOT YET
  ✗ Time tracking                      — NOT YET
  ✗ Integrations (Slack, GitHub, etc.) — NOT YET

Differentiating features (retention drivers):
  ✗ AI task suggestions               — NOT YET
  ✗ Dependency visualization          — NOT YET
  ✗ Workload balancing                — NOT YET
```

**Researcher B — Engineering standards for this app type:**
Check what protocols, patterns, and engineering standards apply to this category:

```
Engineering Standards Gap — [App Type]
───────────────────────────────────────
Category: SaaS with user accounts

Required / strongly expected:
  ✓ Email verification on signup
  ✗ Password strength enforcement     — NOT FOUND in codebase
  ✗ Rate limiting on auth endpoints   — NOT FOUND
  ✗ Session invalidation on logout    — NOT FOUND
  ✗ GDPR data export / deletion       — NOT FOUND (if serving EU users)

Performance standards:
  ✗ API response time monitoring      — no APM detected
  ✗ Database query optimization       — no query analysis tooling found

Reliability standards:
  ✗ Health check endpoint (/health)   — not found
  ✗ Graceful shutdown handling        — not found
  ✗ Structured logging                — not found (console.log detected)
```

### 5c — Synthesize + Prioritize

Combine both researchers' findings into a prioritized suggestion list:

```
Next Feature Suggestions
────────────────────────
[App: your-app]  [Type: SaaS dashboard]  [Phase: 2 shipped]

HIGH PRIORITY — standard gaps (users will notice absence):
  1. Rate limiting on auth endpoints     [Security standard — easy to add]
  2. Recurring tasks                     [Expected in every task manager]
  3. Password strength enforcement       [Auth security standard]

MEDIUM PRIORITY — retention features:
  4. Slack integration                   [Top competitor differentiator]
  5. Time tracking                       [Requested in similar apps' reviews]
  6. GDPR data export                    [Required if EU users]

LOW PRIORITY — advanced features:
  7. AI task suggestions                 [Emerging differentiator — complex]
  8. Workload visualization              [Power user feature]

ENGINEERING DEBT TO ADDRESS FIRST:
  → Health check endpoint (2h, critical for deployment monitoring)
  → Structured logging (replace console.log — 1h, important for production)

Suggested next phase: "Auth hardening + recurring tasks"
Run /buildflow-spec to define it.
```

### 5d — Save Suggestions
Write suggestions to `.buildflow/learnings/feature-suggestions.md` with date.
These persist across sessions and update each time `/buildflow-help next` runs.

---

## Token Budget: ~15K (diagnostic) / ~35K (with market research — /buildflow-help next)
