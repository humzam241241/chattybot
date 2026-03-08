-- Migration 010: Users, Ownership, and Paywall
-- Adds app_users table, ownership to sites, and subscription tracking

-- App users table (synced from Supabase Auth)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  trial_ends_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  custom_pricing JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_stripe_customer ON app_users(stripe_customer_id);

-- Add owner_id to sites for multi-tenancy
ALTER TABLE sites ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES app_users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sites_owner_id ON sites(owner_id);

-- Payment history for admin overview
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  payment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
