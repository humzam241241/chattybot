const express = require('express');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');
const { userAuth, requirePaidOrTrial } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');

const router = express.Router();
router.use(apiLimiter);

// GET /api/admin/conversations/site/:site_id
router.get('/site/:site_id', userAuth, requirePaidOrTrial, async (req, res) => {
  const { site_id } = req.params;
  try {
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const result = await pool.query(
      `SELECT *
       FROM conversations
       WHERE site_id = $1
       ORDER BY updated_at DESC`,
      [site_id]
    );
    console.log(`[Conversations] Fetched ${result.rows.length} conversations for site ${site_id}`);
    return res.json({ conversations: result.rows });
  } catch (err) {
    console.error('List conversations error:', err);
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /api/admin/conversations/:conversation_id
router.get('/:conversation_id', userAuth, requirePaidOrTrial, async (req, res) => {
  const { conversation_id } = req.params;
  try {
    const convoRes = await pool.query('SELECT * FROM conversations WHERE id = $1', [conversation_id]);
    if (convoRes.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    const convo = convoRes.rows[0];

    const access = await checkSiteAccess(pool, req.user, convo.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.status === 404 ? 'Conversation not found' : access.error });

    const messagesRes = await pool.query(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 500`,
      [conversation_id]
    );

    return res.json({ conversation: convo, messages: messagesRes.rows });
  } catch (err) {
    console.error('Get conversation error:', err);
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

module.exports = router;

