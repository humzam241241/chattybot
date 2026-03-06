-- Migration 008: Data Reconciliation Enhancement
-- Add recovered_at to missed_leads table

ALTER TABLE missed_leads ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_missed_leads_recovered ON missed_leads(recovered_at) WHERE recovered_at IS NULL;

COMMENT ON COLUMN missed_leads.recovered_at IS 'Timestamp when lead was recovered via reconciliation';
