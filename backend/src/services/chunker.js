/**
 * Splits text into overlapping chunks suitable for embedding.
 * 
 * We use a character-based approximation instead of a tokenizer library
 * to keep dependencies minimal. Average English token ≈ 4 chars.
 * Target: 500-800 tokens → 2000-3200 chars per chunk, with 200-char overlap
 * to preserve context across boundaries.
 */

const CHUNK_SIZE = 2400;   // ~600 tokens
const CHUNK_OVERLAP = 200;  // ~50 tokens overlap

/**
 * @param {string} text - Raw extracted text
 * @returns {string[]} - Array of text chunks
 */
function chunkText(text) {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= CHUNK_SIZE) {
    return normalized.length > 50 ? [normalized] : [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;

    // Try to break at a sentence boundary to avoid splitting mid-sentence
    if (end < normalized.length) {
      const breakPoint = normalized.lastIndexOf('. ', end);
      if (breakPoint > start + CHUNK_SIZE / 2) {
        end = breakPoint + 1;
      }
    } else {
      end = normalized.length;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 100) {
      chunks.push(chunk);
    }

    // If we've reached the end, stop. Otherwise, overlap for continuity.
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

module.exports = { chunkText };
