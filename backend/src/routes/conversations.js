const express = require('express');
const pool = require('../config/database');
const axios = require('axios');
const { query, validationResult } = require('express-validator');
const { apiLimiter } = require('../middleware/rateLimiter');
const { userAuth, requirePaidOrTrial } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const { listConversationsForAdmin } = require('../services/adminConversations');

const router = express.Router();
router.use(apiLimiter);

// GET /api/admin/conversations
// Lists conversations across all accessible sites (admin: all sites; non-admin: owned sites).
router.get(
  '/',
  userAuth,
  requirePaidOrTrial,
  [
    query('site_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    query('q').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 200 }),
    query('limit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 200 }),
    query('offset').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 50000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { site_id, q, limit, offset } = req.query;

    // If caller requests a specific site, enforce site access explicitly.
    if (site_id) {
      const access = await checkSiteAccess(pool, req.user, site_id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });
    }

    const data = await listConversationsForAdmin({
      user: req.user,
      siteId: site_id || null,
      q: q || null,
      limit: limit || 50,
      offset: offset || 0,
    });
    return res.json(data);
  }
);

// GET /api/admin/conversations/:conversation_id/messages/:message_id/media
// Proxies message media (e.g. Twilio URLs that require Basic auth) so the admin can display images.
router.get('/:conversation_id/messages/:message_id/media', userAuth, requirePaidOrTrial, async (req, res) => {
  const { conversation_id, message_id } = req.params;
  try {
    const msgRes = await pool.query(
      `SELECT m.media_url, m.media_content_type, c.site_id
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1 AND m.conversation_id = $2`,
      [message_id, conversation_id]
    );
    if (msgRes.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    const { media_url, media_content_type, site_id } = msgRes.rows[0];
    if (!media_url) return res.status(404).json({ error: 'No media for this message' });

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const isTwilio = media_url.includes('api.twilio.com');
    const opts = { responseType: 'arraybuffer', timeout: 15000 };
    if (isTwilio && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      opts.auth = {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      };
    }
    const proxyRes = await axios.get(media_url, opts);
    const contentType = media_content_type || proxyRes.headers['content-type'] || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(proxyRes.data);
  } catch (err) {
    if (err.response?.status) return res.status(err.response.status).send(err.response.data);
    console.error('[Conversations] Media proxy error:', err.message);
    return res.status(502).json({ error: 'Failed to load media' });
  }
});

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
      `SELECT id, role, content, created_at, media_url, media_content_type
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

