/**
 * Embedding module with batch processing and retry logic
 * Handles OpenAI API calls for generating text embeddings
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_INPUT_LENGTH = 8000; // OpenAI max is 8191 tokens
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

/**
 * Generates embedding for a single text with retry logic
 */
async function embedTextWithRetry(text, retries = 0) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, MAX_INPUT_LENGTH)
    });
    
    return response.data[0].embedding;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const backoffMs = Math.pow(2, retries) * 1000;
      console.warn(`[Embedder] Retry ${retries + 1}/${MAX_RETRIES} after ${backoffMs}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return embedTextWithRetry(text, retries + 1);
    }
    throw new Error(`Failed to generate embedding after ${MAX_RETRIES} retries: ${error.message}`);
  }
}

/**
 * Batch embeds multiple texts with retry logic
 * Automatically splits into smaller batches if needed
 */
async function embedBatch(texts, retries = 0) {
  if (!texts || texts.length === 0) return [];
  
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts.map(t => String(t).slice(0, MAX_INPUT_LENGTH))
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    // If batch is too large, split it
    if (error.message?.includes('too many') && texts.length > 1) {
      console.warn(`[Embedder] Batch too large, splitting ${texts.length} texts`);
      const mid = Math.floor(texts.length / 2);
      const firstHalf = await embedBatch(texts.slice(0, mid));
      const secondHalf = await embedBatch(texts.slice(mid));
      return [...firstHalf, ...secondHalf];
    }
    
    // Retry with exponential backoff
    if (retries < MAX_RETRIES) {
      const backoffMs = Math.pow(2, retries) * 1000;
      console.warn(`[Embedder] Retry batch ${retries + 1}/${MAX_RETRIES} after ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return embedBatch(texts, retries + 1);
    }
    
    throw new Error(`Failed to generate batch embeddings after ${MAX_RETRIES} retries: ${error.message}`);
  }
}

/**
 * Processes chunks in batches and generates embeddings
 * Returns array of {chunk, embedding} objects
 */
async function embedChunks(chunks, batchSize = BATCH_SIZE) {
  console.log(`[Embedder] Embedding ${chunks.length} chunks in batches of ${batchSize}`);
  
  const results = [];
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch);
    
    for (let j = 0; j < batch.length; j++) {
      results.push({
        chunk: batch[j],
        embedding: embeddings[j]
      });
    }
    
    console.log(`[Embedder] Progress: ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks embedded`);
  }
  
  return results;
}

/**
 * Formats embedding vector as pgvector SQL literal
 */
function vectorToSql(embedding) {
  return `[${embedding.join(',')}]`;
}

/**
 * Validates embedding vector
 */
function validateEmbedding(embedding) {
  if (!Array.isArray(embedding)) return false;
  if (embedding.length !== 1536) return false; // text-embedding-3-small dimension
  if (embedding.some(n => typeof n !== 'number' || isNaN(n))) return false;
  return true;
}

module.exports = {
  embedTextWithRetry,
  embedBatch,
  embedChunks,
  vectorToSql,
  validateEmbedding,
  EMBEDDING_MODEL,
  BATCH_SIZE
};
