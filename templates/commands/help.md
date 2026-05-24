---
name: buildflow-help
description: Diagnostic help and recovery guide
allowed-tools: Read, Bash
agent: strategist
---

# /buildflow-help

Diagnostic mode. Use when stuck, confused, or when something isn't working.

## Usage
- `/buildflow-help` — general help and orientation
- `/buildflow-help stuck` — help getting unstuck
- `/buildflow-help reset` — reset BuildFlow state
- `/buildflow-help <error message>` — diagnose a specific error

## Step 1: Load Current State
Read `.buildflow/core/state.md` and `.buildflow/memory/light.md`.
Check if `.buildflow/` exists and is properly structured.

## Step 2: Diagnose

**If .buildflow/ is missing:**
"BuildFlow isn't initialized here. Run: `npx buildflow-dev init`"

**If state.md is corrupted:**
Re-detect project and recreate state.md from scratch.

**If stuck in a phase:**
Show what the current phase plan says and where progress stopped.
Suggest: continue from last completed task, or start over.

**If error message provided:**
Analyze the error:
- Is it a BuildFlow config issue?
- Is it a project code issue?
- Is it an AI tool integration issue?

## Step 3: Recovery Options

Based on the situation, offer:
1. **Continue** — pick up where you left off
2. **Re-run** — redo the last command from scratch
3. **Skip** — skip the problematic step with a note
4. **Reset phase** — restart current phase from the beginning
5. **Full reset** — clear `.buildflow/` and start fresh (asks for confirmation)

## Step 4: All Commands Reference

### Workflow (greenfield)
- `/buildflow-start` — begin project
- `/buildflow-think [topic]` — research and discuss
- `/buildflow-plan [phase]` — create execution plan
- `/buildflow-build [wave]` — execute the plan
- `/buildflow-check` — verify quality
- `/buildflow-ship` — finalize with security gate

### Existing codebase
- `/buildflow-onboard` — map codebase (one-time)
- `/buildflow-modify "description"` — surgical code change
- `/buildflow-refactor [scope]` — improve code quality

### Security
- `/buildflow-audit` — full OWASP scan
- `/buildflow-audit --quick` — recent changes only
- `/buildflow-audit --pre-ship` — lightweight pre-ship check

### Utility
- `/buildflow-status` — where am I?
- `/buildflow-explain <term/file>` — get explanation
- `/buildflow-back [n]` — undo recent changes
- `/buildflow-help` — this command

### CLI (terminal)
```
buildflow init
buildflow install [--tool <name>]
buildflow audit [--quick] [--target <path>]
buildflow status [--verbose]
buildflow update [--check]
```

## Token Budget: ~15K (full diagnostic)
