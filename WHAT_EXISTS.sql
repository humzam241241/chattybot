-- Simple check: What do you actually have?

-- Check ALL tables and views in public schema
SELECT 
  table_name,
  table_type,
  CASE 
    WHEN table_type = 'BASE TABLE' THEN 'This is a real table'
    WHEN table_type = 'VIEW' THEN 'This is a view'
    ELSE table_type
  END as description
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Now let's see what's in conversations
SELECT * FROM conversations ORDER BY created_at DESC;
