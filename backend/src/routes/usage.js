const express = require('express');
const pool = require('../config/database');
const { userAuth, requirePaidOrTrial } = require('../middleware/userAuth');
const { getUsage } = require('../services/usageService');

const router = express.Router();

// Dashboard usage endpoint (auth required)
router.get('/:site_id', userAuth, requirePaidOrTrial, async (req, res) => {
  const siteId = req.params.site_id;

  try {
    // Ownership enforcement
    if (!req.isAdmin && req.ownerId) {
      const r = await pool.query(`SELECT id FROM sites WHERE id = $1 AND owner_id = $2`, [siteId, req.ownerId]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Site not found' });
    }

    const usage = await getUsage(siteId);
    if (!usage) return res.status(404).json({ error: 'Site not found' });

    return res.json(usage);
  } catch (err) {
    console.error('[UsageAPI] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// Back-compat: GET /api/usage?site_id=...
router.get('/', userAuth, requirePaidOrTrial, async (req, res) => {
  const siteId = req.query.site_id;
  if (!siteId) return res.status(400).json({ error: 'site_id is required' });
  req.params.site_id = siteId;
  return router.handle(req, res);
});

module.exports = router;

