-- Migration 006: Agency Features
-- Adds missed_leads table and updates for weekly reports

-- Missed leads table - tracks conversations with potential leads but no contact info
CREATE TABLE IF NOT EXISTS missed_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  keywords_found TEXT[],
  message_count INTEGER,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missed_leads_site_id ON missed_leads(site_id);
CREATE INDEX IF NOT EXISTS idx_missed_leads_conversation_id ON missed_leads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_missed_leads_created_at ON missed_leads(created_at DESC);

-- Prevent duplicate missed lead entries for same conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_missed_leads_unique_conversation ON missed_leads(conversation_id);

-- Add report_email to sites for weekly report delivery
ALTER TABLE sites ADD COLUMN IF NOT EXISTS report_email TEXT;

-- Add last_summary_at to conversations to track when summary was generated
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_summary_at TIMESTAMPTZ;

-- Weekly report tracking table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  hot_leads INTEGER DEFAULT 0,
  warm_leads INTEGER DEFAULT 0,
  cold_leads INTEGER DEFAULT 0,
  missed_leads INTEGER DEFAULT 0,
  top_questions JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_site_id ON weekly_reports(site_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_unique ON weekly_reports(site_id, report_date);
