const pool = require('../config/database');
const { embedText, vectorToSql } = require('./embeddings');

const TOP_K = 5; // Number of context chunks to retrieve

/**
 * Retrieve the most relevant document chunks for a query using cosine similarity.
 * All queries are scoped to site_id for strict tenant isolation.
 * 
 * @param {string} siteId
 * @param {string} query
 * @returns {Promise<string[]>} - Array of content strings
 */
async function retrieveContext(siteId, query) {
  const queryEmbedding = await embedText(query);
  const vectorLiteral = vectorToSql(queryEmbedding);

  // pgvector cosine distance: <=> operator. Lower = more similar.
  const result = await pool.query(
    `SELECT content
     FROM documents
     WHERE site_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [siteId, vectorLiteral, TOP_K]
  );

  return result.rows.map((row) => row.content);
}

/**
 * Build the full system prompt with injected context.
 * 
 * @param {object} site - { company_name, tone, system_prompt }
 * @param {string[]} contextChunks
 * @returns {string}
 */
function buildSystemPrompt(site, contextChunks) {
  const basePrompt = site.system_prompt ||
    `You are the AI assistant for ${site.company_name}. ` +
    `Only answer using the provided company information. ` +
    `If the answer is not found in the context, say: ` +
    `"I'm not sure about that. Would you like me to connect you with the team?"`;

  const contextBlock = contextChunks.length > 0
    ? `\n\n---\nCOMPANY INFORMATION (use only this to answer):\n${contextChunks.join('\n\n---\n')}\n---`
    : '\n\n[No relevant company information was found for this query.]';

  const toneInstruction = site.tone
    ? `\n\nTone: ${site.tone}.`
    : '';

  return basePrompt + toneInstruction + contextBlock;
}

module.exports = { retrieveContext, buildSystemPrompt };
