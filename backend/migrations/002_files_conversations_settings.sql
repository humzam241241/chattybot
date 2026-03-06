-- ============================================================
-- ChattyBot MVP — Files KB + Conversations + Raffy Settings
-- ============================================================

-- Needed for gen_random_uuid() on some Supabase projects
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Extend documents to track source (website vs uploaded file)
-- ------------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS documents_source_idx ON documents(source_type, source_id);

-- ------------------------------------------------------------
-- Uploaded files (raw stored in Supabase Storage)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    BIGINT,
  status        TEXT NOT NULL DEFAULT 'uploaded', -- uploaded|processing|ready|failed
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS files_site_id_idx ON files(site_id);
CREATE INDEX IF NOT EXISTS files_created_at_idx ON files(created_at DESC);

-- ------------------------------------------------------------
-- Conversations + Messages (logs, timestamps, rolling summary)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id       TEXT,
  current_page_url TEXT,
  summary          TEXT NOT NULL DEFAULT '',
  message_count    INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_site_id_idx ON conversations(site_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role            TEXT NOT NULL, -- user|assistant|system
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_site_id_idx ON messages(site_id);

-- ------------------------------------------------------------
-- Raffy settings: global defaults + per-site overrides
-- Store as JSONB to keep MVP flexible without migrations.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS global_settings (
  id         INT PRIMARY KEY DEFAULT 1,
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure singleton row exists (dollar-quoting avoids escaping apostrophes in JSON)
INSERT INTO global_settings (id, settings)
VALUES (1, $json${
  "name": "Raffy",
  "role": "AI receptionist",
  "tone": "friendly, confident, never cocky",
  "guardrails": {
    "wont_say": [
      "legal advice",
      "medical advice",
      "sensitive personal data requests",
      "competitor comparisons that are not in provided context"
    ]
  },
  "escalation_triggers": {
    "keywords": ["human", "call me", "sales", "quote", "pricing", "complaint", "angry", "refund"]
  },
  "emergency": {
    "keywords": ["fire", "gas leak", "injury", "accident", "electrical shock", "bleeding"],
    "response": "If this is an emergency, please call your local emergency number immediately. If you'd like, I can connect you with our team right after you're safe."
  },
  "sales_prompts": {
    "cta": "If you'd like, I can help you get a quick quote—what type of project is this and when are you looking to start?"
  },
  "humor": {
    "enabled": true,
    "guidelines": "Light, professional humor only. No sarcasm. No jokes about safety, money, or protected classes."
  }
}$json$::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS raffy_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
