-- Migration 018: Store extracted text for uploaded files
-- This supports debugging/reprocessing and lets the admin UI show what was ingested.

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;

