-- ============================================================
-- DEFINITIVE CHECK: Show me EVERYTHING about conversations
-- ============================================================

-- 1. ALL columns in order with position numbers
SELECT 
  ordinal_position as "#",
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 2. Does it have the columns the backend needs?
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'id') THEN 'YES ✓' ELSE 'NO ✗' END as has_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'site_id') THEN 'YES ✓' ELSE 'NO ✗' END as has_site_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'visitor_id') THEN 'YES ✓' ELSE 'NO ✗' END as has_visitor_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'summary') THEN 'YES ✓' ELSE 'NO ✗' END as has_summary,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'message_count') THEN 'YES ✓' ELSE 'NO ✗' END as has_message_count,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'lead_score') THEN 'YES ✓' ELSE 'NO ✗' END as has_lead_score,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'lead_rating') THEN 'YES ✓' ELSE 'NO ✗' END as has_lead_rating,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'created_at') THEN 'YES ✓' ELSE 'NO ✗' END as has_created_at,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'updated_at') THEN 'YES ✓' ELSE 'NO ✗' END as has_updated_at,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'current_page_url') THEN 'YES ✓' ELSE 'NO ✗' END as has_current_page_url;

-- 3. Count conversations by site_id (to see why only 5 show)
SELECT 
  site_id,
  COUNT(*) as conversation_count
FROM conversations
GROUP BY site_id
ORDER BY conversation_count DESC;

-- 4. Show sample with key columns
SELECT 
  id,
  site_id,
  visitor_id,
  message_count,
  created_at
FROM conversations
ORDER BY created_at DESC
LIMIT 10;
