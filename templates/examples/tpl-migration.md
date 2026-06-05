# Migration: [name]
**Generated:** [today]  **ORM/System:** [prisma / sequelize / django / flyway / etc.]

## Schema Changes
| Entity | Change | Type |
|--------|--------|------|
| [table/model] | [field added/removed/modified] | ADD / DROP / ALTER |

## Migration File
```sql
-- Migration: [name]
-- Generated: [today]
-- Reversible: YES / NO

-- Up
[migration SQL or ORM commands]

-- Down (rollback)
[rollback SQL or ORM commands]
```

## Destructive Operations
- [DROP / data loss operation] — **requires manual backup before apply**

## Rollback Plan
1. [step] — [command]
2. Verify: [check command]

## Backward Compatibility
- [breaking change] — affects: [consumers]
- [safe change] — no consumer impact
