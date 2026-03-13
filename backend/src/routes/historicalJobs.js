/**
 * Historical Jobs API Routes
 * Handles recording and querying completed jobs for pricing intelligence
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const {
  getHistoricalJobs,
  calculateJobStats,
  recordCompletedJob,
} = require('../services/serviceIntelligence/priceEstimator');

/**
 * POST /api/historical-jobs/:site_id
 * Record a completed job
 */
router.post('/:site_id', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const {
      industryId,
      jobType,
      projectSize,
      complexityScore,
      laborHours,
      materialCost,
      finalPrice,
      scopeCreepCost,
      city,
      state,
      zipCode,
      customerSatisfaction,
      notes,
      completedAt,
    } = req.body;

    if (!industryId || !jobType || !finalPrice) {
      return res.status(400).json({ error: 'Industry ID, job type, and final price are required' });
    }

    const job = await recordCompletedJob(pool, site_id, {
      industryId,
      jobType,
      projectSize,
      complexityScore,
      laborHours,
      materialCost,
      finalPrice,
      scopeCreepCost,
      city,
      state,
      zipCode,
      customerSatisfaction,
      notes,
      completedAt,
    });

    res.status(201).json(job);
  } catch (err) {
    console.error('[historicalJobs] Record error:', err);
    res.status(500).json({ error: 'Failed to record job' });
  }
});

/**
 * GET /api/historical-jobs/:site_id
 * List historical jobs for a site
 */
router.get('/:site_id', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { industryId, jobType, city, state, limit } = req.query;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const jobs = await getHistoricalJobs(pool, site_id, {
      industryId,
      jobType,
      city,
      state,
      limit: parseInt(limit) || 50,
    });

    res.json(jobs);
  } catch (err) {
    console.error('[historicalJobs] List error:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /api/historical-jobs/:site_id/stats
 * Get statistics for historical jobs
 */
router.get('/:site_id/stats', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { industryId, jobType, city, state } = req.query;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const jobs = await getHistoricalJobs(pool, site_id, {
      industryId,
      jobType,
      city,
      state,
      limit: 1000,
    });

    const stats = calculateJobStats(jobs);
    res.json(stats || { count: 0 });
  } catch (err) {
    console.error('[historicalJobs] Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * DELETE /api/historical-jobs/:site_id/:job_id
 * Delete a historical job record
 */
router.delete('/:site_id/:job_id', userAuth, async (req, res) => {
  try {
    const { site_id, job_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await pool.query(
      'DELETE FROM historical_jobs WHERE id = $1 AND site_id = $2 RETURNING id',
      [job_id, site_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('[historicalJobs] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

/**
 * POST /api/historical-jobs/:site_id/import
 * Bulk import historical jobs
 */
router.post('/:site_id/import', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { jobs } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'Jobs array is required' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < jobs.length; i++) {
      try {
        const job = await recordCompletedJob(pool, site_id, jobs[i]);
        results.push(job);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    res.json({
      imported: results.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[historicalJobs] Import error:', err);
    res.status(500).json({ error: 'Failed to import jobs' });
  }
});

module.exports = router;
