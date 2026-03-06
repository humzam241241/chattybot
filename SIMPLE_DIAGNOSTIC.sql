-- ============================================================
-- Simple Diagnostic (without lead_score columns)
-- ============================================================

-- 1. Check what columns actually exist in conversations
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 2. Count total conversations
SELECT COUNT(*) as total_conversations FROM conversations;

-- 3. Show ALL conversations with their site
SELECT 
  c.id,
  c.site_id,
  s.company_name as site_name,
  c.visitor_id,
  c.message_count,
  c.created_at,
  c.updated_at
FROM conversations c
LEFT JOIN sites s ON s.id = c.site_id
ORDER BY c.created_at DESC;

-- 4. Count conversations per site
SELECT 
  c.site_id,
  s.company_name as site_name,
  COUNT(*) as conversation_count
FROM conversations c
LEFT JOIN sites s ON s.id = c.site_id
GROUP BY c.site_id, s.company_name
ORDER BY conversation_count DESC;

-- 5. Check for orphaned conversations (no site_id or invalid site_id)
SELECT 
  c.id,
  c.site_id,
  c.visitor_id,
  c.message_count,
  CASE 
    WHEN c.site_id IS NULL THEN 'NULL site_id'
    WHEN s.id IS NULL THEN 'site_id not in sites table'
    ELSE 'OK'
  END as status
FROM conversations c
LEFT JOIN sites s ON s.id = c.site_id
WHERE c.site_id IS NULL OR s.id IS NULL;
