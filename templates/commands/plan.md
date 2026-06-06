---
name: buildflow-plan
max_context_kb: 10
description: Redirects to /buildflow-spec — wave planning is now part of the unified spec command
allowed-tools: Read
agent: strategist
---

# /buildflow-plan

> **This command has been merged into `/buildflow-spec`.**

`/buildflow-spec` now generates Requirements, Technical Design, Acceptance Criteria, and the full wave plan in one pass. There is no longer a separate planning step.

## What to run instead

```
/buildflow-spec
```

This will:
1. Generate and lock SPEC.md (requirements + technical design) and ACCEPTANCE.md
2. Auto-chain into wave planning: task derivation, dependency reasoning, effort estimation, wave grouping, file ownership map, AC coverage verification, engineering review
3. Write PLAN.md (index) + `waves/wave-[N].md` files + CHECK.md to `.buildflow/epics/[epic]/`
4. Guide you to `/buildflow-discuss` (optional) or `/buildflow-build`

## If you want to re-plan after a spec amendment

```
/buildflow-spec --update
```

This patches only the affected spec artifacts and wave tasks based on decisions locked in `/buildflow-discuss`.

## If your spec is already locked and plan is already ready

Check phase status:
```
/buildflow-status
```

Then proceed to:
```
/buildflow-build
```

