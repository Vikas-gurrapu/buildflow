---
name: buildflow-ui-spec
description: Generate a UI design contract — color system, typography, spacing, components, and responsive rules — before building frontend phases
allowed-tools: Read, Write, WebSearch
agent: strategist
---

# /buildflow-ui-spec

Generates `.buildflow/epics/[epic]/UI-SPEC.md` — a locked design contract that Builder agents follow when writing UI code. Run before any frontend phase to prevent design inconsistency across waves.

## Usage
- `/buildflow-ui-spec` — interactive: prompts for design system, palette, and component inventory
- `/buildflow-ui-spec --existing` — detect the design system already in use and document it
- `/buildflow-ui-spec --review` — compare current UI code against UI-SPEC.md (quick audit)
- `/buildflow-ui-spec --amend` — update UI-SPEC.md after a deliberate design change

## Context Packet
- `.buildflow/VISION.md`
- `.buildflow/MEMORY.md`
- `.buildflow/epics/[epic]/SPEC.md` (if exists)
- `.buildflow/codebase/CODEBASE.md` (if exists — detect CSS framework)
- `package.json` (detect: Tailwind, MUI, Chakra, Radix, shadcn, etc.)

---

## Phase State Resume

Read `.buildflow/STATE.md`. If `UI-SPEC.md` already exists and is locked:
- Show the current spec version and ask: "Amend or replace?"
- If amending: go to `--amend` mode.
- If replacing: confirm before overwriting.

---

## Step 1: Detect Design System

Check `package.json` (and `tailwind.config.*`, `theme.ts`, `tokens.*`) for an existing design system.

Print detection result:
```
Design System Detection
────────────────────────
CSS framework: [Tailwind CSS v3 / MUI v5 / Chakra UI / Vanilla CSS / None detected]
Component lib: [shadcn/ui / Radix / Headless UI / None]
Token file:    [tailwind.config.ts / tokens.css / Not found]
```

- **If a known framework is detected:** pre-fill the spec with its conventions. Ask the user to confirm or override.
- **If nothing detected:** present a short menu:
  ```
  No CSS framework detected. Choose:
  [T] Tailwind CSS    [M] Material UI    [C] Chakra UI
  [V] Vanilla CSS     [O] Other (describe)
  ```

---

## Step 2: Color System

```
Color System
────────────────────────────────────────────────────
Primary color:    [hex or token — e.g., #3B82F6 / blue-500]
Secondary color:  [hex or token]
Background:       [hex or token]
Surface:          [hex or token — cards, modals]
Border:           [hex or token]
Text primary:     [hex or token]
Text muted:       [hex or token]
Error:            [hex or token — e.g., #EF4444 / red-500]
Warning:          [hex or token]
Success:          [hex or token]

Dark mode:        [yes / no / planned]
```

If Tailwind detected: map to Tailwind color tokens (e.g., `text-gray-900`, `bg-blue-500`).
If MUI: map to MUI theme keys (`primary.main`, `background.default`).

---

## Step 3: Typography

```
Typography
────────────────────────────────────────────────────
Font family:      [e.g., Inter, Geist, system-ui]
Font source:      [Google Fonts / local / system]
Scale (px):
  h1: [size / weight / line-height]
  h2: [size / weight / line-height]
  h3: [size / weight / line-height]
  body: [size / weight / line-height]
  small: [size / weight / line-height]
  label: [size / weight / line-height]
  mono: [font / size — for code, prices, IDs]
```

---

## Step 4: Spacing Scale

```
Spacing Scale
────────────────────────────────────────────────────
Base unit:   [4px / 8px — Tailwind uses 4px]
Scale:       [1 = 4px, 2 = 8px, 4 = 16px, 6 = 24px, 8 = 32px, ...]
Page margin: [e.g., px-4 mobile / px-8 desktop]
Section gap: [e.g., py-16 between sections]
Card padding:[e.g., p-6]
```

---

## Step 5: Responsive Breakpoints

```
Breakpoints
────────────────────────────────────────────────────
Mobile:   < [640px / sm]
Tablet:   [640–1024px / sm–lg]
Desktop:  > [1024px / lg]
Wide:     > [1280px / xl]

Mobile-first: [yes / no]
Primary target: [mobile / desktop / both equally]
```

---

## Step 6: Component Inventory

List every UI component needed for this phase (from SPEC.md requirements section or the user's description):

```
Component Inventory
────────────────────────────────────────────────────
[Component name]      [type: atom/molecule/organism]   [variants: list]
────────────────────────────────────────────────────
Button                atom                              primary, secondary, ghost, destructive, icon
Input                 atom                              text, password, search, number
Modal                 molecule                          default, confirm, form
Card                  atom                              default, hover, selected
Table                 organism                          default, sortable, paginated
Navbar                organism                          desktop, mobile
```

For each component, define:
- **States**: default, hover, focus, disabled, loading, error
- **AC traceability**: which acceptance criteria drive this component (from ACCEPTANCE.md)

---

## Step 7: Interaction & Accessibility Rules

```
Interaction Rules
────────────────────────────────────────────────────
Focus ring:       [2px blue / system default]
Transition speed: [150ms / 200ms ease-out]
Animation:        [subtle / none / rich]

Accessibility (WCAG 2.1 AA minimum)
────────────────────────────────────────────────────
Color contrast:   4.5:1 body / 3:1 UI components
Keyboard nav:     [required for: buttons, forms, modals, dropdowns]
Screen reader:    [aria-labels required for icon-only buttons]
Focus trapping:   [required in modals]
```

---

## Step 8: Write UI-SPEC.md

Use the **Write tool** to create `.buildflow/epics/[epic]/UI-SPEC.md`:

```markdown
---
version: 1
locked: true
locked_at: [ISO datetime]
framework: [CSS framework]
---

# UI Design Contract

> Builders must follow this spec when writing UI code for this project.
> Do not introduce colors, fonts, spacing, or components not listed here.
> To change: run `/buildflow-ui-spec --amend` — do not edit this file directly.

## Color System
[content from Step 2]

## Typography
[content from Step 3]

## Spacing Scale
[content from Step 4]

## Breakpoints
[content from Step 5]

## Component Inventory
[content from Step 6]

## Interaction & Accessibility Rules
[content from Step 7]
```

Update `STATE.md`:
- Status: `ui_spec_locked`
- Files That Matter: `.buildflow/epics/[epic]/UI-SPEC.md`
- Next Command: `/buildflow-spec` (or `/buildflow-build` if plan exists)

---

## Guided Next Step

```
──────────────────────────────────────────────────
→ Next:  /buildflow-spec
   Why:  UI design contract locked — Builder agents will follow it automatically
   Context: Saved to .buildflow/epics/[epic]/STATE.md. Recommended: run /clear, then run the next command.
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

## Token Budget: ~12K

