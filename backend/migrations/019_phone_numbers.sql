-- Migration 019: Multi-number Twilio routing per site
-- Adds phone_numbers mapping table and backfills existing site numbers.

CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS phone_numbers_site_id_idx ON phone_numbers(site_id);
CREATE INDEX IF NOT EXISTS phone_numbers_phone_number_idx ON phone_numbers(phone_number);

-- Backfill existing site numbers (if present)
INSERT INTO phone_numbers (phone_number, channel, site_id)
SELECT twilio_whatsapp, 'whatsapp', id
FROM sites
WHERE twilio_whatsapp IS NOT NULL
  AND twilio_whatsapp <> ''
ON CONFLICT (phone_number) DO NOTHING;

INSERT INTO phone_numbers (phone_number, channel, site_id)
SELECT twilio_phone, 'sms', id
FROM sites
WHERE twilio_phone IS NOT NULL
  AND twilio_phone <> ''
ON CONFLICT (phone_number) DO NOTHING;

