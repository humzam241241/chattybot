-- ============================================================
-- FINAL SCHEMA CHECK - This will work!
-- ============================================================

-- 1. List all your tables
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. CONVERSATIONS TABLE - Full structure
SELECT 
  'CONVERSATIONS TABLE' as table_info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 3. CONVERSATION_OVERVIEW - Check if it's a table or view and its structure
SELECT 
  'CONVERSATION_OVERVIEW' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- 4. Count records
SELECT 'conversations' as table_name, COUNT(*) as record_count FROM conversations
UNION ALL
SELECT 'conversation_overview', COUNT(*) FROM conversation_overview
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'sites', COUNT(*) FROM sites
UNION ALL
SELECT 'leads', COUNT(*) FROM leads;

-- 5. Show sample conversations data
SELECT * FROM conversations LIMIT 3;

-- 6. Show sample conversation_overview data
SELECT * FROM conversation_overview LIMIT 3;

-- 7. Check if conversation_overview is a VIEW (shows definition)
SELECT 
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'conversation_overview';
