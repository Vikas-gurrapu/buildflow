---
name: buildflow-onboard
description: Analyze existing codebase and create knowledge maps
allowed-tools: Read, Bash, Glob, Grep
agent: cartographer
---

# /buildflow-onboard

ONE-TIME analysis of your existing codebase. Creates knowledge maps for all other agents.

## When to Run
- First time using BuildFlow on existing project
- After major refactor
- After framework upgrade
- Use --update flag to refresh incrementally

## Step 1: Check Prior State
If `.buildflow/codebase/MAP.md` exists, ask: "Re-onboard (full) or update (incremental)?"

## Step 2: Structural Analysis
- Read folder structure
- Find entry points (package.json, main.py, Cargo.toml, go.mod)
- Map src/ organization
- Note configuration files

## Step 3: Technology Detection
Parse dependency files. Detect:
- Language(s)
- Framework(s)
- Major libraries
- Build tools
- Test setup

## Step 4: Pattern Recognition
Read 5-10 representative source files. Document:
- Component structure conventions
- Naming patterns (PascalCase, camelCase, snake_case)
- Import organization order
- Comment style
- Error handling approach
- Test file conventions

## Step 5: Complexity Assessment
- Identify large files (>300 lines)
- Find deeply nested code
- Note files with many imports (high coupling)
- Mark as HOTSPOTS for Surgeon agent

## Step 6: Generate Knowledge Files

Write these files:

### `.buildflow/codebase/MAP.md`
Architecture overview, folder structure, entry points, key patterns, top dependencies.

### `.buildflow/codebase/PATTERNS.md`
Code conventions: naming, component structure, imports, comments, error handling, testing.

### `.buildflow/codebase/DEPENDENCIES.md`
Top 10-15 dependencies with purpose, criticality, and security status.

### `.buildflow/codebase/HOTSPOTS.md`
Files to handle carefully: high complexity, frequently changed, low test coverage.

## Step 7: Update Memory
```yaml
.buildflow/memory/light.md:
  onboarded: true
  onboarded_date: [today]
  codebase_summary: [3-line summary]
```

## Step 8: Summary
Show: framework, file count, test coverage estimate, complexity summary.
Suggest: /buildflow-modify, /buildflow-refactor, or /buildflow-think.

## Token Budget: 30-40K (one-time cost, pays back immediately)
