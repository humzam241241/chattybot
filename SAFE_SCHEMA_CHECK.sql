-- ============================================================
-- SAFE SCHEMA CHECK - Only checks what exists
-- ============================================================

-- 1. First, list ALL tables that actually exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Show ALL columns for ALL existing tables
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  )
ORDER BY table_name, ordinal_position;

-- 3. Specifically check CONVERSATIONS table structure
SELECT 
  'CONVERSATIONS TABLE STRUCTURE' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 4. Count records in tables that exist
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 5. Show sample data from conversations (first 3 rows)
SELECT * FROM conversations LIMIT 3;
