/**
 * Unified Text Chunker
 * 
 * Splits text into overlapping chunks suitable for embedding.
 * Supports different presets for different use cases.
 */

const PRESETS = {
  // For website ingestion - smaller chunks for fine-grained search
  ingest: {
    chunkSize: 800,    // ~200 tokens
    overlap: 120,      // ~30 tokens
    minLength: 60,
  },
  // For file uploads - larger chunks for document context
  files: {
    chunkSize: 2400,   // ~600 tokens
    overlap: 200,      // ~50 tokens
    minLength: 100,
  },
  // Default preset
  default: {
    chunkSize: 1200,   // ~300 tokens
    overlap: 150,      // ~38 tokens
    minLength: 80,
  },
};

/**
 * Splits text into overlapping chunks, breaking at natural boundaries.
 * 
 * @param {string} text - Raw text to chunk
 * @param {Object|string} options - Options object or preset name ('ingest', 'files', 'default')
 * @param {number} options.chunkSize - Maximum chunk size in characters
 * @param {number} options.overlap - Overlap between chunks in characters
 * @param {number} options.minLength - Minimum chunk length to include
 * @param {boolean} options.silent - Suppress logging
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, options = {}) {
  // Handle preset string
  if (typeof options === 'string') {
    options = { preset: options };
  }

  // Get preset or defaults
  const preset = PRESETS[options.preset] || PRESETS.default;
  const size = options.chunkSize || preset.chunkSize;
  const overlap = options.overlap || preset.overlap;
  const minLength = options.minLength || preset.minLength;
  const silent = options.silent || false;

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (!normalized) return [];
  if (normalized.length <= size) {
    return normalized.length > minLength ? [normalized] : [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);

    // Try to break at sentence boundary
    if (end < normalized.length) {
      const bestSentence = Math.max(
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf('! ', end),
        normalized.lastIndexOf('? ', end),
      );
      
      if (bestSentence > start + size * 0.4) {
        end = bestSentence + 1;
      } else {
        // Fall back to word boundary
        const wordBreak = normalized.lastIndexOf(' ', end);
        if (wordBreak > start + size * 0.4) {
          end = wordBreak;
        }
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > minLength) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  if (!silent) {
    console.log(`[Chunker] Created ${chunks.length} chunks (size: ${size}, overlap: ${overlap})`);
  }

  return chunks;
}

/**
 * Get available presets
 * @returns {Object}
 */
function getPresets() {
  return { ...PRESETS };
}

module.exports = { 
  chunkText, 
  getPresets,
  PRESETS,
};
