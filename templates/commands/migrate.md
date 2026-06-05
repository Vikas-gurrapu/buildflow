---
name: buildflow-migrate
description: Detect schema changes from spec, generate migration files, flag destructive operations, and produce a rollback plan
allowed-tools: Read, Write, Bash, Grep, Glob
agent: surgeon
---

# /buildflow-migrate

Database migration management. Compares the data model in your spec against the current schema, detects what changed, generates migration stubs for your ORM, flags destructive operations before they can cause data loss, and produces a rollback plan alongside every migration.

Run after `/buildflow-spec` when the data model changed, or before `/buildflow-deploy` to confirm migrations are ready.

## Usage
- `/buildflow-migrate` â€” detect changes and generate migration
- `/buildflow-migrate --check` â€” detect only, no file writes (safe to run anytime)
- `/buildflow-migrate --rollback` â€” generate rollback migration for the last applied migration
- `/buildflow-migrate --status` â€” show which migrations have been applied vs pending
- `/buildflow-migrate --safe` â€” add extra guards: transactions, existence checks, data backfills before NOT NULL constraints

## Context Packet
- `.buildflow/epics/[epic]/SPEC.md` â€” data model section (source of truth for intended schema)
- `.buildflow/epics/[epic]/ACCEPTANCE.md` â€” ACs that reference data/persistence
- `.buildflow/MEMORY.md` â€” ORM/database detected during onboard

---

## Step 1: Detect, Parse & Diff

Scan the project for schema definition files:

```bash
# Prisma
find . -name "schema.prisma" -not -path "*/node_modules/*"
# Drizzle
find . -name "drizzle.config.*" -not -path "*/node_modules/*"
# TypeORM
find . -name "*.entity.ts" -not -path "*/node_modules/*" | head -5
# Django
find . -name "models.py" -not -path "*/node_modules/*" | head -5
# Alembic
find . -name "alembic.ini" -not -path "*/node_modules/*"
# SQLAlchemy
find . -name "*.py" -path "*/models/*" | head -5
# Knex
find . -name "knexfile.*" -not -path "*/node_modules/*"
# Flyway / Liquibase
find . -name "flyway.conf" -o -name "liquibase.properties" | head -3
# Raw SQL migrations
find . -type d -name "migrations" | head -3
```

Determine:
- **ORM**: Prisma / Drizzle / TypeORM / SQLAlchemy+Alembic / Django / Knex / Raw SQL / None detected
- **Migration folder**: path to existing migrations directory
- **Last applied migration**: latest migration file timestamp or version

Print detection result:
```
Migration system detected
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ORM:             [name]
Schema file:     [path]
Migrations dir:  [path]
Last migration:  [filename or "none"]
Pending:         [N files not yet applied, or "none"]
```

If no ORM detected: ask user to specify or offer to generate raw SQL migrations.

---

### Parse Current Schema

Read the current schema definition file in full. Extract:
- All tables / models / entities with their fields and types
- All indexes and unique constraints
- All foreign keys and relations
- All enums
- Default values, nullable constraints

---

### Parse Spec Data Model

Read SPEC.md â€” specifically the Data Model section. Extract the intended schema:
- Tables/models the spec requires
- Fields, types, constraints the spec defines
- Relations and foreign keys
- Indexes the spec requires (for performance or uniqueness)

If SPEC.md has no explicit data model section: read ACs related to persistence and infer the minimum required schema.

---

## Step 4: Diff â€” Detect Changes

Compare spec model against current schema. Classify every change:

```
Schema Diff
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ADDED (new tables/fields):
  + Table: users.email_verified   BOOLEAN  DEFAULT false  NOT NULL
  + Table: sessions               (new table â€” 4 fields)
  + Index: users.email            UNIQUE

MODIFIED (type/constraint changes):
  ~ users.username  VARCHAR(50) â†’ VARCHAR(100)   SAFE (widening)
  ~ orders.status   added NOT NULL constraint     âš  DESTRUCTIVE if existing rows have NULL

REMOVED (dropped tables/fields):
  - Table: user_tokens            âš  DESTRUCTIVE â€” data loss
  - Column: users.legacy_id       âš  DESTRUCTIVE â€” data loss

RENAMED (detected by name similarity + type match):
  ? users.name â†’ users.display_name   likely rename â€” CONFIRM before generating
```

Severity classification:
- **SAFE**: additive changes (new table, new nullable column, widening types, new index)
- **CAUTION**: new NOT NULL column (requires default or backfill), type narrowing
- **DESTRUCTIVE**: DROP TABLE, DROP COLUMN, RENAME without data migration

---

## Step 5: Destructive Operation Guard

For every DESTRUCTIVE change, block and require explicit confirmation:

```
ðŸ”´ Destructive Operations Detected

[D1] DROP COLUMN users.legacy_id
     Impact: permanent data loss â€” this column's data cannot be recovered after migration runs
     Safe path: deprecate first (keep column, stop writing to it), drop in a future phase
     Override: add "--allow-destructive" flag if you have confirmed data is safe to drop

[D2] NOT NULL constraint on orders.total without DEFAULT
     Impact: migration will fail if any existing row has NULL in this column
     Safe path: use --safe flag to add: UPDATE orders SET total = 0 WHERE total IS NULL before adding constraint
```

Stop here if destructive ops are found and `--allow-destructive` was not passed. The user must explicitly confirm.

---

## Step 3: Generate Migration & Rollback

For each ORM, generate the appropriate migration:

**Prisma:**
```bash
npx prisma migrate dev --name [migration-name] --create-only
```
Then show what Prisma will generate, and add a pre-migration data script if `--safe` is set.

**Django:**
```bash
python manage.py makemigrations [app] --name [migration-name]
```
For `--safe`: also generate a `RunPython` data migration before the schema change.

**Alembic:**
```bash
alembic revision --autogenerate -m "[migration-name]"
```

**Drizzle:**
```bash
npx drizzle-kit generate --name [migration-name]
```

**TypeORM:**
```bash
npx typeorm migration:generate -n [migration-name]
```

**Knex:**
```bash
npx knex migrate:make [migration-name]
```
Then write the up() and down() functions based on the diff.

**Raw SQL:** Write `[timestamp]_[migration-name].up.sql` and `[timestamp]_[migration-name].down.sql`:

→ **Format:** Read `.buildflow/templates/tpl-migration.md` for the migration file structure.

---

### Rollback Plan

For every migration generated, write a rollback alongside it.

```markdown
# Rollback Plan â€” [migration-name]

## When to rollback
- Migration caused unexpected errors in staging/production
- Data validation revealed corrupted records after migration
- Dependent services are incompatible with the new schema

## Rollback steps

1. **Check if safe to rollback** â€” were any new records written using the new schema after migration?
   If yes: rollback may cause data loss for those records â€” assess before proceeding.

2. **Run rollback migration:**
   [ORM-specific rollback command]

3. **Verify:**
   [command to confirm schema is back to previous state]

## What cannot be rolled back automatically
[list any destructive ops that dropped data â€” must be restored from backup]
```

---

## Step 8: Backward Compatibility Check

Assess whether the new schema is safe for blue-green or rolling deploys:

```
Backward Compatibility
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
New nullable columns:        âœ“ SAFE (old app ignores them)
New tables:                  âœ“ SAFE (old app ignores them)
Removed columns:             âœ— UNSAFE â€” old app will crash if it tries to read [column]
Renamed columns:             âœ— UNSAFE â€” old app references old name
Type widening:               âœ“ SAFE
NOT NULL added (with default): âœ“ SAFE (old app can still insert without providing the field)

Deployment strategy:
  â†’ [SAFE for rolling deploy / REQUIRES maintenance window / REQUIRES feature-flag migration]
```

---

## Step 5: Write Output

Write migration summary to `.buildflow/epics/[epic]/MIGRATIONS.md`:

```markdown
# Migration â€” Phase [N]
**Generated:** [timestamp]
**ORM:** [name]
**Status:** PENDING

## Changes
[diff summary from Step 4]

## Files generated
- [migration file path]
- [rollback file path]

## Destructive operations
[list or NONE]

## Backward compatibility
[verdict from Step 8]

## To apply
[exact command]

## To rollback
[exact command]
```

Print summary to terminal and guided next step:
```
Migration generated âœ“
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
[N] changes detected  [N] files written
Destructive ops: [N â€” review above / NONE]
Backward compatible: [YES / NO â€” see above]

To apply:    [command]
To rollback: [command]
Next step:   /buildflow-deploy staging
```


