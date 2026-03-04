-- Migration 003: Add lead scoring columns to conversations table
-- This is optional; the lead notification system works without these columns.
-- Adding them enables storing lead scores in the database for future analytics.

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_rating VARCHAR(10) DEFAULT NULL;

-- Index for querying high-value leads
CREATE INDEX IF NOT EXISTS idx_conversations_lead_rating ON conversations(lead_rating) WHERE lead_rating IS NOT NULL;
