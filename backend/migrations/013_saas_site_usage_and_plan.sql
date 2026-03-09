-- Migration 013: SaaS Plan + Usage on Sites
-- Implements per-site plan + monthly usage counter (reset by cron)

-- Ensure updated_at exists on sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- SaaS plan + monthly usage counter
ALTER TABLE sites ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;

-- Stripe linkage per site (customer + subscription)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
-- stripe_customer_id may already exist; ensure it exists for older DBs
ALTER TABLE sites ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sites_plan ON sites(plan);
CREATE INDEX IF NOT EXISTS idx_sites_messages_used ON sites(messages_used);
CREATE INDEX IF NOT EXISTS idx_sites_stripe_customer_id ON sites(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_sites_stripe_subscription_id ON sites(stripe_subscription_id);
