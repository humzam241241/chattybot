-- Migration 015: Twilio site routing (optional per site)
-- Adds Twilio destination numbers to sites so inbound messages can route to the right site.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS twilio_phone TEXT,
  ADD COLUMN IF NOT EXISTS twilio_whatsapp TEXT;

-- One inbound destination number must map to at most one site.
-- NULLs are allowed (client may not use Twilio).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_twilio_phone_unique
  ON sites (twilio_phone)
  WHERE twilio_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_twilio_whatsapp_unique
  ON sites (twilio_whatsapp)
  WHERE twilio_whatsapp IS NOT NULL;

-- Helpful for lookups / hygiene
CREATE INDEX IF NOT EXISTS idx_sites_twilio_phone
  ON sites (twilio_phone);

CREATE INDEX IF NOT EXISTS idx_sites_twilio_whatsapp
  ON sites (twilio_whatsapp);
