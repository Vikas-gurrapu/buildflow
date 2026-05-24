---
name: buildflow-explain
description: Explain code, concepts, or terms in plain language
allowed-tools: Read, WebSearch
agent: strategist
---

# /buildflow-explain

Plain-language explanations for code, concepts, jargon, or files.

## Usage
- `/buildflow-explain src/auth/middleware.ts`
- `/buildflow-explain JWT`
- `/buildflow-explain "What does this error mean: ECONNREFUSED"`
- `/buildflow-explain "How does the payment flow work?"`

## Step 1: Detect Type
What is being explained?
- **File/Code**: Read the file, explain what it does and why
- **Term/Concept**: Define it in context of this project
- **Error**: Diagnose the error and suggest fixes
- **Flow**: Trace the data/control flow end-to-end

## Step 2: Adapt to Experience Level
Read `.buildflow/you/preferences.md` for experience level.
- Junior: Use analogies, avoid jargon, explain the why
- Senior: Be concise, assume fundamentals, focus on nuance
- Unknown: Start at an intermediate level

## Step 3: Explain

**For files:**
1. Purpose — what problem does this solve?
2. How it works — key logic in plain English
3. How it connects — what calls this, what does it call?
4. Gotchas — anything non-obvious to watch out for

**For concepts/terms:**
1. One-sentence definition
2. How it applies to THIS project
3. Example in context
4. Further reading (if helpful)

**For errors:**
1. What the error means
2. Most likely cause in this codebase
3. How to fix it

## Step 4: Add to Glossary
If explaining a new term, append to `.buildflow/learnings/glossary.md`.

## Token Budget: ~2K
