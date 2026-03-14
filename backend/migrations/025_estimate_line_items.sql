-- Estimate line items: Excel-like rows per quote for admin-editable quoting and billing

CREATE TABLE IF NOT EXISTS estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,

  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  is_optional BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT estimate_line_items_site_estimate
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
);

CREATE INDEX idx_estimate_line_items_site ON estimate_line_items(site_id);
CREATE INDEX idx_estimate_line_items_estimate ON estimate_line_items(estimate_id);

-- Enforce tenant: line item belongs to same site as estimate
CREATE OR REPLACE FUNCTION check_estimate_line_item_site()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM estimates e WHERE e.id = NEW.estimate_id AND e.site_id = NEW.site_id
  ) THEN
    RAISE EXCEPTION 'estimate_line_items.site_id must match estimate site';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_estimate_line_item_site_trigger ON estimate_line_items;
CREATE TRIGGER check_estimate_line_item_site_trigger
  BEFORE INSERT OR UPDATE ON estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION check_estimate_line_item_site();

DROP TRIGGER IF EXISTS update_estimate_line_items_updated_at ON estimate_line_items;
CREATE TRIGGER update_estimate_line_items_updated_at
  BEFORE UPDATE ON estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
