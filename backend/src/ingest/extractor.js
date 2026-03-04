/**
 * Content extraction and quality filtering module
 * Ensures only high-quality, relevant text is used for embeddings
 */

const MAX_TEXT_LENGTH = 50000; // Safety cap per page

/**
 * Validates extracted text meets quality standards
 */
function validateContent(text, url) {
  const trimmed = text.trim();
  
  // Minimum length check
  if (trimmed.length < 200) {
    return {
      valid: false,
      reason: `Insufficient content (${trimmed.length} chars)`
    };
  }
  
  // Error page detection
  const textLower = trimmed.toLowerCase();
  const errorPatterns = [
    '404',
    'not found',
    'page not found',
    'error',
    'page unavailable',
    'access denied',
    'forbidden'
  ];
  
  const hasErrorPattern = errorPatterns.some(pattern => textLower.includes(pattern));
  if (hasErrorPattern && trimmed.length < 1000) {
    return {
      valid: false,
      reason: 'Appears to be error page'
    };
  }
  
  // Check for excessive repetition (spam detection)
  const words = trimmed.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniqueRatio = uniqueWords.size / words.length;
  
  if (uniqueRatio < 0.3 && words.length > 100) {
    return {
      valid: false,
      reason: 'Excessive repetition detected'
    };
  }
  
  return { valid: true };
}

/**
 * Normalizes text by removing excessive whitespace and applying length limits
 */
function normalizeText(text) {
  if (!text) return '';
  
  const cleaned = text
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive newlines
    .trim();
  
  // Apply safety cap
  return cleaned.length > MAX_TEXT_LENGTH 
    ? cleaned.slice(0, MAX_TEXT_LENGTH) 
    : cleaned;
}

/**
 * Extracts metadata from text (for future enhancement)
 */
function extractMetadata(text, url) {
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  const avgWordLength = charCount / wordCount;
  
  return {
    url,
    wordCount,
    charCount,
    avgWordLength: Math.round(avgWordLength * 100) / 100,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Main extraction function that validates, normalizes, and enriches content
 */
function processExtractedContent(text, url) {
  // Normalize first
  const normalized = normalizeText(text);
  
  // Validate quality
  const validation = validateContent(normalized, url);
  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      text: null,
      metadata: null
    };
  }
  
  // Extract metadata
  const metadata = extractMetadata(normalized, url);
  
  return {
    success: true,
    text: normalized,
    metadata
  };
}

module.exports = {
  validateContent,
  normalizeText,
  extractMetadata,
  processExtractedContent
};
