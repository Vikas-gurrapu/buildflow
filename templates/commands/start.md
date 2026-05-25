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

# 2. Schema file changes — were schema-defining files modified since last onboard?
git diff $(git log --format="%H" --after="[onboarded_at from intel.json]" | tail -1) HEAD -- "*.prisma" "*.entity.ts" "models.py" "schema.sql" 2>/dev/null

# 3. Load-bearing file changes — were high-risk files touched?
git log --since="[onboarded_at]" --name-only --format="" -- [load_bearing files from intel.json] 2>/dev/null | head -10
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

## Step 4: Recommend Next Step

| Situation | Next command |
|-----------|-------------|
| Greenfield, confidence 4–5 | `/buildflow-spec` — define what to build formally |
| Greenfield, confidence 1–3 | `/buildflow-think [topic]` — research first |
| Existing project, not onboarded | `/buildflow-onboard` — map codebase first |
| Existing project, onboarded | `/buildflow-spec` or `/buildflow-modify` |
| Emergency fix needed | `/buildflow-hotfix "description"` |

## light.md Pruning Rules
If `light.md` exceeds 3K tokens on session start:
- Remove: completed phase task lists, wave details, build timestamps older than last phase
- Archive these to the most recent `phases/[N]/retro.md`
- Keep: app_name, framework, language, current_phase, spec_status, style_fingerprint, last 2 decisions
- After pruning: report "Context pruned: light.md reduced from [X] → [Y] tokens"

## Token Budget: ~8K
