/**
 * File Chunker - Wrapper for unified chunker
 * 
 * Uses 'files' preset: larger chunks for document context.
 */

const { chunkText: baseChunkText, PRESETS } = require('../utils/chunker');

const CHUNK_SIZE = PRESETS.files.chunkSize;
const CHUNK_OVERLAP = PRESETS.files.overlap;

function chunkText(text) {
  return baseChunkText(text, { preset: 'files', silent: true });
}

module.exports = { chunkText, CHUNK_SIZE, CHUNK_OVERLAP };
