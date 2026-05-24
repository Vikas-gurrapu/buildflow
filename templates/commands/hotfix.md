---
name: buildflow-hotfix
description: Fast-path fix for production incidents and small patches — no planning, no waves
allowed-tools: Read, Write, Bash, Grep, Glob
agent: surgeon
---

# /buildflow-hotfix

Emergency and small-patch path. Skips all planning, spec, and wave orchestration. Goes directly: understand → restore point → fix → test → ship.

Use this for:
- Production incidents
- One-liner bug fixes
- Small patches that don't justify a full plan
- Dependency version bumps
- Config changes

Do NOT use for: new features, refactors, or anything that touches more than ~5 files. Use `/buildflow-plan` + `/buildflow-build` for those.

## Usage
- `/buildflow-hotfix "fix login crash on empty password"`
- `/buildflow-hotfix "bump lodash to 4.17.21"`
- `/buildflow-hotfix src/api/auth.ts "rate limiting not applying to /refresh"`

## Context Packet (minimal — load only what's needed)
- `.buildflow/memory/light.md` (app_name, framework fields only)
- Target file(s) if specified
- Do NOT load: specs, phases, codebase MAP, PATTERNS — keep it fast

## Step 1: Understand the Fix
Parse the description. Identify:
- What is broken?
- What file(s) are likely involved?
- What is the expected behavior after the fix?

If the description is ambiguous, ask ONE clarifying question only.

## Step 2: Scope Check
Count files that need to change.
- 1–5 files: proceed
- 6+ files: warn — "This looks larger than a hotfix. Consider /buildflow-plan instead."
  - Ask: "Proceed as hotfix anyway? (yes/no)"

## Step 3: Create Restore Point
```bash
git stash push -m "hotfix restore point: [description]"
# or if clean working tree:
git tag "pre-hotfix-[timestamp]"
```

## Step 4: Apply Fix
Make the minimal change:
- Fix only the root cause
- Do not refactor, rename, or clean up surrounding code
- Match existing code style

## Step 4b: Write Regression Test (always — even in hotfix mode)

### First: check if a test framework exists
```bash
cat package.json | grep -E "jest|vitest|mocha" 2>/dev/null
find . -name "*.test.ts" -o -name "*.test.js" -o -name "test_*.py" | head -3
```

- **Framework found:** write the regression test using it
- **No framework found:** warn — "No test framework detected. Regression test skipped. This bug may recur." Log to `security/DEBT.md`: "Hotfix [description] shipped without regression test — no framework available."
- Do not block the hotfix for a missing framework, but always log the gap.

For the specific behavior being fixed:
1. Write a test that reproduces the bug before applying the fix
2. Run it — confirm it fails
3. Apply the fix (Step 4)
4. Run it again — confirm it passes

Name it after the exact bug:
```
it('should not crash when user has no profile photo')
it('should return 401 when session token is expired')
```

If a test file already exists for the changed file: add the case there.
If not: create a minimal test file covering this function only. Do not skip — a hotfix without a regression test will regress again.

## Step 5: Test
Run the full test suite:
```bash
npm test        # or pytest / go test etc.
```

If tests fail: fix and re-test. Max 3 attempts before stopping and asking the user.

## Step 6: Ship
```bash
git add [changed files only]
git commit -m "hotfix: [description]"
```

Do not create a phase, do not update state.md phase number.
Update `light.md`:
```yaml
last_hotfix: [today]
last_hotfix_desc: [description]
```

## Step 7: Report
```
Hotfix complete
───────────────
Fix: [what changed]
Files: [list]
Tests: passing
Commit: [hash]
Time: fast-path (no planning)
```

If no test coverage existed: "⚠ No test covers this area. Consider adding one."

## Token Budget: ~10K
