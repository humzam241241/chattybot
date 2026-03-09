-- Migration 012: Monthly Usage + Stripe Customer on Sites
-- Adds per-month usage table used for plan limits + Stripe metering

-- Ensure pgcrypto is available for gen_random_uuid() (Supabase typically has it, but belt-and-suspenders)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store Stripe customer id and billing plan per site (required for metered billing + limits)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_plan TEXT DEFAULT 'starter';

CREATE INDEX IF NOT EXISTS idx_sites_stripe_customer_id ON sites(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_sites_billing_plan ON sites(billing_plan);

-- Monthly usage table
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of month
  requests_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_site_month_unique ON usage(site_id, month);
CREATE INDEX IF NOT EXISTS idx_usage_month ON usage(month DESC);
