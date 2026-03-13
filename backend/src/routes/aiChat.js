/**
 * AI Chat Routes
 * Unified endpoint for the Universal Service Intelligence Engine
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const serviceIntelligence = require('../services/serviceIntelligence');

/**
 * Process a chat message through all AI layers
 * POST /api/ai-chat/:site_id/message
 */
router.post('/:site_id/message', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { message, conversation_id, message_id } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get site config
    const siteResult = await pool.query(
      `SELECT id, name, settings FROM sites WHERE id = $1`,
      [site_id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];

    // Get conversation history if conversation_id provided
    let conversationHistory = [];
    if (conversation_id) {
      const historyResult = await pool.query(
        `SELECT role, content FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT 20`,
        [conversation_id]
      );
      conversationHistory = historyResult.rows;
    }

    // Process through orchestrator
    const result = await serviceIntelligence.processMessage(
      pool,
      site_id,
      message,
      {
        conversationId: conversation_id,
        messageId: message_id,
        conversationHistory,
        siteConfig: {
          name: site.name,
          ...site.settings,
        },
      }
    );

    res.json({
      ok: true,
      response: result.response,
      stage: result.stage,
      intent: result.intent ? {
        intent: result.intent.intent,
        confidence: result.intent.confidence,
        urgency: result.intent.urgencyDetected,
      } : null,
      classification: result.classification ? {
        jobType: result.classification.jobType,
        industry: result.classification.industry,
        confidence: result.classification.confidence,
      } : null,
      estimate: result.estimate ? {
        priceLow: result.estimate.price_low,
        priceHigh: result.estimate.price_high,
        timelineDays: result.estimate.timeline_days,
        confidence: result.estimate.confidence_level,
      } : null,
      actions: result.actions,
    });
  } catch (err) {
    console.error('[aiChat] Message processing error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Detect intent only (for quick classification)
 * POST /api/ai-chat/:site_id/intent
 */
router.post('/:site_id/intent', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { message, conversation_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await serviceIntelligence.processIntent(
      pool,
      site_id,
      message,
      { conversationId: conversation_id }
    );

    res.json({
      ok: true,
      intent: result.intent,
      confidence: result.confidence,
      subIntents: result.subIntents,
      urgency: result.urgencyDetected,
      sentiment: result.sentiment,
    });
  } catch (err) {
    console.error('[aiChat] Intent detection error:', err);
    res.status(500).json({ error: 'Failed to detect intent' });
  }
});

/**
 * Get conversation context and summary
 * GET /api/ai-chat/:site_id/conversation/:conversation_id/summary
 */
router.get('/:site_id/conversation/:conversation_id/summary', userAuth, async (req, res) => {
  try {
    const { site_id, conversation_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    // Verify conversation belongs to site
    const convResult = await pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND site_id = $2`,
      [conversation_id, site_id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const summary = await serviceIntelligence.getConversationSummary(pool, conversation_id);

    res.json({ ok: true, summary });
  } catch (err) {
    console.error('[aiChat] Summary error:', err);
    res.status(500).json({ error: 'Failed to get conversation summary' });
  }
});

/**
 * Get recent intents for analytics
 * GET /api/ai-chat/:site_id/intents
 */
router.get('/:site_id/intents', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { limit = 50, offset = 0, intent } = req.query;

    let query = `
      SELECT ai.*, c.id as conv_id
      FROM ai_intents ai
      LEFT JOIN conversations c ON ai.conversation_id = c.id
      WHERE ai.site_id = $1
    `;
    const params = [site_id];
    let paramIndex = 2;

    if (intent) {
      query += ` AND ai.intent = $${paramIndex}`;
      params.push(intent);
      paramIndex++;
    }

    query += ` ORDER BY ai.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_intents WHERE site_id = $1`,
      [site_id]
    );

    res.json({
      ok: true,
      intents: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('[aiChat] Intents list error:', err);
    res.status(500).json({ error: 'Failed to list intents' });
  }
});

/**
 * Get recent classifications for analytics
 * GET /api/ai-chat/:site_id/classifications
 */
router.get('/:site_id/classifications', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { limit = 50, offset = 0, job_type, industry } = req.query;

    let query = `
      SELECT ac.*, i.name as industry_name
      FROM ai_classifications ac
      LEFT JOIN industries i ON ac.industry_id = i.id
      WHERE ac.site_id = $1
    `;
    const params = [site_id];
    let paramIndex = 2;

    if (job_type) {
      query += ` AND ac.job_type = $${paramIndex}`;
      params.push(job_type);
      paramIndex++;
    }

    if (industry) {
      query += ` AND ac.industry_slug = $${paramIndex}`;
      params.push(industry);
      paramIndex++;
    }

    query += ` ORDER BY ac.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_classifications WHERE site_id = $1`,
      [site_id]
    );

    res.json({
      ok: true,
      classifications: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('[aiChat] Classifications list error:', err);
    res.status(500).json({ error: 'Failed to list classifications' });
  }
});

/**
 * Get intent analytics summary
 * GET /api/ai-chat/:site_id/analytics/intents
 */
router.get('/:site_id/analytics/intents', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        intent,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
       FROM ai_intents
       WHERE site_id = $1
         AND created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY intent
       ORDER BY count DESC`,
      [site_id, parseInt(days)]
    );

    res.json({
      ok: true,
      analytics: result.rows,
      period_days: parseInt(days),
    });
  } catch (err) {
    console.error('[aiChat] Intent analytics error:', err);
    res.status(500).json({ error: 'Failed to get intent analytics' });
  }
});

/**
 * Get classification analytics summary
 * GET /api/ai-chat/:site_id/analytics/classifications
 */
router.get('/:site_id/analytics/classifications', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        job_type,
        industry_slug,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        SUM(CASE WHEN needs_more_info THEN 1 ELSE 0 END) as needs_more_info_count
       FROM ai_classifications
       WHERE site_id = $1
         AND created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY job_type, industry_slug
       ORDER BY count DESC`,
      [site_id, parseInt(days)]
    );

    res.json({
      ok: true,
      analytics: result.rows,
      period_days: parseInt(days),
    });
  } catch (err) {
    console.error('[aiChat] Classification analytics error:', err);
    res.status(500).json({ error: 'Failed to get classification analytics' });
  }
});

module.exports = router;
