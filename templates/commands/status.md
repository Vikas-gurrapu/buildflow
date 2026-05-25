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
Read `.buildflow/core/state.md`, `.buildflow/memory/light.md`, `.buildflow/security/DEBT.md`.
If a current phase exists, also read `.buildflow/phases/[N]/PLAN.md`.

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
Read `acceptance.md`. For each AC, check if there's a passing test referencing it (from last `/buildflow-check` output if cached, otherwise show as `?`):
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
Read `.buildflow/security/DEBT.md`. Count by category:
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
If `.buildflow/learnings/feature-suggestions.md` exists and was updated in the last 7 days, show the top 3 suggestions:
```
Next Feature Ideas  (from last ship analysis)
─────────────────────────────────────────────
1. [feature] — [why it matters]
2. [feature] — [engineering standard]
3. [feature] — [market gap]

Run /buildflow-help next for full analysis.
```

---

## Step 5b: Token Spend (if recorded in light.md)
```
Token Spend  Phase [N]
──────────────────────
/buildflow-spec:    ~[N]K
/buildflow-plan:    ~[N]K
/buildflow-build:   ~[N]K  ([N] waves)
/buildflow-check:   ~[N]K
/buildflow-onboard: ~[N]K  (one-time)
                    ──────
Phase total:        ~[N]K
```
These are estimates. Actual cost depends on your AI tool's token counter.

---

## Step 6: Recommended Next Action

| Situation | Next command |
|-----------|-------------|
| No spec | `/buildflow-spec` |
| Spec draft, not locked | `/buildflow-spec` (continue review) |
| Spec locked, no plan | `/buildflow-plan` |
| Plan ready, not built | `/buildflow-build` |
| Build in progress | `/buildflow-build wave-[N]` (continue) |
| All waves done, not checked | `/buildflow-check` |
| Check passed | `/buildflow-ship` |
| Shipped, no next spec | `/buildflow-help next` — discover what to build |
| Debt > 4 items | `/buildflow-think --debt` before next feature |
| Tests failing | `/buildflow-debug` |
| Coverage dropping | `/buildflow-test` + fix uncovered functions |

---

## Token Budget: ~5K (--short: ~1K)
