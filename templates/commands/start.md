---
name: buildflow-start
description: Start a project with BuildFlow's Strategist agent
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-start

Begin your project. Works for both greenfield and existing codebases.

## Step 1: Load Memory
Read `.buildflow/memory/light.md` and `.buildflow/you/preferences.md`.

## Step 2: Detect Mode

**Greenfield (no src/ code):**
Ask vision questions one at a time:
1. What are you building?
2. Who is it for?
3. What problem does it solve?
4. What's the simplest useful version?
5. Timeline, team size, budget?
6. Confidence in the idea (1-5)?

**Existing codebase (src/ exists):**
Check if `.buildflow/codebase/MAP.md` exists.
- If NO: "Run /buildflow-onboard first to analyze your codebase."
- If YES: Load MAP.md. Ask about goals for this work session.

## Step 3: Save Vision
Write to `.buildflow/core/vision.md` and update `.buildflow/core/state.md`.

## Step 4: Recommend Next Step
- High confidence (4-5) + greenfield: "Run /buildflow-think"
- Low confidence: "Let's research first with /buildflow-think"
- Existing project, onboarded: "Ready! Try /buildflow-modify or /buildflow-think"

## Token Budget: ~8K
