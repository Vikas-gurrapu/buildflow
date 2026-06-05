# Workspace Format Templates

## WORKSPACE.md
```
# Workspace Map
**Type:** [monorepo / polyrepo]  **Repos:** [N]  **Mapped:** [date]

## Repos
| Name | Path | Tech | Onboarded | Entry |
|------|------|------|-----------|-------|
| [name] | [path] | [tech] | YES / NO | [entry] |

## Cross-Repo Hotspots
| Package | Fan-in | Risk |
|---------|--------|------|
| [pkg] | [N] | HIGH / MED / LOW |

## Dependency Graph
[repo-a] → [repo-b] → [repo-c]
```

## XPLAN.md (cross-repo epic summary)
```
# Cross-Repo Epic: [Feature Name]
**Slug:** [1-slug]  **Status:** [spec_ready / build_in_progress / shipped]
**Repos:** [repo-a] → [repo-b]

## Feature Summary
[2–3 sentences]

## Cross-Repo Contract
POST /[path]
  Request:  [shape]
  Response: { [field]: [type] }
  Defined in: [repo]  Consumed by: [repo]

## Per-Repo Scope
### [repo-a]
- [2–4 bullets]  AC count: [N]

## AC Summary
| Repo | Total | Pass | Fail | Unverified |
|------|-------|------|------|------------|
| [repo] | N | - | - | N |
```

## STATUS.md (quick-glance)
```
# Cross-Repo Status: [Feature]
**Last updated:** [ISO datetime]

| Repo | Phase | Wave | ACs | Status |
|------|-------|------|-----|--------|
| [repo] | built | 3/3 | 8/8 PASS | ✓ |
```
