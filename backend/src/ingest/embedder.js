/**
 * OpenAI embedding generation with batch processing and retry logic.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'text-embedding-3-small';
const MAX_INPUT = 8000;
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

async function embedBatch(texts, attempt = 0) {
  if (!texts.length) return [];
  try {
    const res = await openai.embeddings.create({
      model: MODEL,
      input: texts.map(t => String(t).slice(0, MAX_INPUT)),
    });
    return res.data.map(d => d.embedding);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`[Embedder] Retry ${attempt + 1}/${MAX_RETRIES} (${wait}ms): ${err.message}`);
      await new Promise(r => setTimeout(r, wait));
      return embedBatch(texts, attempt + 1);
    }
    throw err;
  }
}

/**
 * Embeds all chunks in batches of BATCH_SIZE.
 * Returns [{chunk, embedding}, …]
 */
async function embedChunks(chunks) {
  console.log(`[Embedder] Embedding ${chunks.length} chunks`);
  const results = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch);
    for (let j = 0; j < batch.length; j++) {
      results.push({ chunk: batch[j], embedding: embeddings[j] });
    }
    console.log(`[Embedder] Progress: ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);
  }

  return results;
}

function vectorToSql(emb) {
  return `[${emb.join(',')}]`;
}

module.exports = { embedBatch, embedChunks, vectorToSql, BATCH_SIZE };
