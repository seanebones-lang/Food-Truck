-- Add performance indexes for query optimization
-- Created: January 2026
-- Purpose: Improve query performance for common access patterns

-- Menu Items: Composite index for available items with stock
CREATE INDEX IF NOT EXISTS "idx_menu_available_stock" ON "menu_items"("is_available", "stock");

-- Menu Items: Index on price for price range queries
CREATE INDEX IF NOT EXISTS "idx_menu_price" ON "menu_items"("price");

-- Orders: Index on payment status (used in analytics)
CREATE INDEX IF NOT EXISTS "idx_orders_payment_status" ON "orders"("payment_status");

-- Orders: Composite index for filtered queries
CREATE INDEX IF NOT EXISTS "idx_orders_status_payment" ON "orders"("status", "payment_status");

-- Order Items: Index on menu item ID (for analytics top selling items)
CREATE INDEX IF NOT EXISTS "idx_order_items_menu_item" ON "order_items"("menu_item_id");

-- Trucks: Index on last updated (for sorting)
CREATE INDEX IF NOT EXISTS "idx_trucks_last_updated" ON "trucks"("last_updated");

-- Note: Full-text search index for menu items would be created manually:
-- CREATE INDEX idx_menu_search ON menu_items USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
-- This requires PostgreSQL full-text search support and is optional.
