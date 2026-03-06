-- ============================================================
-- FIX: Conversation Display Issue
-- ============================================================
-- This script assumes conversation_overview has the data and 
-- conversations table either doesn't exist or is out of sync.
-- 
-- SCENARIO 1: conversation_overview is a table and conversations is missing/empty
-- FIX: Rename conversation_overview to conversations
-- ============================================================

-- First, let's check what we have:
DO $$
DECLARE
  conv_exists boolean;
  overview_exists boolean;
  conv_count int;
  overview_count int;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) INTO conv_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'conversation_overview'
  ) INTO overview_exists;

  RAISE NOTICE 'conversations table exists: %', conv_exists;
  RAISE NOTICE 'conversation_overview exists: %', overview_exists;

  -- Count records if they exist
  IF conv_exists THEN
    EXECUTE 'SELECT COUNT(*) FROM conversations' INTO conv_count;
    RAISE NOTICE 'conversations has % records', conv_count;
  END IF;

  IF overview_exists THEN
    EXECUTE 'SELECT COUNT(*) FROM conversation_overview' INTO overview_count;
    RAISE NOTICE 'conversation_overview has % records', overview_count;
  END IF;

END $$;

-- ============================================================
-- OPTION A: If conversation_overview is a table with data,
-- and conversations is empty or doesn't exist
-- ============================================================

-- Uncomment the following if you want to rename conversation_overview to conversations:

-- -- Drop conversations if it exists and is empty
-- DROP TABLE IF EXISTS conversations CASCADE;

-- -- Rename conversation_overview to conversations  
-- ALTER TABLE conversation_overview RENAME TO conversations;

-- RAISE NOTICE 'Renamed conversation_overview to conversations';

-- ============================================================
-- OPTION B: If conversation_overview is a VIEW and conversations 
-- has the data, just ensure the view is correct
-- ============================================================

-- Create or replace the view
CREATE OR REPLACE VIEW conversation_overview AS
SELECT 
  id,
  site_id,
  visitor_id,
  current_page_url,
  summary,
  message_count,
  lead_score,
  lead_rating,
  created_at,
  updated_at
FROM conversations;

-- ============================================================
-- OPTION C: If conversations has some data but conversation_overview
-- has MORE data, copy missing records
-- ============================================================

-- Uncomment this to copy records from conversation_overview to conversations:

-- INSERT INTO conversations (id, site_id, visitor_id, current_page_url, summary, message_count, lead_score, lead_rating, created_at, updated_at)
-- SELECT id, site_id, visitor_id, current_page_url, summary, message_count, lead_score, lead_rating, created_at, updated_at
-- FROM conversation_overview co
-- WHERE NOT EXISTS (
--   SELECT 1 FROM conversations c WHERE c.id = co.id
-- );
