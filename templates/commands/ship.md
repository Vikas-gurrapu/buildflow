---
name: buildflow-ship
description: Finalize phase with mandatory pre-ship security gate
allowed-tools: Read, Write, Bash
agents: strategist, security-auditor
---

# /buildflow-ship

Finalize current phase. Security gate runs automatically before shipping.

## MANDATORY Step 0: Pre-Ship Security Gate

Spawn Security Auditor in `--pre-ship` mode:
- Scan only changed files (git diff since last commit)
- Check for secrets
- Check critical injection patterns
- Check auth bypass risks
- Check critical dependency CVEs
- Token cost: ~10K

### Gate Outcomes

**Critical found → BLOCK:**
```
🔴 SHIP BLOCKED — Critical Security Issues

Fix these before shipping:
[C1] [Issue] at [file:line]
     Fix: [specific action]

Run /buildflow-modify for surgical fixes.
Override (not recommended): /buildflow-ship --force
```

**High found → WARN:**
```
⚠️  Security Warnings (non-blocking)
[H1] [Issue]
     Risk: [...]
     Fix later: /buildflow-audit for details
```

**Clean → proceed:**
```
✅ Security gate passed. No critical issues.
```

## Step 1: Pre-Ship Checklist
- [ ] All acceptance criteria met
- [ ] /buildflow-check passed
- [ ] Tests pass
- [ ] Security gate passed (above)

## Step 2: Retrospective
Ask:
1. What worked well this phase?
2. What was harder than expected?
3. What did you learn?
4. Confidence in deliverables (1-5)?

Save to `.buildflow/phases/[N]/retro.md`

## Step 3: Update Docs
- README if needed
- vision.md if pivots occurred
- state.md: Phase X → Shipped

## Step 4: Update Codebase Map (existing projects)
If patterns changed, new hotspots added, or dependencies updated:
- Update PATTERNS.md
- Update HOTSPOTS.md
- Update DEPENDENCIES.md

## Step 5: Tag Release
```bash
git add .
git commit -m "buildflow: phase X shipped"
git tag "buildflow-phase-X-complete"
```

## Step 6: Update Memory
```yaml
last_ship_date: [today]
phase: X
security_gate: passed|passed-with-warnings|overridden
```

## Step 7: Next Phase
Suggest next phase based on roadmap.

## --force Override
If used, adds to `.buildflow/security/DEBT.md` and requires:
- Typed confirmation: "I understand the risk"
- Logged with timestamp

## Token Budget: ~22K (including pre-ship audit)
