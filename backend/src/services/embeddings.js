const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates an embedding vector for a single text string.
 * Uses text-embedding-3-small — cheap, fast, high quality for RAG.
 * 
 * @param {string} text
 * @returns {Promise<number[]>} - 1536-dimensional vector
 */
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // safety trim — model max is 8191 tokens
  });

  return response.data[0].embedding;
}

/**
 * Batch embed multiple texts.
 * OpenAI allows up to 2048 inputs per request; we stay well under that.
 * 
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts) {
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map((t) => t.slice(0, 8000)),
  });

  return response.data.map((item) => item.embedding);
}

/**
 * Format a JS number array as a pgvector literal: '[0.1,0.2,...]'
 */
function vectorToSql(embedding) {
  return `[${embedding.join(',')}]`;
}

module.exports = { embedText, embedBatch, vectorToSql };
