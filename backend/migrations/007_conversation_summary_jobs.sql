-- Migration 007: Conversation Summary Jobs
-- Table for tracking conversation summarization jobs

CREATE TABLE IF NOT EXISTS conversation_summary_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summary_jobs_status ON conversation_summary_jobs(status);
CREATE INDEX IF NOT EXISTS idx_summary_jobs_conversation ON conversation_summary_jobs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_summary_jobs_site ON conversation_summary_jobs(site_id);

COMMENT ON TABLE conversation_summary_jobs IS 'Queue for conversation summarization jobs processed by summarizeWorker';
COMMENT ON COLUMN conversation_summary_jobs.status IS 'pending | processing | done | failed';
