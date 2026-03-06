-- Simple check to see what's in conversation_overview
-- Run this first to understand the structure

-- 1. Show columns in conversation_overview
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- 2. Count records
SELECT COUNT(*) as total_records FROM conversation_overview;

-- 3. Show sample data
SELECT * FROM conversation_overview LIMIT 5;

-- 4. Check if 'conversations' table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 5. Count in conversations (if exists)
SELECT COUNT(*) as total_records FROM conversations;
