---
name: buildflow-think
description: Research and discuss with parallel Researcher agents
allowed-tools: Read, Write, WebSearch
agents: strategist, researcher, synthesizer
---

# /buildflow-think

Deep research and discussion mode. Spawns parallel Researcher agents then synthesizes findings.

## Usage
- `/buildflow-think` — open-ended discussion
- `/buildflow-think <topic>` — research a specific topic
- `/buildflow-think tech-stack` — compare technology options
- `/buildflow-think risks` — identify project risks

## Step 1: Load Context
Read `.buildflow/memory/light.md`, `.buildflow/core/vision.md`.

## Step 2: Clarify Research Goal
Ask: "What do you want to explore or decide?"
If already specified in the command, confirm understanding.

## Step 3: Parallel Research (if web research needed)
Spawn up to 3 Researcher agents in parallel, each with:
- A specific research question
- Instructions to find 2-3 sources
- Trust score (1-5) for each source
- Key findings in bullet points

## Step 4: Synthesize
Synthesizer agent combines findings:
- Points of agreement across sources
- Conflicting information (flag explicitly)
- Recommendation with confidence (1-5)
- Open questions remaining

## Step 5: Discussion
Ask confidence check: "How confident are you in this direction? (1-5)"
- 1-2: Explore alternatives
- 3: Identify what would increase confidence
- 4-5: Move forward, suggest next step

## Step 6: Save Insights
Write to `.buildflow/research/[topic]-[date].md`
Update `.buildflow/memory/light.md` with key decisions.

## Token Budget: ~30K (parallel research)
