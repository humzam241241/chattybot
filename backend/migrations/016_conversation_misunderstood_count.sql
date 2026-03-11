-- Migration 016: Track consecutive misunderstood turns per conversation
-- Used to escalate to the owner after repeated "I don't know" responses.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS misunderstood_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS misunderstood_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_misunderstood_count
  ON conversations (misunderstood_count)
  WHERE misunderstood_count > 0;

