# Database Migration Guide
**For Optimistic Locking Feature (Iteration 1)**

---

## Overview

This guide explains how to apply the database migration that adds optimistic locking support to prevent race conditions in order creation.

---

## Migration Details

### What This Migration Does

1. **Adds `version` field** to `menu_items` table for optimistic locking
2. **Adds check constraint** to ensure stock never goes negative
3. **Creates index** on version field for performance

### Why This Migration Is Needed

The optimistic locking feature prevents race conditions where multiple concurrent orders could oversell items (stock going negative). This is a critical data integrity feature.

---

## Migration Methods

### Method 1: Using Prisma Migrate (Recommended)

```bash
# Generate migration from schema changes
yarn db:migrate dev --name add_optimistic_locking

# Or apply existing migration
yarn db:migrate deploy
```

### Method 2: Manual SQL Execution

If you prefer to run the SQL directly:

```bash
# Connect to your PostgreSQL database
psql -U your_user -d foodtruck

# Run the migration SQL
\i prisma/migrations/20260101000000_add_optimistic_locking/migration.sql
```

### Method 3: Using Prisma Studio

1. Open Prisma Studio: `yarn db:studio`
2. Manually add the `version` column to `menu_items` table
3. Set default value to 0 for all existing records

---

## Verification

After running the migration, verify it worked:

```sql
-- Check if version column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'menu_items' AND column_name = 'version';

-- Check if constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'menu_items' AND constraint_name = 'check_stock_non_negative';

-- Verify existing records have version = 0
SELECT COUNT(*) FROM menu_items WHERE version = 0;
```

---

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove constraint
ALTER TABLE "menu_items" DROP CONSTRAINT IF EXISTS "check_stock_non_negative";

-- Remove index
DROP INDEX IF EXISTS "idx_menu_items_version";

-- Remove version column
ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "version";
```

---

## Important Notes

1. **No Data Loss:** This migration is safe and doesn't modify existing data
2. **Backward Compatible:** Existing code will work (version defaults to 0)
3. **Performance:** The index on version improves query performance
4. **Data Integrity:** The check constraint prevents invalid stock values

---

## Testing

After migration, test order creation:

```bash
# Run tests
yarn test

# Specifically test order creation
yarn test orders.test.js
```

---

## Production Deployment

When deploying to production:

1. **Backup database first**
2. Run migration during maintenance window (if possible)
3. Verify migration succeeded
4. Test order creation
5. Monitor for any issues

---

**Migration Status:** ✅ Ready to Apply  
**Risk Level:** Low (additive changes only)  
**Downtime Required:** None
