const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const pipelineAnalyticsService = require('../services/operations/pipelineAnalyticsService');

router.use(userAuth);

/** GET /api/admin/pipeline/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const summary = await pipelineAnalyticsService.getPipelineSummary(req.params.site_id, {
      from_date: req.query.from_date,
      to_date: req.query.to_date,
    });
    res.json(summary);
  } catch (err) {
    console.error('[pipeline] Summary error:', err);
    res.status(500).json({ error: 'Failed to get pipeline summary' });
  }
});

/** GET /api/admin/pipeline/:site_id/lead-conversion */
router.get('/:site_id/lead-conversion', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const from = req.query.from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = req.query.to_date || new Date().toISOString().slice(0, 10);
    const data = await pipelineAnalyticsService.calculateLeadConversion(req.params.site_id, from, to);
    res.json(data);
  } catch (err) {
    console.error('[pipeline] Lead conversion error:', err);
    res.status(500).json({ error: 'Failed to get lead conversion' });
  }
});

/** GET /api/admin/pipeline/:site_id/revenue */
router.get('/:site_id/revenue', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const from = req.query.from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = req.query.to_date || new Date().toISOString().slice(0, 10);
    const data = await pipelineAnalyticsService.calculateRevenue(req.params.site_id, from, to);
    res.json(data);
  } catch (err) {
    console.error('[pipeline] Revenue error:', err);
    res.status(500).json({ error: 'Failed to get revenue' });
  }
});

/** GET /api/admin/pipeline/:site_id/average-job-value */
router.get('/:site_id/average-job-value', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const from = req.query.from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = req.query.to_date || new Date().toISOString().slice(0, 10);
    const data = await pipelineAnalyticsService.calculateAverageJobValue(req.params.site_id, from, to);
    res.json(data);
  } catch (err) {
    console.error('[pipeline] Average job value error:', err);
    res.status(500).json({ error: 'Failed to get average job value' });
  }
});

module.exports = router;
