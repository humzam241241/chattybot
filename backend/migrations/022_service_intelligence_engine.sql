-- Service Intelligence Engine
-- Industry-agnostic service operations system

-- ============================================================================
-- INDUSTRIES
-- Master list of supported industries (roofing, hvac, plumbing, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_industries_slug ON industries(slug);
CREATE INDEX idx_industries_active ON industries(is_active) WHERE is_active = true;

-- Seed common industries
INSERT INTO industries (slug, name, description, icon) VALUES
  ('roofing', 'Roofing', 'Roof repair, replacement, and inspection services', '🏠'),
  ('hvac', 'HVAC', 'Heating, ventilation, and air conditioning services', '❄️'),
  ('plumbing', 'Plumbing', 'Pipe repair, drain cleaning, and water heater services', '🔧'),
  ('electrical', 'Electrical', 'Wiring, panel upgrades, and electrical repairs', '⚡'),
  ('landscaping', 'Landscaping', 'Lawn care, tree service, and outdoor maintenance', '🌳'),
  ('cleaning', 'Cleaning', 'Residential and commercial cleaning services', '🧹'),
  ('pest_control', 'Pest Control', 'Pest removal and prevention services', '🐜'),
  ('general_contracting', 'General Contracting', 'Home improvement and renovation services', '🔨')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SERVICE PROTOCOLS
-- Job templates defining scope, pricing, and risk factors per job type
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  description TEXT,
  diagnosis_signals JSONB DEFAULT '[]',
  typical_labor_hours_min NUMERIC(6,2),
  typical_labor_hours_max NUMERIC(6,2),
  material_cost_min NUMERIC(10,2),
  material_cost_max NUMERIC(10,2),
  typical_price_min NUMERIC(10,2),
  typical_price_max NUMERIC(10,2),
  scope_of_work TEXT,
  risk_factors JSONB DEFAULT '[]',
  requires_inspection BOOLEAN DEFAULT true,
  urgency_keywords JSONB DEFAULT '[]',
  follow_up_questions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(industry_id, job_type)
);

CREATE INDEX idx_service_protocols_industry ON service_protocols(industry_id);
CREATE INDEX idx_service_protocols_job_type ON service_protocols(job_type);
CREATE INDEX idx_service_protocols_active ON service_protocols(is_active) WHERE is_active = true;

-- ============================================================================
-- HISTORICAL JOBS
-- Past job outcomes for pricing intelligence and ML training
-- ============================================================================
CREATE TABLE IF NOT EXISTS historical_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  project_size TEXT, -- small, medium, large, xl
  complexity_score INTEGER CHECK (complexity_score BETWEEN 1 AND 10),
  labor_hours NUMERIC(6,2),
  material_cost NUMERIC(10,2),
  final_price NUMERIC(10,2),
  scope_creep_cost NUMERIC(10,2) DEFAULT 0,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historical_jobs_site ON historical_jobs(site_id);
CREATE INDEX idx_historical_jobs_industry ON historical_jobs(industry_id);
CREATE INDEX idx_historical_jobs_job_type ON historical_jobs(job_type);
CREATE INDEX idx_historical_jobs_completed ON historical_jobs(completed_at DESC);

-- ============================================================================
-- SERVICE REQUESTS
-- Incoming customer service requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Customer info
  customer_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Request details
  industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
  problem_description TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'emergency')),
  preferred_contact_method TEXT DEFAULT 'phone' CHECK (preferred_contact_method IN ('phone', 'email', 'text', 'any')),
  preferred_schedule TEXT,
  
  -- Classification
  classified_job_type TEXT,
  classification_confidence NUMERIC(3,2),
  classification_reasoning TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new',
    'classified',
    'needs_assessment',
    'estimated',
    'awaiting_approval',
    'approved',
    'sent',
    'viewed',
    'accepted',
    'declined',
    'booked',
    'completed',
    'closed',
    'cancelled'
  )),
  
  -- Metadata
  source TEXT DEFAULT 'chat', -- chat, phone, email, web_form
  assigned_to UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_requests_site ON service_requests(site_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_industry ON service_requests(industry_id);
CREATE INDEX idx_service_requests_created ON service_requests(created_at DESC);
CREATE INDEX idx_service_requests_conversation ON service_requests(conversation_id);
CREATE INDEX idx_service_requests_lead ON service_requests(lead_id);

-- ============================================================================
-- ESTIMATES
-- Generated quotes/estimates for service requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Job details
  job_type TEXT NOT NULL,
  industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
  
  -- Pricing
  price_low NUMERIC(10,2) NOT NULL,
  price_high NUMERIC(10,2) NOT NULL,
  recommended_price NUMERIC(10,2),
  
  -- Timeline
  timeline_days_min INTEGER,
  timeline_days_max INTEGER,
  
  -- Scope
  scope_of_work TEXT,
  inclusions JSONB DEFAULT '[]',
  exclusions JSONB DEFAULT '[]',
  
  -- Risk and confidence
  risk_warnings JSONB DEFAULT '[]',
  confidence_level TEXT DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
  confidence_reasoning TEXT,
  
  -- Data sources
  historical_jobs_count INTEGER DEFAULT 0,
  protocol_id UUID REFERENCES service_protocols(id) ON DELETE SET NULL,
  
  -- Approval workflow
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sent',
    'viewed',
    'accepted',
    'declined',
    'expired'
  )),
  approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Delivery
  sent_at TIMESTAMPTZ,
  sent_via TEXT, -- email, sms, both
  viewed_at TIMESTAMPTZ,
  customer_response TEXT,
  customer_response_at TIMESTAMPTZ,
  
  -- Validity
  valid_until TIMESTAMPTZ,
  
  -- Metadata
  version INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_estimates_site ON estimates(site_id);
CREATE INDEX idx_estimates_request ON estimates(request_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_created ON estimates(created_at DESC);
CREATE INDEX idx_estimates_pending ON estimates(status) WHERE status = 'pending_approval';

-- ============================================================================
-- ESTIMATE FOLLOW-UPS
-- Scheduled follow-up actions for estimates
-- ============================================================================
CREATE TABLE IF NOT EXISTS estimate_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  follow_up_type TEXT NOT NULL CHECK (follow_up_type IN ('reminder', 'check_in', 'expiry_warning', 'feedback')),
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
  
  -- Execution
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Content
  message_template TEXT,
  message_sent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_estimate_follow_ups_site ON estimate_follow_ups(site_id);
CREATE INDEX idx_estimate_follow_ups_estimate ON estimate_follow_ups(estimate_id);
CREATE INDEX idx_estimate_follow_ups_scheduled ON estimate_follow_ups(scheduled_at);
CREATE INDEX idx_estimate_follow_ups_pending ON estimate_follow_ups(status, scheduled_at) WHERE status = 'pending';

-- ============================================================================
-- SITE INDUSTRY CONFIG
-- Per-site industry settings and customizations
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_industry_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  
  -- Pricing adjustments
  labor_rate_per_hour NUMERIC(8,2),
  markup_percentage NUMERIC(5,2) DEFAULT 0,
  minimum_job_price NUMERIC(10,2),
  
  -- Service area
  service_radius_miles INTEGER,
  service_zip_codes JSONB DEFAULT '[]',
  
  -- Scheduling
  lead_time_days INTEGER DEFAULT 1,
  max_jobs_per_day INTEGER,
  
  -- Custom settings
  custom_protocols JSONB DEFAULT '{}',
  custom_follow_up_schedule JSONB DEFAULT '[]',
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(site_id, industry_id)
);

CREATE INDEX idx_site_industry_config_site ON site_industry_config(site_id);
CREATE INDEX idx_site_industry_config_industry ON site_industry_config(industry_id);

-- ============================================================================
-- ATTACHMENT ANALYSIS
-- Analysis results for uploaded images/files
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- File info
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_name TEXT,
  
  -- Analysis results
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  problem_indicators JSONB DEFAULT '[]',
  detected_issues JSONB DEFAULT '[]',
  severity_assessment TEXT,
  confidence NUMERIC(3,2),
  raw_analysis TEXT,
  
  -- Metadata
  analyzed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachment_analysis_site ON attachment_analysis(site_id);
CREATE INDEX idx_attachment_analysis_request ON attachment_analysis(request_id);
CREATE INDEX idx_attachment_analysis_status ON attachment_analysis(analysis_status);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_service_protocols_updated_at ON service_protocols;
CREATE TRIGGER update_service_protocols_updated_at
  BEFORE UPDATE ON service_protocols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_requests_updated_at ON service_requests;
CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_industry_config_updated_at ON site_industry_config;
CREATE TRIGGER update_site_industry_config_updated_at
  BEFORE UPDATE ON site_industry_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
