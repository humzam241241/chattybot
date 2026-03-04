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
 */
router.get('/:site_id', adminAuth, async (req, res) => {
  const { site_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, email, message, created_at
       FROM leads
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [site_id]
    );

    return res.json({ leads: result.rows });
  } catch (err) {
    console.error('Get leads error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

module.exports = router;
