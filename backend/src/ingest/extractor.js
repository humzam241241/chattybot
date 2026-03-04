/**
 * Content extraction and quality filtering module.
 * Ensures only meaningful text is sent to the chunker / embedder.
 */

const MAX_TEXT_LENGTH = 50000;

/**
 * Validates that extracted text is worth embedding.
 */
function validateContent(text) {
  const trimmed = text.trim();

  if (trimmed.length < 100) {
    return { valid: false, reason: `Too short (${trimmed.length} chars)` };
  }

  // Spam / repetition check
  const words = trimmed.split(/\s+/);
  if (words.length > 80) {
    const uniqueRatio = new Set(words.map(w => w.toLowerCase())).size / words.length;
    if (uniqueRatio < 0.25) {
      return { valid: false, reason: 'Excessive repetition' };
    }
  }

  return { valid: true };
}

/**
 * Normalises whitespace and enforces length cap.
 */
function normalizeText(text) {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > MAX_TEXT_LENGTH ? cleaned.slice(0, MAX_TEXT_LENGTH) : cleaned;
}

/**
 * Full processing pipeline: normalise → validate.
 */
function processExtractedContent(text, url) {
  const normalized = normalizeText(text);
  const validation = validateContent(normalized);

  if (!validation.valid) {
    return { success: false, reason: validation.reason, text: null };
  }

  return { success: true, text: normalized };
}

module.exports = { validateContent, normalizeText, processExtractedContent };
