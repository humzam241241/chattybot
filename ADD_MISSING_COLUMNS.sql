-- ============================================================
-- CRITICAL FIX: Add missing essential columns to conversations
-- ============================================================

-- First, let's see what the actual primary key is
SELECT 
  constraint_name,
  column_name
FROM information_schema.key_column_usage
WHERE table_name = 'conversations';

-- Check if there's a hidden id column or uuid column
SELECT * FROM conversations LIMIT 1;

-- Add missing columns
-- Note: We need to be careful about the primary key

-- Add site_id if it doesn't exist
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;

-- Add lead_score and lead_rating
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10) DEFAULT NULL;

-- Verify what we have now
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;
