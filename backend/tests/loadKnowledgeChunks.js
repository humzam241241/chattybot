/**
 * Load knowledge chunks from the documents table for RAG evaluation
 * 
 * This module retrieves ingested knowledge chunks for a given site
 * to generate test questions and validate chatbot responses.
 */

const pool = require('../src/config/database');

/**
 * Retrieve knowledge chunks for a specific site
 * @param {string} siteId - Site UUID
 * @param {number} limit - Maximum number of chunks to retrieve (default 200)
 * @returns {Promise<Array<{content: string, source_type?: string, source_id?: string}>>}
 */
async function getKnowledgeChunks(siteId, limit = 200) {
  if (!siteId) {
    throw new Error('site_id is required');
  }

  try {
    const result = await pool.query(
      `SELECT content, source_type, source_id, created_at
       FROM documents
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [siteId, limit]
    );

    if (result.rows.length === 0) {
      console.warn(`[loadKnowledgeChunks] No documents found for site ${siteId}`);
      return [];
    }

    console.log(`[loadKnowledgeChunks] Loaded ${result.rows.length} chunks for site ${siteId}`);

    return result.rows.map((row) => ({
      content: row.content || '',
      source_type: row.source_type || 'website',
      source_id: row.source_id,
    }));
  } catch (err) {
    console.error('[loadKnowledgeChunks] Database error:', err);
    throw new Error(`Failed to load knowledge chunks: ${err.message}`);
  }
}

module.exports = { getKnowledgeChunks };
