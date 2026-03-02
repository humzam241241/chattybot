const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');

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
      const siteCheck = await pool.query('SELECT id FROM sites WHERE id = $1', [site_id]);
      if (siteCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Site not found' });
      }

      await pool.query(
        `INSERT INTO leads (id, site_id, name, email, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), site_id, name || null, email, message || null]
      );

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
