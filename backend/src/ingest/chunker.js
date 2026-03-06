/**
 * Ingest Chunker - Wrapper for unified chunker
 * 
 * Uses 'ingest' preset: smaller chunks for fine-grained semantic search.
 */

const { chunkText: baseChunkText, PRESETS } = require('../utils/chunker');

const CHUNK_SIZE = PRESETS.ingest.chunkSize;
const CHUNK_OVERLAP = PRESETS.ingest.overlap;

function chunkText(text, opts = {}) {
  return baseChunkText(text, { preset: 'ingest', ...opts });
}

module.exports = { chunkText, CHUNK_SIZE, CHUNK_OVERLAP };
