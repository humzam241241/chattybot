-- ============================================================
-- FIX: Add missing lead_score and lead_rating columns
-- ============================================================
-- These columns are referenced in migration 003 but may not 
-- have been applied to your database
-- ============================================================

-- Add the missing columns to conversations table
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10) DEFAULT NULL;

-- Create index for querying high-value leads
CREATE INDEX IF NOT EXISTS idx_conversations_lead_rating 
  ON conversations(lead_rating) 
  WHERE lead_rating IS NOT NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Show sample data (should now work without error)
SELECT 
  id,
  site_id,
  visitor_id,
  message_count,
  lead_score,
  lead_rating,
  created_at,
  updated_at
FROM conversations
ORDER BY created_at DESC
LIMIT 10;

-- Count total conversations
SELECT COUNT(*) as total_conversations FROM conversations;
