---
name: buildflow-modify
description: Surgical code change with transitive impact analysis, risk scoring, and test coverage verification
allowed-tools: Read, Write, Grep, Glob, Bash
agent: surgeon
---

# /buildflow-modify

Precise, safe changes to existing code. The Surgeon runs a full transitive impact analysis — not just "what files change" but the full chain of consequences — scores risk per affected file, verifies test coverage, and applies the minimum effective change.

Works for features and bugfixes equally.

## Usage
- `/buildflow-modify "Add rate limiting to /api/auth/login"`
- `/buildflow-modify "Fix null pointer crash when user has no profile photo"`
- `/buildflow-modify src/auth/login.ts "Add input validation"`
- `/buildflow-modify --dry-run "Rename getUserById to fetchUserById"`

## Context Packet
- `.buildflow/codebase/MAP.md`
- `.buildflow/codebase/GRAPH.md` (import dependency graph — essential for impact analysis)
- `.buildflow/codebase/HOTSPOTS.md`
- `.buildflow/codebase/PATTERNS.md`
- Target file(s) if named in command

If not onboarded: "Run `/buildflow-onboard` first — impact analysis requires the dependency graph."

---

## Step 1: Understand the Change
Parse the description. Identify:
- **What** must change (behavior, data, interface)
- **Where** the change originates (file, function, module)
- **What must NOT change** (caller contracts, existing behavior outside scope)
- Is this a feature (new capability) or a bugfix (restoring expected behavior)?

If ambiguous: ask ONE clarifying question only.

---

## Step 2: Transitive Impact Analysis
Using `GRAPH.md`, trace the full impact chain from the target file outward:

```
Level 0 — Direct change:
  src/auth/login.ts  ← file being modified

Level 1 — Direct dependents (imports Level 0):
  src/routes/auth.routes.ts   fan-in to login.ts
  src/tests/auth.test.ts      fan-in to login.ts

Level 2 — Transitive dependents (imports Level 1):
  src/app.ts                  imports auth.routes.ts
  src/middleware/session.ts   imports auth.routes.ts

Level 3 — Entry point:
  main.ts                     imports app.ts
```

For each affected file, annotate:
- **Risk score** (from HOTSPOTS.md, or calculate: fan-in + size + test coverage)
- **Test coverage**: does a test file cover this file?
- **Contract sensitivity**: does this file export a public API? If yes, callers may break.
- **Module boundary**: does this change cross a module boundary?

**Impact Summary:**
```
Impact Analysis: "Add rate limiting to /api/auth/login"
────────────────────────────────────────────────────────
Direct:
  src/auth/login.ts            risk: 4.2  tests: YES  contract: INTERNAL

Level 1 — will be affected:
  src/routes/auth.routes.ts    risk: 3.1  tests: YES  contract: PUBLIC ← caller may need update
  src/tests/auth.test.ts       risk: 1.0  tests: N/A  contract: NONE   ← will need new test case

Level 2 — may be affected:
  src/app.ts                   risk: 3.8  tests: partial  contract: ENTRY
  src/middleware/session.ts    risk: 2.5  tests: YES      contract: INTERNAL ← verify no conflict

Blast radius: 4 files modified, 1 file needing new test, 0 public API breaks expected
Highest risk file touched: src/auth/login.ts (4.2)
```

If any Level 2+ file has risk ≥ 4.0: flag as "Caution — high-risk transitive impact. Consider splitting this change."

---

## Step 3: API Contract Check
If the change modifies a function/method signature or REST endpoint:

**Before (current contract):**
```
loginUser(email: string, password: string): Promise<AuthToken>
POST /api/auth/login  →  { token: string, expiresAt: number }
```

**After (new contract):**
```
loginUser(email: string, password: string, options?: RateLimitOptions): Promise<AuthToken>
POST /api/auth/login  →  { token: string, expiresAt: number }  [+ 429 Too Many Requests]
```

List all callers that pass through this contract and verify they still compile/run with the new signature. If any caller will break: add fixing those callers to the task list.

---

## Step 4: Test Coverage Map
For each file in the impact chain, verify:
- Does a test file exist that imports or calls it?
- Do those tests cover the behavior being changed?
- After the change, which tests will need updating?

```
Test Coverage for this change:
  login.ts        → src/tests/auth.test.ts (covers: login flow, invalid password)
                    MISSING: rate limit behavior — must add
  auth.routes.ts  → src/tests/routes.test.ts (covers: route registration)
                    OK: no change needed
  session.ts      → NO TESTS FOUND ← flag: untested file in impact chain
```

Flag any untested file in the impact chain as a risk.

---

## Step 5: Confirmation
Show the impact summary, contract change, and test coverage map. Ask:

> "This change touches [N] files with blast radius [N]. Highest-risk: [file] ([score]).
> Proceed, narrow scope, or investigate further?"

Only proceed on explicit confirmation.

---

## Step 6: Restore Point
```bash
git stash push -m "pre-modify: [description]"
# or if nothing to stash:
git tag "pre-modify-$(date +%Y%m%d-%H%M)"
```

---

## Step 7: Surgical Implementation
Make the minimum effective change:
- Change only what the impact analysis identified
- Follow existing code style (PATTERNS.md)
- Add `LEARN:` comment ONLY if introducing a pattern not present elsewhere
- Do NOT refactor, rename, or clean up surrounding code

For each file modified: confirm it matches the Before → After contract.

---

## Step 7b: Write / Update Tests (mandatory — part of the change, not optional)

### First: detect test framework (if not already known from onboarding)
```bash
# JS/TS
cat package.json | grep -E "jest|vitest|mocha|jasmine|supertest"
ls jest.config.* vitest.config.* 2>/dev/null
find . -name "*.test.ts" -o -name "*.spec.ts" | head -3

# Python
cat requirements.txt pyproject.toml 2>/dev/null | grep pytest

# Go: look for *_test.go files
# Rust: look for #[cfg(test)] blocks
```

| Framework status | Action |
|-----------------|--------|
| Found + test files exist | Follow existing conventions exactly |
| Found + no test files yet | Use framework, create first test file |
| Not found | Warn user: "No test framework detected. Tests skipped. Add [recommended framework] and re-run." Log gap to `security/DEBT.md`. |

For each source file touched in Step 7:

**If a test file already exists for this file:**
- Open it
- Add test cases for every function whose behavior changed
- If the function's signature changed: update the callers in the test
- If the bug was in a specific code path: add a regression test that names the exact scenario

**If no test file exists:**
- Create one following the project test convention (from PATTERNS.md):
  - Co-located: `auth.service.ts` → `auth.service.test.ts`
  - Or in test folder: match existing structure
- Cover: each function touched in this change + the specific behavior the change introduces

**For bugfixes specifically:**
1. Write the regression test BEFORE applying the fix
2. Run it — confirm it fails (proves the bug exists)
3. Apply the fix
4. Run again — confirm it passes (proves the fix works)
5. Name the test after the exact bug: `should not return null when profile photo is missing`

**Test coverage report after this step:**
```
Test changes for this modify
─────────────────────────────
auth.service.ts      → auth.service.test.ts   +3 cases (rate limit happy path, 429 response, reset after window)
auth.routes.ts       → auth.routes.test.ts    +1 case (rate limit header present)
session.ts           → session.test.ts        CREATED — 4 cases (was untested, now covered)
```

Do not proceed to Step 8 until every touched source file has corresponding test coverage.

---

## Step 8: Test + Verify
Run full test suite. On failure: fix and retest (max 3 attempts).

Also verify:
- All files in the impact chain still compile
- Callers of changed contracts still function
- The regression test (for bugfixes) now passes
- No previously passing tests were broken

---

## Step 9: Update Memory
```yaml
last_modify: [today]
change: [description]
files_changed: [N]
impact_level: [direct/level1/level2]
```

---

## --dry-run Flag
Runs Steps 1–5 only. Shows full impact analysis and contract changes without modifying any file.
Use this before a risky change to understand blast radius first.

## Token Budget: ~30K (more if impact chain is deep)
