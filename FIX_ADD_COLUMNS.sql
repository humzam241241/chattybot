-- ============================================================
-- FIX: Add missing columns to conversation_overview
-- ============================================================
-- Based on error: conversation_overview is missing updated_at 
-- and likely other columns that the backend expects
-- ============================================================

-- Check current structure
SELECT 'Current conversation_overview columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
ALTER TABLE conversation_overview 
  ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Verify the fix
SELECT 'Updated conversation_overview columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM conversation_overview LIMIT 5;
