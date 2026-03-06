-- ============================================================
-- REAL DIAGNOSTIC: Check what's actually in your database
-- ============================================================

-- 1. Check which tables actually exist
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name LIKE '%conversation%'
ORDER BY table_name;

-- 2. Check conversations table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 3. Count total conversations
SELECT COUNT(*) as total_conversations FROM conversations;

-- 4. Show ALL conversations (not filtered by site)
SELECT 
  id,
  site_id,
  visitor_id,
  message_count,
  summary,
  lead_score,
  lead_rating,
  created_at,
  updated_at
FROM conversations
ORDER BY created_at DESC;

-- 5. Check if there are multiple sites
SELECT 
  site_id,
  COUNT(*) as conversation_count
FROM conversations
GROUP BY site_id
ORDER BY conversation_count DESC;

-- 6. Check messages table to see if conversations have messages
SELECT 
  c.id as conversation_id,
  c.visitor_id,
  c.message_count as recorded_count,
  COUNT(m.id) as actual_message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, c.visitor_id, c.message_count
ORDER BY c.created_at DESC;

-- 7. Check sites table to see what site_id you should be filtering by
SELECT id, company_name, created_at
FROM sites
ORDER BY created_at DESC;
