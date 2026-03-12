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

  const id = uuidv4();
  await pool.query(
    `INSERT INTO conversations (id, site_id, user_phone, visitor_id, current_page_url, summary, message_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '', 0, NOW(), NOW())`,
    [id, siteId, userPhone || null, visitorId || null, currentPageUrl || null]
  );
  return id;
}

async function appendMessage({ conversationId, siteId, role, content }) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO messages (id, conversation_id, site_id, role, content, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, conversationId, siteId, role, content]
  );

  const updated = await pool.query(
    `UPDATE conversations
     SET message_count = message_count + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING message_count, summary`,
    [conversationId]
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

