/**
 * Text chunking with overlapping windows.
 * Tuned for OpenAI text-embedding-3-small (8191 token limit).
 *
 * 800 chars ≈ 200 tokens — well within limits and small enough
 * for fine-grained semantic search, with 120-char overlap to
 * preserve context across boundaries.
 */

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

/**
 * Splits text into overlapping chunks, breaking at natural boundaries.
 */
function chunkText(text, opts = {}) {
  const size = opts.chunkSize || CHUNK_SIZE;
  const overlap = opts.overlap || CHUNK_OVERLAP;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= size) return normalized.length > 60 ? [normalized] : [];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);

    // Try sentence boundary
    if (end < normalized.length) {
      const best = Math.max(
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf('! ', end),
        normalized.lastIndexOf('? ', end),
      );
      if (best > start + size * 0.4) {
        end = best + 1;
      } else {
        const wordBreak = normalized.lastIndexOf(' ', end);
        if (wordBreak > start + size * 0.4) end = wordBreak;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 60) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  console.log(`[Ingest] Chunks created: ${chunks.length}`);
  return chunks;
}

module.exports = { chunkText, CHUNK_SIZE, CHUNK_OVERLAP };
