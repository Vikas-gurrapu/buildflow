---
name: buildflow-status
description: Show current project state and phase progress
allowed-tools: Read
agent: strategist
---

# /buildflow-status

Quick orientation — where are you in the BuildFlow workflow?

## Step 1: Load State
Read `.buildflow/core/state.md` and `.buildflow/memory/light.md`.

## Step 2: Display Summary

```
Project: [app name]
Phase: [current phase]
Status: [Initialized / In Progress / Shipped]
Type: [greenfield / existing]
Framework: [detected framework]
Onboarded: [yes / no / n/a]
Last session: [date]
```

## Step 3: Current Phase Progress
If in a phase, read `.buildflow/phases/[N]/PLAN.md` and show:
- Total tasks
- Completed tasks
- Remaining tasks
- Estimated completion

## Step 4: Security Status
Read `.buildflow/security/DEBT.md`:
- Clean: "No outstanding security debt"
- Issues: List open items with severity

## Step 5: Recommend Next Action

Based on state:
- Phase 0 (just initialized): "Run /buildflow-start"
- Greenfield + no vision: "Run /buildflow-start"
- Has vision, no plan: "Run /buildflow-think or /buildflow-plan"
- Has plan, not built: "Run /buildflow-build"
- Built, not checked: "Run /buildflow-check"
- Checked: "Run /buildflow-ship"
- Existing + not onboarded: "Run /buildflow-onboard first"

## Token Budget: ~3K
