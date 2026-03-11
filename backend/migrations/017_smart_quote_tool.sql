-- ============================================================
-- Smart Quote Tool (Ryan Roofing) — Pricing templates + quotes
-- ============================================================

-- Template pricing (shared defaults, editable by copying into tenant table)
CREATE TABLE IF NOT EXISTS roofing_pricing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL DEFAULT 'ON',
  service_type TEXT NOT NULL,
  roof_type TEXT NULL,     -- 'shingle' | 'flat' | NULL (any)
  urgency TEXT NULL,       -- 'standard' | 'emergency' | NULL (any)
  price_low_per_sqft NUMERIC NULL,
  price_high_per_sqft NUMERIC NULL,
  price_low_flat NUMERIC NULL,
  price_high_flat NUMERIC NULL,
  min_charge_low NUMERIC NULL,
  min_charge_high NUMERIC NULL,
  timeline_estimate TEXT NULL,
  recommended_service TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant-scoped pricing (editable per site)
CREATE TABLE IF NOT EXISTS roofing_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  region TEXT NOT NULL DEFAULT 'ON',
  service_type TEXT NOT NULL,
  roof_type TEXT NULL,     -- 'shingle' | 'flat' | NULL (any)
  urgency TEXT NULL,       -- 'standard' | 'emergency' | NULL (any)
  price_low_per_sqft NUMERIC NULL,
  price_high_per_sqft NUMERIC NULL,
  price_low_flat NUMERIC NULL,
  price_high_flat NUMERIC NULL,
  min_charge_low NUMERIC NULL,
  min_charge_high NUMERIC NULL,
  timeline_estimate TEXT NULL,
  recommended_service TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roofing_pricing_site_id_idx ON roofing_pricing(site_id);
CREATE INDEX IF NOT EXISTS roofing_pricing_service_idx ON roofing_pricing(site_id, service_type);

-- Generated quotes (customer-facing artifact)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  roof_size NUMERIC NULL,
  roof_type TEXT NULL,
  urgency TEXT NULL,
  notes TEXT NULL,
  price_low NUMERIC NOT NULL,
  price_high NUMERIC NOT NULL,
  timeline_estimate TEXT NULL,
  recommended_service TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quotes_site_id_created_at_idx ON quotes(site_id, created_at DESC);

-- ============================================================
-- Ontario (ON) default template seed data
-- Price ranges are intended as editable starting points.
-- ============================================================

WITH seed (
  region,
  service_type,
  roof_type,
  urgency,
  price_low_per_sqft,
  price_high_per_sqft,
  price_low_flat,
  price_high_flat,
  min_charge_low,
  min_charge_high,
  timeline_estimate,
  recommended_service
) AS (
  VALUES
    -- Shingle roof replacement (asphalt)
    ('ON', 'shingle roof replacement', 'shingle', 'standard', 4.50, 8.50, NULL, NULL, 850, 1600, '1–3 days (typical)', 'Shingle roof replacement (asphalt shingles)'),

    -- Flat roof repair (membrane/patch). Repairs often have a minimum service charge.
    ('ON', 'flat roof repair', 'flat', 'standard', 8.00, 15.00, NULL, NULL, 650, 1500, '1–2 days (typical)', 'Flat roof diagnostic + targeted repair'),

    -- Emergency repair (same-day / temporary leak stop + follow-up recommended)
    ('ON', 'emergency repair', NULL, 'emergency', 10.00, 20.00, 450, 950, 450, 950, 'Same day / 24 hours', 'Emergency leak repair + follow-up inspection'),

    -- Roof inspection (fixed fee)
    ('ON', 'roof inspection', NULL, 'standard', NULL, NULL, 150, 350, 150, 350, '1–3 business days', 'Roof inspection'),

    -- Attic ventilation (fixed, varies by scope/number of vents)
    ('ON', 'attic ventilation', NULL, 'standard', NULL, NULL, 450, 1200, 450, 1200, '0.5–1 day', 'Attic ventilation assessment + install (as needed)')
)
INSERT INTO roofing_pricing_templates (
  region,
  service_type,
  roof_type,
  urgency,
  price_low_per_sqft,
  price_high_per_sqft,
  price_low_flat,
  price_high_flat,
  min_charge_low,
  min_charge_high,
  timeline_estimate,
  recommended_service
)
SELECT
  s.region,
  s.service_type,
  s.roof_type,
  s.urgency,
  s.price_low_per_sqft,
  s.price_high_per_sqft,
  s.price_low_flat,
  s.price_high_flat,
  s.min_charge_low,
  s.min_charge_high,
  s.timeline_estimate,
  s.recommended_service
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM roofing_pricing_templates t
  WHERE t.region = s.region
    AND t.service_type = s.service_type
    AND (t.roof_type IS NOT DISTINCT FROM s.roof_type)
    AND (t.urgency IS NOT DISTINCT FROM s.urgency)
);

-- Optional: if a "Ryan Roofing" site exists, copy the default templates into tenant pricing.
DO $$
DECLARE
  ryan_site_id UUID;
BEGIN
  SELECT id
  INTO ryan_site_id
  FROM sites
  WHERE lower(company_name) LIKE '%ryan%'
    AND lower(company_name) LIKE '%roof%'
  LIMIT 1;

  IF ryan_site_id IS NOT NULL THEN
    INSERT INTO roofing_pricing (
      site_id,
      region,
      service_type,
      roof_type,
      urgency,
      price_low_per_sqft,
      price_high_per_sqft,
      price_low_flat,
      price_high_flat,
      min_charge_low,
      min_charge_high,
      timeline_estimate,
      recommended_service
    )
    SELECT
      ryan_site_id,
      t.region,
      t.service_type,
      t.roof_type,
      t.urgency,
      t.price_low_per_sqft,
      t.price_high_per_sqft,
      t.price_low_flat,
      t.price_high_flat,
      t.min_charge_low,
      t.min_charge_high,
      t.timeline_estimate,
      t.recommended_service
    FROM roofing_pricing_templates t
    WHERE t.region = 'ON'
      AND NOT EXISTS (
        SELECT 1
        FROM roofing_pricing p
        WHERE p.site_id = ryan_site_id
          AND p.region = t.region
          AND p.service_type = t.service_type
          AND (p.roof_type IS NOT DISTINCT FROM t.roof_type)
          AND (p.urgency IS NOT DISTINCT FROM t.urgency)
      );
  END IF;
END $$;

