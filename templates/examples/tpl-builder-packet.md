# Builder Task Packet

```
Task:           [name]
Goal:           [one sentence — what this task makes true]
AC refs:        [AC-001, AC-003]
Before:         [what currently exists]
After:          [what must be true when done]

Files allowed:  [explicit list — max 5]
Files forbidden:[all other ownership-map files this wave]
Closest example:[path/to/similar.ts — follow this structure]
Key pattern:    [convention from PATTERNS.md]
Approach:       [from wave file — follow exactly unless blocker]
Ext. deps:      [env vars, services from DEPENDENCIES.md — or NONE]
Tests:          [test file(s) to write + focused test command]
Known risks:    [hotspot files from RISKS.md — or NONE]
Locale impact:  [intel.json locale_support if i18n involved — else OMIT]
Done when:      [linked ACs that must pass]
Serialized after:[task name, or "none — runs in parallel"]
```
