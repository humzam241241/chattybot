-- Migration 015: Per-site Twilio routing (SMS/WhatsApp)

ALTER TABLE sites
ADD COLUMN IF NOT EXISTS twilio_phone TEXT,
ADD COLUMN IF NOT EXISTS twilio_whatsapp TEXT;

CREATE INDEX IF NOT EXISTS idx_sites_twilio_phone
ON sites(twilio_phone);

CREATE INDEX IF NOT EXISTS idx_sites_twilio_whatsapp
ON sites(twilio_whatsapp);

