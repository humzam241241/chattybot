-- Migration 014: Stripe billing per site via site_subscriptions
-- NOTE: Requested name was 008_stripe_billing.sql but 008 is already used in this repo.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS site_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,

  plan text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',

  message_limit integer NOT NULL,
  messages_used integer NOT NULL DEFAULT 0,

  current_period_start timestamptz,
  current_period_end timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_subscriptions_site ON site_subscriptions(site_id);
CREATE INDEX IF NOT EXISTS idx_site_subscriptions_customer ON site_subscriptions(stripe_customer_id);
