-- Just show me the columns in conversations table
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;
