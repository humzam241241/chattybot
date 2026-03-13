-- AI Intent and Classification tracking tables
-- Stores results from Intent Engine and Problem Classifier

-- ============================================================================
-- AI INTENTS
-- Stores detected user intents for each message/request
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID,
  
  -- Intent detection results
  intent TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sub_intents JSONB DEFAULT '[]',
  
  -- Raw input
  input_text TEXT,
  
  -- Metadata
  model_used TEXT DEFAULT 'gpt-4o-mini',
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_intents_site ON ai_intents(site_id);
CREATE INDEX idx_ai_intents_request ON ai_intents(request_id);
CREATE INDEX idx_ai_intents_conversation ON ai_intents(conversation_id);
CREATE INDEX idx_ai_intents_intent ON ai_intents(intent);
CREATE INDEX idx_ai_intents_created ON ai_intents(created_at DESC);

-- ============================================================================
-- AI CLASSIFICATIONS
-- Stores problem classification results
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- Classification results
  job_type TEXT,
  industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
  industry_slug TEXT,
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Reasoning
  reasoning TEXT,
  key_indicators JSONB DEFAULT '[]',
  detected_urgency TEXT CHECK (detected_urgency IN ('low', 'normal', 'high', 'emergency')),
  
  -- Follow-up
  needs_more_info BOOLEAN DEFAULT false,
  suggested_questions JSONB DEFAULT '[]',
  
  -- Raw input
  input_text TEXT,
  
  -- Metadata
  model_used TEXT DEFAULT 'gpt-4o-mini',
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_classifications_site ON ai_classifications(site_id);
CREATE INDEX idx_ai_classifications_request ON ai_classifications(request_id);
CREATE INDEX idx_ai_classifications_conversation ON ai_classifications(conversation_id);
CREATE INDEX idx_ai_classifications_job_type ON ai_classifications(job_type);
CREATE INDEX idx_ai_classifications_industry ON ai_classifications(industry_id);
CREATE INDEX idx_ai_classifications_created ON ai_classifications(created_at DESC);

-- ============================================================================
-- AI CONVERSATION CONTEXT
-- Stores conversation state for the Conversation Engine
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Current state
  current_intent TEXT,
  current_job_type TEXT,
  current_industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
  
  -- Collected information
  collected_info JSONB DEFAULT '{}',
  missing_info JSONB DEFAULT '[]',
  
  -- Conversation flow
  conversation_stage TEXT DEFAULT 'greeting' CHECK (conversation_stage IN (
    'greeting',
    'problem_discovery',
    'diagnostic_questions',
    'classification_confirmed',
    'estimate_presented',
    'objection_handling',
    'booking',
    'follow_up',
    'closed'
  )),
  
  -- Estimate state
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  estimate_presented BOOLEAN DEFAULT false,
  customer_response TEXT,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(conversation_id)
);

CREATE INDEX idx_ai_conversation_context_site ON ai_conversation_context(site_id);
CREATE INDEX idx_ai_conversation_context_conversation ON ai_conversation_context(conversation_id);
CREATE INDEX idx_ai_conversation_context_stage ON ai_conversation_context(conversation_stage);

-- Trigger to update last_updated
CREATE OR REPLACE FUNCTION update_ai_conversation_context_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_conversation_context_timestamp ON ai_conversation_context;
CREATE TRIGGER update_ai_conversation_context_timestamp
  BEFORE UPDATE ON ai_conversation_context
  FOR EACH ROW EXECUTE FUNCTION update_ai_conversation_context_timestamp();
