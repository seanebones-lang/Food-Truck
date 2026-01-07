-- Add optimistic locking version field to menu_items table
-- This migration adds the version field for preventing race conditions in order creation

-- Add version column
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- Add check constraint to ensure stock never goes negative
-- Note: This constraint may already exist, so we use IF NOT EXISTS pattern
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_stock_non_negative'
    ) THEN
        ALTER TABLE "menu_items" 
        ADD CONSTRAINT "check_stock_non_negative" 
        CHECK (stock >= 0);
    END IF;
END $$;

-- Create index on version for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS "idx_menu_items_version" ON "menu_items"("version");

-- Update existing records to have version 0 (already default, but explicit)
UPDATE "menu_items" SET "version" = 0 WHERE "version" IS NULL;
