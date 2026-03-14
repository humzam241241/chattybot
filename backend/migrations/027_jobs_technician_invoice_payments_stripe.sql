-- Add technician to jobs; optional Stripe link on invoice_payments
-- Run after 026

-- Jobs: assign technician
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(technician_id) WHERE technician_id IS NOT NULL;

-- Invoice payments: optional Stripe Payment Intent (payments still calculated from invoice/estimate)
ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
