const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const jobService = require('../services/operations/jobService');

router.use(userAuth);

/** GET /api/admin/jobs/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await jobService.getJobsBySite(req.params.site_id, {
      status: req.query.status,
      customer_id: req.query.customer_id,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    });
    res.json(list);
  } catch (err) {
    console.error('[jobs] List error:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/** POST /api/admin/jobs/:site_id */
router.post('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const job = await jobService.createJob(req.params.site_id, req.body);
    res.status(201).json(job);
  } catch (err) {
    console.error('[jobs] Create error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/** POST /api/admin/jobs/:site_id/from-request */
router.post('/:site_id/from-request', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { request_id, ...options } = req.body;
    if (!request_id) return res.status(400).json({ error: 'request_id required' });
    const job = await jobService.convertServiceRequestToJob(req.params.site_id, request_id, options);
    if (!job) return res.status(400).json({ error: 'Could not create job from service request' });
    res.status(201).json(job);
  } catch (err) {
    console.error('[jobs] From-request error:', err);
    res.status(500).json({ error: 'Failed to create job from service request' });
  }
});

/** POST /api/admin/jobs/:site_id/from-estimate */
router.post('/:site_id/from-estimate', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { estimate_id, ...options } = req.body;
    if (!estimate_id) return res.status(400).json({ error: 'estimate_id required' });
    const job = await jobService.convertEstimateToJob(req.params.site_id, estimate_id, options);
    if (!job) return res.status(400).json({ error: 'Could not create job from estimate' });
    res.status(201).json(job);
  } catch (err) {
    console.error('[jobs] From-estimate error:', err);
    res.status(500).json({ error: 'Failed to create job from estimate' });
  }
});

/** POST /api/admin/jobs/:site_id/from-lead */
router.post('/:site_id/from-lead', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { lead_id, ...options } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
    const job = await jobService.convertLeadToJob(req.params.site_id, lead_id, options);
    if (!job) return res.status(400).json({ error: 'Could not create job from lead' });
    res.status(201).json(job);
  } catch (err) {
    console.error('[jobs] From-lead error:', err);
    res.status(500).json({ error: 'Failed to create job from lead' });
  }
});

/** GET /api/admin/jobs/:site_id/:job_id */
router.get('/:site_id/:job_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const job = await jobService.getJob(req.params.job_id, req.params.site_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const tasks = await jobService.getJobTasks(req.params.job_id, req.params.site_id);
    res.json({ ...job, tasks });
  } catch (err) {
    console.error('[jobs] Get error:', err);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/** PATCH /api/admin/jobs/:site_id/:job_id */
router.patch('/:site_id/:job_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const job = await jobService.updateJob(req.params.job_id, req.params.site_id, req.body);
    res.json(job);
  } catch (err) {
    console.error('[jobs] Update error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

/** POST /api/admin/jobs/:site_id/:job_id/tasks */
router.post('/:site_id/:job_id/tasks', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const task = await jobService.addJobTask(req.params.site_id, req.params.job_id, req.body);
    res.status(201).json(task);
  } catch (err) {
    console.error('[jobs] Add task error:', err);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

/** PATCH /api/admin/jobs/:site_id/:job_id/tasks/:task_id */
router.patch('/:site_id/:job_id/tasks/:task_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const task = await jobService.updateJobTask(req.params.task_id, req.params.site_id, req.body);
    res.json(task);
  } catch (err) {
    console.error('[jobs] Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

module.exports = router;
