const express = require('express');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * GET /site-config/:site_id
 * 
 * Public endpoint called by the widget on load to fetch branding config.
 * Only exposes non-sensitive fields — no system prompt, no internal data.
 */
router.get('/:site_id', apiLimiter, async (req, res) => {
  const { site_id } = req.params;

  // Basic UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(site_id)) {
    return res.status(400).json({ error: 'Invalid site_id' });
  }

  try {
    const result = await pool.query(
      'SELECT id, company_name, primary_color, tone FROM sites WHERE id = $1',
      [site_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    return res.json({ config: result.rows[0] });
  } catch (err) {
    console.error('Site config error:', err);
    return res.status(500).json({ error: 'Failed to fetch config' });
  }
});

module.exports = router;
