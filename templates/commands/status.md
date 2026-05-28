---
name: buildflow-status
description: Rich project dashboard — phase progress, AC coverage, debt summary, and next-action recommendations
allowed-tools: Read, Bash
agent: strategist
---

# /buildflow-status

Full project dashboard. Shows where you are across phases, AC progress, wave completion, debt, and what to do next.

## Usage
- `/buildflow-status` — full dashboard
- `/buildflow-status --short` — one-line summary only

---

## Step 1: Load State
Read `.buildflow/STATE.md`, `.buildflow/MEMORY.md`, `.buildflow/phases/[N]/DEBT.md`.
If a current phase exists, also read `.buildflow/phases/[N]/PLAN.md`.
If `.buildflow/phases/[N]/VERIFICATION.md` exists, read it as the AC verification ledger.
If `.buildflow/phases/[N]/STATE.md` exists, read it first for the compact resume state and show any mismatch with `PLAN.md`/`MEMORY.md` as a warning.

---

## Step 2: Project Header
```
Project: [app_name]
Framework: [framework]  Language: [language]
Phase: [N]  Spec: v[spec_version]  Onboarded: [yes/no]
Last session: [date]
```

---

## Step 3: Phase Progress

### Spec status
```
Spec Status
───────────
[NONE]        → run /buildflow-spec
[DRAFT]       → spec in progress
[LOCKED v[N]] → ready to plan  ✓
```

### AC progress bar (if spec is locked)
Read `ACCEPTANCE.md`. Prefer `.buildflow/phases/[N]/VERIFICATION.md` for each AC's latest status and evidence. If it is missing, fall back to the last `/buildflow-check` output if cached; otherwise show as `?`.
```
AC Progress  [Phase N — spec v[N]]
───────────────────────────────────
AC-001  ✓  login with valid credentials
AC-002  ✓  invalid password rejected
AC-003  ✗  password reset not implemented
AC-004  ?  (not yet verified)
AC-NF-001 ✓  response time < 200ms

[3 / 5 passing]  ████████░░  60%
```

### Wave progress (if plan exists)
```
Wave Progress
─────────────
Wave 1 — DB/Schema       ✓ COMPLETE  (3 tasks)
Wave 2 — Auth Services   ⟳ IN PROGRESS  (2/4 tasks done)
Wave 3 — Routes          ○ PENDING
Wave 4 — UI              ○ PENDING

Overall: 5/12 tasks  ████░░░░░░  42%
Est. remaining: ~6h
```

### Coverage & telemetry (if last build recorded it)
```
Last Build Quality
──────────────────
Tests:      ✓ PASS  ([N] passing, 0 failing)
Coverage:   [N]%  [↑ / ↓ [X]% from last ship]
Type-check: ✓ PASS
Lint:       ⚠ [N] warnings
Bundle:     [N] KB  [↑ / ↓ [X]%]
```

---

## Step 4: Debt Summary
Read `.buildflow/phases/[N]/DEBT.md`. Count by category:
```
Security Debt
─────────────
Open items: [N]
  Critical:  [N]  ← address before next ship
  High:      [N]
  Coverage:  [N] (coverage drops not yet addressed)
  Test:      [N] (skipped tests)
  Spec:      [N] (spec gate skips, stale plan builds)

[0 items] → ✓ Clean
[1–3 items] → ⚠ Minor debt — plan to address
[4+ items] → 🔴 Debt accumulating — consider a cleanup phase
```

---

## Step 5: Feature Suggestions (if available)
If `.buildflow/phases/[N]/SUGGESTIONS.md` exists and was updated in the last 7 days, show the top 3 suggestions:
```
Next Feature Ideas  (from last ship analysis)
─────────────────────────────────────────────
1. [feature] — [why it matters]
2. [feature] — [engineering standard]
3. [feature] — [market gap]

Run /buildflow-help next for full analysis.
```

---

## Step 5b: Token Spend
Read `STATE.md` for `session_tokens_used` and `session_start`. Read `MEMORY.md` for per-command costs.

```
Token Spend  Phase [N]
──────────────────────
/buildflow-spec:    ~[N]K   (context: [N]K, output: [N]K — includes plan generation)
/buildflow-discuss: ~[N]K   (context: [N]K, output: [N]K — if run)
/buildflow-build:   ~[N]K   ([N] waves — context: [N]K, output: [N]K)
/buildflow-check:   ~[N]K   (context: [N]K, output: [N]K)
/buildflow-onboard: ~[N]K   (one-time — context: [N]K, output: [N]K)
                    ──────
Phase total:        ~[N]K

Current session:    ~[N]K   (since [session_start])
```

Token costs are measured from actual loaded file sizes (chars ÷ 4) + generated output length. Not guesses — measured.

---

## Step 6: Next Step (always shown last, always prominent)

Determine the single most valuable next action from the state loaded in Steps 1–5. Print it as:

```
──────────────────────────────────────────────────
→ Next:  /buildflow-[command] [args if needed]
   Why:  [one sentence — what this does right now]
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If there is a blocking issue (failing tests, schema drift, AC failures), the next step addresses the blocker — not the normal workflow step.

If debt > 4 items and user is about to start a new spec: add a second line:
```
   Or:   /buildflow-think --debt  (address [N] open debt items first)
```

Never show a table. One recommendation. One sentence of why. That's it.

---

## Token Budget: ~5K (--short: ~1K)
