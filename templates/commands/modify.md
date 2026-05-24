---
name: buildflow-modify
description: Safely modify existing code with the Surgeon agent
allowed-tools: Read, Write, Grep, Glob, Bash
agent: surgeon
---

# /buildflow-modify

Make precise, safe changes to existing code. The Surgeon agent minimizes blast radius.

## Usage
- `/buildflow-modify "Add dark mode toggle to settings page"`
- `/buildflow-modify src/auth/login.ts "Add rate limiting"`
- `/buildflow-modify --dry-run "Rename getUserById to fetchUserById"`

## Step 1: Load Codebase Context
Read `.buildflow/codebase/MAP.md` and `PATTERNS.md`.
If not onboarded: "Run /buildflow-onboard first."

## Step 2: Understand the Change
Ask:
1. What exactly needs to change?
2. What should NOT change (blast radius constraints)?
3. Are there tests that must keep passing?
4. Confidence in understanding the request (1-5)?

## Step 3: Impact Analysis
Before touching any code:
- List all files that will be modified
- List all files that call or import changed code
- Identify test files that cover this area
- Flag any security-sensitive areas

Show impact summary and ask for confirmation.

## Step 4: Create Restore Point
```bash
git stash  # or commit current state
# Log: "restore point before /buildflow-modify: [description]"
```

## Step 5: Surgical Modification
Make changes with minimum footprint:
- Change only what is necessary
- Match existing code style exactly (from PATTERNS.md)
- Add LEARN: comments for non-obvious changes
- Do NOT refactor unrelated code

## Step 6: Verify
- Run existing tests
- Check that unchanged code still works
- Diff review: does it match the spec?

## Step 7: Update Memory
```yaml
last_modify: [today]
change: [brief description]
files_changed: [list]
```

## --dry-run Flag
Shows what WOULD change without modifying files.

## Token Budget: ~30K
