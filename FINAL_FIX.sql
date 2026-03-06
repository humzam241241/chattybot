-- ============================================================
-- COMPREHENSIVE FIX: Conversation Display Issue
-- ============================================================
-- This will check your schema and provide the appropriate fix
-- ============================================================

-- Step 1: Check what tables/views exist
DO $$ 
DECLARE
    conv_exists boolean;
    overview_exists boolean;
    conv_is_table boolean;
    overview_is_table boolean;
BEGIN
    -- Check conversations
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'conversations'
    ) INTO conv_exists;
    
    IF conv_exists THEN
        SELECT table_type = 'BASE TABLE'
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'conversations'
        INTO conv_is_table;
        
        RAISE NOTICE 'conversations EXISTS (type: %)', 
            CASE WHEN conv_is_table THEN 'TABLE' ELSE 'VIEW' END;
    ELSE
        RAISE NOTICE 'conversations DOES NOT EXIST';
    END IF;
    
    -- Check conversation_overview
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'conversation_overview'
    ) INTO overview_exists;
    
    IF overview_exists THEN
        SELECT table_type = 'BASE TABLE'
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'conversation_overview'
        INTO overview_is_table;
        
        RAISE NOTICE 'conversation_overview EXISTS (type: %)', 
            CASE WHEN overview_is_table THEN 'TABLE' ELSE 'VIEW' END;
    ELSE
        RAISE NOTICE 'conversation_overview DOES NOT EXIST';
    END IF;
END $$;

-- ============================================================
-- RECOMMENDED FIX: Rename conversation_overview to conversations
-- ============================================================
-- Since your backend queries 'conversations' but your data is in 
-- 'conversation_overview', we'll rename it and add missing columns
-- ============================================================

-- First, drop conversations if it exists (backup first if needed!)
DROP TABLE IF EXISTS conversations CASCADE;

-- Rename conversation_overview to conversations
ALTER TABLE conversation_overview RENAME TO conversations;

-- Now add the missing columns that the backend expects
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS conversations_site_id_idx ON conversations(site_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_rating ON conversations(lead_rating) WHERE lead_rating IS NOT NULL;

-- Verify the result
SELECT 'Verification - conversations table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Show sample data
SELECT 'Sample conversations (should show all 8 records):' as info;
SELECT id, site_id, visitor_id, message_count, created_at, updated_at
FROM conversations
ORDER BY created_at DESC;

-- Count total
SELECT 'Total conversations:' as info, COUNT(*) as total FROM conversations;
