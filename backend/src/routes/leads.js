const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { sendLeadEmail } = require('../services/mailer');

const router = express.Router();

/**
 * POST /lead
 * Captures a lead from the chat widget.
 */
router.post(
  '/',
  apiLimiter,
  [
    body('site_id').isUUID(),
    body('email').isEmail().normalizeEmail(),
    body('name').optional().isString().trim().isLength({ max: 200 }),
    body('message').optional().isString().trim().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, name, email, message } = req.body;

    try {
      // Verify site exists (tenant isolation)
      const siteCheck = await pool.query('SELECT id, company_name FROM sites WHERE id = $1', [site_id]);
      const siteRow = siteCheck.rows[0];
      if (!siteRow) {
        return res.status(404).json({ error: 'Site not found' });
      }

      const leadId = uuidv4();
      await pool.query(
        `INSERT INTO leads (id, site_id, name, email, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [leadId, site_id, name || null, email, message || null]
      );

      // Optional: email notification (SMTP), configured per-site via raffy_overrides.notifications.lead_email
      try {
        const settings = await getEffectiveRaffySettings(site_id);
        const to = settings?.raffy?.notifications?.lead_email ? String(settings.raffy.notifications.lead_email) : '';
        if (to) {
          await sendLeadEmail({
            to,
            siteName: siteRow.company_name,
            lead: { id: leadId, name, email, message },
          });
        }
      } catch (e) {
        console.warn('Lead email notification failed (non-fatal):', e.message);
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Lead capture error:', err);
      return res.status(500).json({ error: 'Failed to save lead' });
    }
  }
);

/**
 * GET /lead/:site_id
 * List leads for a site (admin only).
 * Returns enhanced lead data including phone, issue, scoring.
 */
router.get('/:site_id', adminAuth, async (req, res) => {
  const { site_id } = req.params;
  const { rating, limit = 200 } = req.query;

  try {
    let query = `
      SELECT 
        l.id,
        l.name,
        l.email,
        l.phone,
        l.message,
        l.issue,
        l.location,
        l.lead_score,
        l.lead_rating,
        l.conversation_id,
        l.extraction_json,
        l.extracted_at,
        l.created_at,
        c.visitor_id,
        c.summary as conversation_summary
      FROM leads l
      LEFT JOIN conversations c ON l.conversation_id = c.id
      WHERE l.site_id = $1
    `;

    const params = [site_id];

    // Optional filter by rating
    if (rating && ['HOT', 'WARM', 'COLD'].includes(rating.toUpperCase())) {
      params.push(rating.toUpperCase());
      query += ` AND l.lead_rating = $${params.length}`;
    }

    // Sort: HOT first, then by created_at
    query += `
      ORDER BY 
        CASE l.lead_rating 
          WHEN 'HOT' THEN 1 
          WHEN 'WARM' THEN 2 
          WHEN 'COLD' THEN 3 
          ELSE 4 
        END,
        l.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Get counts by rating
    const countResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE lead_rating = 'HOT') as hot_count,
        COUNT(*) FILTER (WHERE lead_rating = 'WARM') as warm_count,
        COUNT(*) FILTER (WHERE lead_rating = 'COLD') as cold_count,
        COUNT(*) as total_count
       FROM leads
       WHERE site_id = $1`,
      [site_id]
    );

    const counts = countResult.rows[0] || {};

    return res.json({
      leads: result.rows,
      counts: {
        hot: parseInt(counts.hot_count) || 0,
        warm: parseInt(counts.warm_count) || 0,
        cold: parseInt(counts.cold_count) || 0,
        total: parseInt(counts.total_count) || 0,
      },
    });
  } catch (err) {
    console.error('Get leads error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

module.exports = router;
