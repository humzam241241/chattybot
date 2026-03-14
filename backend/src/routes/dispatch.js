const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const dispatchService = require('../services/operations/dispatchService');

router.use(userAuth);

/** GET /api/admin/appointments/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await dispatchService.getAppointmentsBySite(req.params.site_id, {
      technician_id: req.query.technician_id,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 200,
    });
    res.json(list);
  } catch (err) {
    console.error('[dispatch] List appointments error:', err);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

/** GET /api/admin/appointments/:site_id/schedule/:date */
router.get('/:site_id/schedule/:date', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await dispatchService.getScheduleForDay(req.params.site_id, req.params.date);
    res.json(list);
  } catch (err) {
    console.error('[dispatch] Schedule error:', err);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

/** POST /api/admin/appointments/:site_id */
router.post('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const appointment = await dispatchService.createAppointment(req.params.site_id, req.body);
    res.status(201).json(appointment);
  } catch (err) {
    console.error('[dispatch] Create appointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

/** GET /api/admin/appointments/:site_id/:appointment_id */
router.get('/:site_id/:appointment_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const appointment = await dispatchService.getAppointment(
      req.params.appointment_id,
      req.params.site_id
    );
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appointment);
  } catch (err) {
    console.error('[dispatch] Get appointment error:', err);
    res.status(500).json({ error: 'Failed to get appointment' });
  }
});

/** PATCH /api/admin/appointments/:site_id/:appointment_id */
router.patch('/:site_id/:appointment_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const appointment = await dispatchService.updateAppointment(
      req.params.appointment_id,
      req.params.site_id,
      req.body
    );
    res.json(appointment);
  } catch (err) {
    console.error('[dispatch] Update appointment error:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

/** POST /api/admin/appointments/:site_id/:appointment_id/assign */
router.post('/:site_id/:appointment_id/assign', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { technician_id } = req.body;
    const appointment = await dispatchService.assignTechnician(
      req.params.appointment_id,
      req.params.site_id,
      technician_id
    );
    res.json(appointment);
  } catch (err) {
    console.error('[dispatch] Assign error:', err);
    res.status(500).json({ error: 'Failed to assign technician' });
  }
});

/** POST /api/admin/appointments/:site_id/events */
router.post('/:site_id/events', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const event = await dispatchService.createDispatchEvent(req.params.site_id, req.body);
    res.status(201).json(event);
  } catch (err) {
    console.error('[dispatch] Create event error:', err);
    res.status(500).json({ error: 'Failed to create dispatch event' });
  }
});

module.exports = router;
