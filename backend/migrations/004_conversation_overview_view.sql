-- Migration 004: Create or replace conversation_overview view
-- This view consolidates conversation data with lead scoring for the admin UI

-- Drop the view if it exists (in case it's outdated)
DROP VIEW IF EXISTS conversation_overview CASCADE;

-- Create the view with all necessary fields
CREATE OR REPLACE VIEW conversation_overview AS
SELECT 
  c.id,
  c.site_id,
  c.visitor_id,
  c.current_page_url,
  c.summary,
  c.message_count,
  c.lead_score,
  c.lead_rating,
  c.created_at,
  c.updated_at
FROM conversations c;

-- Grant appropriate permissions (adjust based on your setup)
-- GRANT SELECT ON conversation_overview TO authenticated;
