const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const technicianService = require('../services/operations/technicianService');

router.use(userAuth);

/** GET /api/admin/technicians/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await technicianService.getTechnicians(
      req.params.site_id,
      req.query.active === 'true'
    );
    res.json(list);
  } catch (err) {
    console.error('[technicians] List error:', err);
    res.status(500).json({ error: 'Failed to list technicians' });
  }
});

/** POST /api/admin/technicians/:site_id */
router.post('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const tech = await technicianService.createTechnician(req.params.site_id, req.body);
    res.status(201).json(tech);
  } catch (err) {
    console.error('[technicians] Create error:', err);
    res.status(500).json({ error: 'Failed to create technician' });
  }
});

/** GET /api/admin/technicians/:site_id/:technician_id */
router.get('/:site_id/:technician_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const tech = await technicianService.getTechnician(req.params.technician_id, req.params.site_id);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    res.json(tech);
  } catch (err) {
    console.error('[technicians] Get error:', err);
    res.status(500).json({ error: 'Failed to get technician' });
  }
});

/** PATCH /api/admin/technicians/:site_id/:technician_id */
router.patch('/:site_id/:technician_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const tech = await technicianService.updateTechnician(
      req.params.technician_id,
      req.params.site_id,
      req.body
    );
    res.json(tech);
  } catch (err) {
    console.error('[technicians] Update error:', err);
    res.status(500).json({ error: 'Failed to update technician' });
  }
});

module.exports = router;
