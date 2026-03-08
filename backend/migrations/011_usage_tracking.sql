-- Migration 011: Usage Tracking
-- Tracks API usage and SMS usage for admin overview

-- API usage tracking (daily aggregates)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_unique ON api_usage(site_id, endpoint, usage_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_site_date ON api_usage(site_id, usage_date DESC);

-- SMS usage tracking (daily aggregates)
CREATE TABLE IF NOT EXISTS sms_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  message_count INTEGER DEFAULT 1,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_usage_unique ON sms_usage(site_id, direction, usage_date);
CREATE INDEX IF NOT EXISTS idx_sms_usage_site_date ON sms_usage(site_id, usage_date DESC);

-- Function to increment API usage
CREATE OR REPLACE FUNCTION increment_api_usage(p_site_id UUID, p_endpoint TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO api_usage (site_id, endpoint, request_count, usage_date)
  VALUES (p_site_id, p_endpoint, 1, CURRENT_DATE)
  ON CONFLICT (site_id, endpoint, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to increment SMS usage
CREATE OR REPLACE FUNCTION increment_sms_usage(p_site_id UUID, p_direction TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO sms_usage (site_id, direction, message_count, usage_date)
  VALUES (p_site_id, p_direction, 1, CURRENT_DATE)
  ON CONFLICT (site_id, direction, usage_date)
  DO UPDATE SET message_count = sms_usage.message_count + 1;
END;
$$ LANGUAGE plpgsql;
