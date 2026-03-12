-- Migration 020: Add user_phone to conversations for Twilio persistence

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_phone TEXT;

CREATE INDEX IF NOT EXISTS conversations_site_user_phone_idx
  ON conversations (site_id, user_phone, created_at DESC);

