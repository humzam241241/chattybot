-- Run this in Supabase SQL Editor to diagnose the schema issue
-- This will show us what tables/views exist and their structures

-- 1. Check if both tables exist
SELECT 'conversations table' as check_type, 
       COUNT(*) as record_count 
FROM conversations;

SELECT 'conversation_overview table/view' as check_type, 
       COUNT(*) as record_count 
FROM conversation_overview;

-- 2. Show structure of conversations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 3. Show structure of conversation_overview
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- 4. Check if conversation_overview is a view
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
AND (table_name = 'conversations' OR table_name = 'conversation_overview');

-- 5. Show all records from conversation_overview
SELECT * FROM conversation_overview ORDER BY updated_at DESC LIMIT 10;

-- 6. Show all records from conversations (if exists)
SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 10;
