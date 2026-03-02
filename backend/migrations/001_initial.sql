-- ============================================================
-- ChattyBot MVP — Initial Database Migration
-- Run this against your Supabase PostgreSQL instance.
-- pgvector extension must be enabled in Supabase dashboard first:
-- Extensions → pgvector → Enable
-- ============================================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- SITES
-- One row per tenant (customer website using the chatbot).
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    TEXT NOT NULL,
  tone            TEXT,                    -- e.g. "friendly", "professional"
  primary_color   TEXT DEFAULT '#6366f1',  -- hex color for widget branding
  domain          TEXT,                    -- used for origin verification
  system_prompt   TEXT,                    -- custom override prompt
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- Chunked + embedded website content, scoped per site.
-- The embedding column uses 1536 dims = text-embedding-3-small output.
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cosine similarity search via pgvector
-- ivfflat is the right choice for MVP scale (< 1M vectors).
-- lists=100 is a good default; tune upward as data grows.
CREATE INDEX IF NOT EXISTS documents_embedding_idx
  ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Tenant-scoped queries always filter by site_id first
CREATE INDEX IF NOT EXISTS documents_site_id_idx ON documents(site_id);

-- ============================================================
-- LEADS
-- Contact captures from the chat widget.
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT NOT NULL,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_site_id_idx ON leads(site_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);
