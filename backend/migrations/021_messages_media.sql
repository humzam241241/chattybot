-- Add optional media attachment to messages (e.g. Twilio SMS/WhatsApp photos)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_content_type TEXT;

COMMENT ON COLUMN messages.media_url IS 'Optional URL of attached image/media (e.g. from Twilio)';
COMMENT ON COLUMN messages.media_content_type IS 'MIME type of media, e.g. image/jpeg';
