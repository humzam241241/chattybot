-- Migration 009: Track email consent state on conversations
-- Used to ensure the bot asks permission before promising email follow-up

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS email_consent_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS email_consent_email TEXT,
  ADD COLUMN IF NOT EXISTS email_consent_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_consent_updated_at TIMESTAMPTZ;

