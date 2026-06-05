---
spec_version: 1
phase: [N]
status: DRAFT
created: [today]
last_revised: [today]
approved_by: null
approved_at: null
changelog:
  - version: 1
    date: [today]
    author: buildflow-spec
    summary: "Initial spec generated"
---

# Acceptance Criteria
**App:** [name]  **Phase:** [N]  **Date:** [today]

## [Feature F-01: name]  →  US-01, US-02
**Happy path:**
- AC-001: Given [setup state], when [user/system action], then [exact observable outcome]

**Failure / edge cases (minimum 1 per feature):**
- AC-002: Given [invalid/boundary input], when [...], then [specific error behavior]

## [Feature F-02: name]  →  US-03
- AC-003: Given [...], when [...], then [...]

## Non-Functional
- AC-NF-001: [endpoint] under [N] concurrent users responds within [Nms] (p95)
- AC-NF-002: [page/flow] achieves WCAG 2.1 AA with zero automated violations
- AC-NF-003: No secrets present in committed code (automated scan passes)
