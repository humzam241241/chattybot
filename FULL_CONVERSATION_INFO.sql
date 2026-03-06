-- Show me EVERYTHING about conversations table structure
SELECT 
  ordinal_position,
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Show me the first row of data with ALL columns
SELECT * FROM conversations LIMIT 1;

-- Show primary key constraint
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'conversations'
  AND tc.constraint_type = 'PRIMARY KEY';
