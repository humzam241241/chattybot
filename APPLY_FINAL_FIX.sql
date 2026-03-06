-- ============================================================
-- FINAL FIX: Add lead_score and lead_rating columns
-- Then redeploy your backend on Render
-- ============================================================

-- Add the missing lead scoring columns
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10) DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversations_lead_rating 
  ON conversations(lead_rating) 
  WHERE lead_rating IS NOT NULL;

-- Verify the columns were added
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'lead_score') THEN '✓ lead_score EXISTS' ELSE '✗ lead_score MISSING' END as lead_score_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'lead_rating') THEN '✓ lead_rating EXISTS' ELSE '✗ lead_rating MISSING' END as lead_rating_status;

-- Show updated structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Test the query your backend uses
-- Note: Replace the site_id below with your actual site_id from the conversations table
SELECT 
  id, 
  visitor_id, 
  current_page_url, 
  summary, 
  message_count, 
  lead_score, 
  lead_rating, 
  created_at, 
  updated_at
FROM conversations
ORDER BY updated_at DESC
LIMIT 200;
