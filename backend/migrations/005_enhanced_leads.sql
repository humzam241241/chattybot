-- Migration 005: Enhanced leads table for automatic lead capture pipeline
-- Adds fields for phone, issue, location, lead scoring, and extraction metadata

-- Add new columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS issue TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS extraction_json JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- Make email optional (leads can be captured with just phone)
ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;

-- Add webhook_url to sites for CRM integration
ALTER TABLE sites ADD COLUMN IF NOT EXISTS lead_webhook_url TEXT;

-- Index for finding leads by conversation
CREATE INDEX IF NOT EXISTS idx_leads_conversation_id ON leads(conversation_id);

-- Index for querying by lead rating (HOT leads first)
CREATE INDEX IF NOT EXISTS idx_leads_rating ON leads(lead_rating);

-- Index for deduplication check (same email/phone + site in 24 hours)
CREATE INDEX IF NOT EXISTS idx_leads_dedup ON leads(site_id, email, created_at DESC) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_dedup ON leads(site_id, phone, created_at DESC) WHERE phone IS NOT NULL;
