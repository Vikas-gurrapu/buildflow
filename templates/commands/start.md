---
name: buildflow-start
description: Start a project with BuildFlow's Strategist agent
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-start

Begin your project. Works for both greenfield and existing codebases.

## Context Packet (load only these)
- `.buildflow/memory/light.md`
- `.buildflow/you/preferences.md`

Do NOT load: specs, phases, codebase files — this is vision only.

## Step 1: Load Memory
Read `.buildflow/memory/light.md` and `.buildflow/you/preferences.md`.
If `light.md` is over 3K tokens: prune it now (see pruning rules below).

## Step 1b: Codebase Drift Detection (runs if onboard_status: yes)

If `intel.json` exists at `.buildflow/codebase/intel.json`, run a fast drift check against the recorded baseline. This takes seconds and catches silent codebase changes between sessions.

**Drift checks:**

```bash
# 1. File count drift — did the number of files change significantly?
find src/ -type f | wc -l
# Compare against intel.json file_count field

# 2. Schema file changes (git available):
git diff $(git log --format="%H" --after="[onboarded_at from intel.json]" | tail -1) HEAD -- "*.prisma" "*.entity.ts" "models.py" "schema.sql" 2>/dev/null
# Schema file changes (no-git mode):
# Hash each schema file listed in intel.json drift_baseline.file_hashes
# Compare against stored hash — any mismatch = changed

# 3. Load-bearing file changes (git available):
git log --since="[onboarded_at]" --name-only --format="" -- [load_bearing files from intel.json] 2>/dev/null | head -10
# Load-bearing file changes (no-git mode):
# Compare modification timestamp of each load_bearing file in intel.json against drift_baseline.recorded_at
```

**Drift signals and responses:**

| Signal | Threshold | Response |
|--------|-----------|----------|
| New files added | > 5 new source files | Warn: "N files added since onboard — run `/buildflow-onboard --update`" |
| Schema file changed | Any change | Warn: "Schema changed since onboard — run `/buildflow-onboard --update` to refresh drift baseline" |
| Load-bearing file changed | Any of top-5 risk files | Warn: "[file] changed — impact analysis may be stale. Run `/buildflow-onboard --update`" |
| File count delta > 20% | Absolute | Alert: "Codebase changed significantly — recommend full `/buildflow-onboard` re-run" |
| No drift detected | — | Silent. Do not mention. |

Only report warnings — never block session start. The user may already know about the changes.

**Fast path (no git):** compare file count in `intel.json` against current `find src/ -type f | wc -l`. If delta > 10 files, warn.

---

## Step 1c: Load Phase History (cross-phase continuity)

If any `phases/*/SHIPPED.md` files exist, load the last 3 (sorted by phase number descending). Each is ≤500 tokens, so 3 together cost ≤1.5K tokens — worth it for full project continuity.

```bash
ls .buildflow/phases/*/SHIPPED.md 2>/dev/null | sort -t/ -k3 -rn | head -3
```

From these, extract:
- What was built in prior phases (prevents re-speccing already-shipped features)
- Open technical debt inherited from prior phases
- Architecture decisions that constrain the current phase

Print a one-line history summary per phase:
```
Phase history
─────────────
Phase 1 (shipped 2024-01-10): Auth — login, password reset, JWT [6 ACs, 74% coverage]
Phase 2 (shipped 2024-01-20): User profiles — avatar, bio, preferences [8 ACs, 79% coverage]
```

If no SHIPPED.md files: skip silently (first phase or pre-continuity project).

---

## Step 2: Detect Mode

**Greenfield (no src/ code yet):**
Ask vision questions one at a time:
1. What are you building?
2. Who is it for?
3. What problem does it solve?
4. What's the simplest useful version?
5. Timeline, team size, constraints?
6. Confidence in the idea (1-5)?

**Existing codebase (src/ exists):**
Check if `.buildflow/codebase/MAP.md` exists.
- If NO: "Run `/buildflow-onboard` first to analyze your codebase."
- If YES: Load MAP.md summary only (not full file). Ask about goals for this session.

## Step 3: Save Vision
Write to `.buildflow/core/vision.md`.
Initialize `light.md` with:
```yaml
app_name: [name]
framework: [detected or stated]
language: [detected or stated]
phase: 0
spec_status: none
plan_status: none
onboard_status: [yes/no]
last_session: [today]
```

## Step 4: Guided Next Step

Determine the single most valuable next action and print it clearly:

```
──────────────────────────────────────────────────
→ Next:  /buildflow-[command]
   Why:  [one sentence — what this unlocks right now]
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

**Decision logic (pick the first match):**

| State | Next command | Why |
|-------|-------------|-----|
| Emergency fix described | `/buildflow-hotfix "[description]"` | Fast-path fix — no overhead |
| Existing project, not onboarded | `/buildflow-onboard` | Impact analysis needs the codebase map first |
| No spec exists | `/buildflow-spec` | Spec is required before planning — defines what to build |
| Spec draft in progress | `/buildflow-spec` | Continue and lock the spec |
| Confidence ≤ 3 on topic | `/buildflow-think [topic]` | Research before committing to a spec |
| Spec locked, no plan | `/buildflow-plan` | Translate spec into executable waves |
| Plan ready, build not started | `/buildflow-build` | Execute wave 1 |
| Build in progress | `/buildflow-build wave-[N]` | Continue where you left off |
| All waves complete, not checked | `/buildflow-check` | Verify every AC is satisfied |
| Check passed | `/buildflow-ship` | Run all gates and ship the phase |
| Just shipped | `/buildflow-spec "[next feature]"` | Start the next phase |
| Onboarded, no active phase | `/buildflow-modify "[what to change]"` | Surgical change to existing code |

Never show a table to the user — pick one command and explain why.

## light.md Pruning Rules (silent — never shown to user)
If `light.md` exceeds 3K tokens on session start:
- Remove: completed phase task lists, wave details, build timestamps older than last phase
- Archive these to the most recent `phases/[N]/retro.md`
- Keep: app_name, framework, language, current_phase, spec_status, style_fingerprint, last 2 decisions
- Do NOT report this operation. It is invisible.

## Token Budget: ~8K
