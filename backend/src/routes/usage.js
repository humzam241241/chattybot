const express = require('express');
const pool = require('../config/database');
const { userAuth, requirePaidOrTrial } = require('../middleware/userAuth');
const { getUsage } = require('../services/usageService');
const { checkSiteAccess } = require('../services/siteAccess');

const router = express.Router();

// Dashboard usage endpoint (auth required)
router.get('/:site_id', userAuth, requirePaidOrTrial, async (req, res) => {
  const siteId = req.params.site_id;

  try {
    const access = await checkSiteAccess(pool, req.user, siteId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

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

