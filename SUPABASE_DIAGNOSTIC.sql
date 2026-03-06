-- ============================================================
-- CONVERSATION DIAGNOSTIC QUERY
-- Run this in Supabase SQL Editor to diagnose the issue
-- ============================================================

-- 1. Check if both tables/views exist
SELECT 
  'TABLE/VIEW EXISTS' as check_type,
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('conversations', 'conversation_overview')
ORDER BY table_name;

-- 2. Count records in each
SELECT 'conversations' as source, COUNT(*) as total FROM conversations
UNION ALL
SELECT 'conversation_overview' as source, COUNT(*) as total FROM conversation_overview;

-- 3. Show structure comparison
SELECT 'conversations_structure' as info, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

SELECT 'conversation_overview_structure' as info, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- 4. Check for data mismatch - show IDs in conversation_overview but not in conversations
SELECT 'orphaned_in_overview' as issue, co.id, co.visitor_id, co.message_count
FROM conversation_overview co
LEFT JOIN conversations c ON c.id = co.id
WHERE c.id IS NULL
LIMIT 10;

-- 5. Check for data mismatch - show IDs in conversations but not in conversation_overview  
SELECT 'missing_from_overview' as issue, c.id, c.visitor_id, c.message_count
FROM conversations c
LEFT JOIN conversation_overview co ON co.id = c.id
WHERE co.id IS NULL
LIMIT 10;

-- 6. Show latest 10 from conversation_overview with all fields
SELECT 'conversation_overview_sample' as source, *
FROM conversation_overview
ORDER BY created_at DESC NULLS LAST
LIMIT 10;

-- 7. Show latest 10 from conversations with all fields (if it exists)
SELECT 'conversations_sample' as source, *
FROM conversations
ORDER BY created_at DESC NULLS LAST
LIMIT 10;

-- 8. If conversation_overview is a VIEW, show its definition
SELECT 'view_definition' as info, definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'conversation_overview';
