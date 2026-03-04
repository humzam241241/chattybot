-- Run this SQL query in your Supabase SQL Editor to diagnose the knowledge base

-- Check if documents table exists and has data
SELECT 
  'documents' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT site_id) as sites_with_docs
FROM documents;

-- Check documents per site
SELECT 
  s.id,
  s.company_name,
  s.domain,
  COUNT(d.id) as doc_count
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
GROUP BY s.id, s.company_name, s.domain
ORDER BY doc_count DESC;

-- Check if pgvector extension is enabled
SELECT 
  extname, 
  extversion 
FROM pg_extension 
WHERE extname = 'vector';

-- Sample a few documents if they exist
SELECT 
  site_id,
  LEFT(content, 100) as content_preview,
  created_at
FROM documents
LIMIT 5;
