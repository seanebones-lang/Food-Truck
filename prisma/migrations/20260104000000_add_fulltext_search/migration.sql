-- Migration: Add Full-Text Search Index for Menu Items
-- Date: 2026-01-04
-- Purpose: Enable efficient full-text search on menu item names and descriptions

-- Create GIN index for full-text search on menu items
-- This index enables fast text search using PostgreSQL's built-in full-text search capabilities
CREATE INDEX IF NOT EXISTS idx_menu_items_search ON menu_items 
USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Add comment explaining the index
COMMENT ON INDEX idx_menu_items_search IS 'Full-text search index for menu item names and descriptions using PostgreSQL tsvector';
