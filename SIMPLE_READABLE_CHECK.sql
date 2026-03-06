-- ============================================================
-- SIMPLE & READABLE SCHEMA CHECK
-- ============================================================

-- Query 1: What columns does CONVERSATIONS table have?
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Query 2: What columns does CONVERSATION_OVERVIEW have?
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'conversation_overview'
ORDER BY ordinal_position;

-- Query 3: How many records in each?
SELECT 'conversations' as table_name, COUNT(*) FROM conversations
UNION ALL
SELECT 'conversation_overview', COUNT(*) FROM conversation_overview;

-- Query 4: Is conversation_overview a VIEW or TABLE?
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('conversations', 'conversation_overview')
ORDER BY table_name;

-- Query 5: Show me 3 conversations
SELECT 
  id,
  site_id,
  visitor_id,
  message_count
FROM conversations
LIMIT 3;

-- Query 6: Show me 3 conversation_overview records  
SELECT 
  id,
  site_id,
  visitor_id,
  message_count
FROM conversation_overview
LIMIT 3;
