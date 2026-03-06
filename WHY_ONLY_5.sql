-- ============================================================
-- Diagnose: Why are 8 conversations in DB but only 5 showing in UI?
-- ============================================================

-- 1. Show ALL conversations with their site_id
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

-- 2. Count conversations per site
SELECT 
  c.site_id,
  s.company_name as site_name,
  COUNT(*) as conversation_count
FROM conversations c
LEFT JOIN sites s ON s.id = c.site_id
GROUP BY c.site_id, s.company_name
ORDER BY conversation_count DESC;

-- 3. Find conversations with NULL or mismatched site_id
SELECT 
  id,
  site_id,
  visitor_id,
  message_count,
  'NULL site_id' as issue
FROM conversations
WHERE site_id IS NULL

UNION ALL

SELECT 
  c.id,
  c.site_id,
  c.visitor_id,
  c.message_count,
  'site_id not in sites table' as issue
FROM conversations c
LEFT JOIN sites s ON s.id = c.site_id
WHERE s.id IS NULL;

-- 4. Check if conversations have the lead scoring columns
SELECT 
  id,
  visitor_id,
  message_count,
  lead_score,
  lead_rating,
  CASE 
    WHEN lead_score IS NULL THEN 'Missing lead_score'
    WHEN lead_rating IS NULL THEN 'Missing lead_rating'
    ELSE 'Has lead data'
  END as lead_status
FROM conversations
ORDER BY created_at DESC;
