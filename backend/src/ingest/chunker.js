/**
 * Text chunking module with overlapping windows
 * Optimized for embedding quality and semantic coherence
 */

const CHUNK_SIZE = 800;     // Characters per chunk
const CHUNK_OVERLAP = 120;  // Overlap between chunks for context preservation

/**
 * Splits text into overlapping chunks with smart boundary detection
 */
function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || CHUNK_SIZE;
  const overlap = options.overlap || CHUNK_OVERLAP;
  
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  // If text is smaller than chunk size, return as single chunk
  if (normalized.length <= chunkSize) {
    return normalized.length > 100 ? [normalized] : [];
  }
  
  const chunks = [];
  let start = 0;
  
  while (start < normalized.length) {
    let end = start + chunkSize;
    
    // Try to break at sentence boundary (. ! ?)
    if (end < normalized.length) {
      const sentenceBreak = Math.max(
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf('! ', end),
        normalized.lastIndexOf('? ', end)
      );
      
      // Only use sentence break if it's not too far back
      if (sentenceBreak > start + chunkSize / 2) {
        end = sentenceBreak + 1;
      } else {
        // Try to break at paragraph
        const paragraphBreak = normalized.lastIndexOf('\n', end);
        if (paragraphBreak > start + chunkSize / 2) {
          end = paragraphBreak + 1;
        } else {
          // Try to break at word boundary
          const wordBreak = normalized.lastIndexOf(' ', end);
          if (wordBreak > start + chunkSize / 2) {
            end = wordBreak + 1;
          }
        }
      }
    } else {
      end = normalized.length;
    }
    
    const chunk = normalized.slice(start, end).trim();
    
    // Only add chunks with meaningful content
    if (chunk.length > 100) {
      chunks.push(chunk);
    }
    
    // Stop if we've reached the end
    if (end >= normalized.length) break;
    
    // Overlap for context continuity
    start = end - overlap;
  }
  
  console.log(`[Ingest] Chunks created: ${chunks.length}`);
  return chunks;
}

/**
 * Validates chunk quality
 */
function validateChunk(chunk) {
  // Minimum length
  if (chunk.length < 100) return false;
  
  // Check for excessive special characters (likely corrupted)
  const specialCharRatio = (chunk.match(/[^a-zA-Z0-9\s.,!?;:()\-'"]/g) || []).length / chunk.length;
  if (specialCharRatio > 0.3) return false;
  
  // Must contain some alphanumeric content
  if (!/[a-zA-Z0-9]/.test(chunk)) return false;
  
  return true;
}

/**
 * Chunks text with validation and statistics
 */
function chunkTextWithStats(text, options = {}) {
  const chunks = chunkText(text, options);
  
  // Validate and filter chunks
  const validChunks = chunks.filter(validateChunk);
  
  const stats = {
    totalChunks: chunks.length,
    validChunks: validChunks.length,
    invalidChunks: chunks.length - validChunks.length,
    avgChunkLength: validChunks.length > 0 
      ? Math.round(validChunks.reduce((sum, c) => sum + c.length, 0) / validChunks.length)
      : 0
  };
  
  console.log(`[Ingest] Chunking stats: ${stats.validChunks} valid, ${stats.invalidChunks} invalid, avg length ${stats.avgChunkLength}`);
  
  return {
    chunks: validChunks,
    stats
  };
}

module.exports = {
  chunkText,
  validateChunk,
  chunkTextWithStats,
  CHUNK_SIZE,
  CHUNK_OVERLAP
};
