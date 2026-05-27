---
name: buildflow-ui-review
description: Retroactive UI audit — scores implementation against the UI design contract across 6 quality dimensions
allowed-tools: Read, Write, Bash, Glob
agent: strategist
---

# /buildflow-ui-review

Audits the current UI implementation against `.buildflow/specs/UI-SPEC.md`. Produces a scored report across 6 dimensions with PASS / WARN / FAIL verdicts and a prioritized fix list.

Run after building a frontend phase, or any time UI consistency is in question.

## Usage
- `/buildflow-ui-review` — full audit against UI-SPEC.md
- `/buildflow-ui-review --quick` — color + component names only (fast, ~5K tokens)
- `/buildflow-ui-review --component <name>` — audit a single component
- `/buildflow-ui-review --fix` — generate a prioritized fix list after auditing

## Context Packet
- `.buildflow/specs/UI-SPEC.md` (required — must exist)
- `.buildflow/memory/light.md` (framework, language)
- UI source files — Glob `src/**/*.{tsx,jsx,vue,svelte,html,css,scss}` (limit to 30 most recently modified)

If `UI-SPEC.md` does not exist:
```
⚠ No UI design contract found.
Run /buildflow-ui-spec first to generate one, then re-run /buildflow-ui-review.
```

---

## Step 1: Load Design Contract

Read `UI-SPEC.md`. Extract:
- Color tokens / hex values
- Typography scale (font families, sizes, weights)
- Spacing scale and base unit
- Component inventory and their variants
- Accessibility rules (contrast, focus, keyboard nav)

---

## Step 2: Sample UI Source Files

Glob UI source files. Take the 30 most recently modified. For each file, scan for:
- Hardcoded hex colors (e.g., `#3B82F6`, `color: red`)
- Hardcoded pixel sizes outside the spacing scale
- Font families not in the spec
- Component names not in the inventory
- Missing aria-labels on icon-only interactive elements
- Inline styles that override the design system

---

## Step 3: Score 6 Dimensions

For each dimension: count violations found, rate PASS / WARN / FAIL, and list evidence.

### Dimension 1 — Color Consistency

```
Color Consistency
─────────────────────────────────────────────────────
Check: Are all colors from the spec's color system?
       No hardcoded hex outside the token system?

PASS  — all colors traced to spec tokens
WARN  — 1–3 hardcoded colors found (minor drift)
FAIL  — 4+ hardcoded colors, or a brand color missing from spec

Violations:
  src/components/Button.tsx:12  — color: #FF0000 (not in spec)
  src/pages/Home.tsx:45         — bg-[#1A1A2E] (hardcoded, not a token)
```

### Dimension 2 — Typography Consistency

```
Typography Consistency
─────────────────────────────────────────────────────
Check: Font families match spec? Font sizes from the scale?
       No ad-hoc font-size values?

PASS / WARN / FAIL  [same scoring as above]

Violations:
  [file:line — description]
```

### Dimension 3 — Spacing Consistency

```
Spacing Consistency
─────────────────────────────────────────────────────
Check: Padding/margin values from the spacing scale?
       No arbitrary pixel values outside the scale?

PASS / WARN / FAIL

Violations:
  [file:line — description]
```

### Dimension 4 — Component Coverage

```
Component Coverage
─────────────────────────────────────────────────────
Check: Every component in the spec implemented?
       No implemented components missing from the spec?

Spec components:    [N]
Implemented:        [N] ([list])
Missing:            [N] ([list] — not yet built or not found)
Undocumented:       [N] ([list] — in code but not in UI-SPEC.md)

PASS  — all spec components implemented, no undocumented ones
WARN  — missing components (not yet built), or minor undocumented additions
FAIL  — significant undocumented component patterns diverging from spec
```

### Dimension 5 — Responsive Behavior

```
Responsive Behavior
─────────────────────────────────────────────────────
Check: Breakpoints from spec used consistently?
       Mobile-first (or desktop-first) rule followed?

Scan for: hardcoded media queries that bypass the spec breakpoints,
          inconsistent breakpoint names (sm/md vs 768px/1024px mixed)

PASS / WARN / FAIL

Violations:
  [file:line — description]
```

### Dimension 6 — Accessibility

```
Accessibility
─────────────────────────────────────────────────────
Check: Icon-only buttons have aria-label?
       Form inputs have associated labels?
       Focus states defined (not just :focus-visible missing)?
       Color contrast — flag any text-on-background combos that look risky

PASS  — no violations found
WARN  — minor issues (e.g., 1–2 missing aria-labels)
FAIL  — systemic gaps (e.g., no focus states, unlabeled form inputs)

Violations:
  [file:line — description]
```

---

## Step 4: Overall Score

```
UI Review — [App Name]  Phase [N]
──────────────────────────────────────────────────────────
Dimension               Result   Violations   Severity
──────────────────────────────────────────────────────────
Color consistency       PASS     0            —
Typography              WARN     2            minor drift
Spacing                 WARN     4            minor drift
Component coverage      PASS     0            —
Responsive behavior     FAIL     3            breakpoint mismatch
Accessibility           WARN     2            missing aria-labels
──────────────────────────────────────────────────────────
Overall: WARN  (1 FAIL, 3 WARN, 2 PASS)
──────────────────────────────────────────────────────────
```

Overall verdict:
- **PASS** — all 6 dimensions pass
- **WARN** — 1+ WARN, no FAIL
- **FAIL** — any FAIL dimension

---

## Step 5: Fix List (always generated, highlighted when `--fix` flag used)

```
Prioritized Fix List
──────────────────────────────────────────────────────────
HIGH (blocking clean ship):
  1. [file:line] Replace hardcoded breakpoint 768px → sm: prefix  (Responsive, FAIL)

MEDIUM (should fix before ship):
  2. [file:line] Add aria-label to icon button in Navbar.tsx
  3. [file:line] Replace font-size: 14px → text-sm per spec

LOW (cleanup, non-blocking):
  4. [file:line] Spacing: p-[18px] → p-4 (closest scale value)
  5. [file:line] Typography: font-family: Georgia → font-sans per spec
──────────────────────────────────────────────────────────
Total: [N] issues  ([N] high, [N] medium, [N] low)
```

Use the **Write tool** to save the report to `.buildflow/security/reports/ui-review-phase-[N]-[date].md`.

---

## Step 6: Update STATE.md

Update `.buildflow/phases/[N]/STATE.md`:
- Status: `ui_review_complete` (or `ui_review_failed` if overall FAIL)
- Risks: list any HIGH severity violations
- Next Command: `/buildflow-ship` (if PASS/WARN) or `/buildflow-build` (if FAIL — fix first)

---

## Guided Next Step

If PASS or WARN:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-ship
   Why:  UI review complete — [N] minor issues logged, none blocking
   Context: Report saved to .buildflow/security/reports/. OK to continue without clearing.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

If FAIL:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-modify "Fix UI-SPEC violations from ui-review report"
   Why:  [N] FAIL-level UI violations must be resolved before ship
   Or:   /buildflow-ui-spec --amend  — if the spec itself needs updating
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

## Token Budget: ~15K (--quick) / ~25K (full audit)
