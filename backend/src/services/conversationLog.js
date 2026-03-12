const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function getOrCreateConversation({ siteId, visitorId, conversationId, currentPageUrl, userPhone }) {
  if (conversationId) {
    const existing = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND site_id = $2',
      [conversationId, siteId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE conversations SET updated_at = NOW(), current_page_url = COALESCE($1, current_page_url) WHERE id = $2',
        [currentPageUrl || null, conversationId]
      );
      return conversationId;
    }
  }
  // IMPORTANT: Do not create conversations in shared services.
  // Conversation creation is handled by entrypoint routes (e.g. web chat, Twilio webhook).
  return null;
}

async function appendMessage({ conversationId, siteId, role, content, mediaUrl, mediaContentType }) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO messages (id, conversation_id, site_id, role, content, media_url, media_content_type, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [id, conversationId, siteId, role, content, mediaUrl || null, mediaContentType || null]
  );

  const updated = await pool.query(
    `UPDATE conversations
     SET message_count = message_count + 1,
         updated_at = NOW()
     WHERE id = $1
       AND site_id = $2
     RETURNING message_count, summary`,
    [conversationId, siteId]
  );

  return {
    message_count: updated.rows[0].message_count,
    summary: updated.rows[0].summary,
  };
}

async function getMisunderstoodCount({ conversationId, siteId }) {
  const r = await pool.query(
    `SELECT misunderstood_count
     FROM conversations
     WHERE id = $1 AND site_id = $2`,
    [conversationId, siteId]
  );
  return r.rows?.[0]?.misunderstood_count ?? 0;
}

async function setMisunderstoodCount({ conversationId, siteId, misunderstoodCount }) {
  await pool.query(
    `UPDATE conversations
     SET misunderstood_count = $3::int,
         misunderstood_updated_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND site_id = $2`,
    [conversationId, siteId, misunderstoodCount]
  );
}

async function getRecentMessages(conversationId, limit = 12) {
  const res = await pool.query(
    `SELECT role, content
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  return res.rows.reverse();
}

async function updateConversationSummary(conversationId, summary) {
  await pool.query('UPDATE conversations SET summary = $1, updated_at = NOW() WHERE id = $2', [summary, conversationId]);
}

module.exports = {
  getOrCreateConversation,
  appendMessage,
  getMisunderstoodCount,
  setMisunderstoodCount,
  getRecentMessages,
  updateConversationSummary,
};

