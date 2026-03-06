-- ============================================================
-- COMPLETE DATABASE SCHEMA OVERVIEW
-- Shows all tables, columns, and data types
-- ============================================================

-- 1. List all tables and views in your database
SELECT 
  table_name,
  table_type,
  CASE 
    WHEN table_type = 'BASE TABLE' THEN '📊 Table'
    WHEN table_type = 'VIEW' THEN '👁️ View'
    ELSE table_type
  END as type_icon
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_type, table_name;

-- 2. Show ALL columns for ALL tables with details
SELECT 
  table_name,
  ordinal_position as position,
  column_name,
  data_type,
  CASE 
    WHEN character_maximum_length IS NOT NULL 
    THEN data_type || '(' || character_maximum_length || ')'
    ELSE data_type
  END as full_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Grouped view - easier to read per table
SELECT 
  '=== ' || table_name || ' ===' as table_info
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- For each table, show its columns
-- SITES TABLE
SELECT 'SITES TABLE' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sites'
ORDER BY ordinal_position;

-- CONVERSATIONS TABLE
SELECT 'CONVERSATIONS TABLE' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- MESSAGES TABLE
SELECT 'MESSAGES TABLE' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- DOCUMENTS TABLE
SELECT 'DOCUMENTS TABLE' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- LEADS TABLE
SELECT 'LEADS TABLE' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- FILES TABLE
SELECT 'FILES TABLE' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'files'
ORDER BY ordinal_position;

-- 4. Show record counts for each table
SELECT 
  'sites' as table_name, 
  COUNT(*) as record_count 
FROM sites
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'files', COUNT(*) FROM files
ORDER BY table_name;

-- 5. Check for any OTHER tables we might not know about
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN ('sites', 'conversations', 'messages', 'documents', 'leads', 'files', 'global_settings')
ORDER BY table_name;
