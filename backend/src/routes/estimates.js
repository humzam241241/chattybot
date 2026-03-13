/**
 * Estimates API Routes
 * Handles estimate generation, approval, and delivery
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const {
  generateAndSaveEstimate,
  getEstimate,
  listEstimates,
  updateEstimateStatus,
} = require('../services/serviceIntelligence/estimateGenerator');
const { sendEstimate, recordCustomerResponse } = require('../services/serviceIntelligence/quoteSender');
const { scheduleFollowUps, cancelFollowUps } = require('../services/serviceIntelligence/followUpScheduler');

/**
 * POST /api/estimates/:site_id
 * Generate an estimate for a service request
 */
router.post('/:site_id', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { requestId, complexityScore, customAdjustments, validDays, notes } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const result = await generateAndSaveEstimate(pool, site_id, requestId, {
      complexityScore,
      customAdjustments,
      validDays,
      notes,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('[estimates] Generate error:', err);
    res.status(500).json({ error: 'Failed to generate estimate' });
  }
});

/**
 * GET /api/estimates/:site_id
 * List estimates for a site
 */
router.get('/:site_id', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { status, limit, offset } = req.query;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const estimates = await listEstimates(pool, site_id, {
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });

    res.json(estimates);
  } catch (err) {
    console.error('[estimates] List error:', err);
    res.status(500).json({ error: 'Failed to list estimates' });
  }
});

/**
 * GET /api/estimates/:site_id/pending
 * List estimates pending approval
 */
router.get('/:site_id/pending', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const estimates = await listEstimates(pool, site_id, { status: 'pending_approval' });
    res.json(estimates);
  } catch (err) {
    console.error('[estimates] Pending error:', err);
    res.status(500).json({ error: 'Failed to list pending estimates' });
  }
});

/**
 * GET /api/estimates/:site_id/:estimate_id
 * Get a specific estimate
 */
router.get('/:site_id/:estimate_id', userAuth, async (req, res) => {
  try {
    const { site_id, estimate_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const estimate = await getEstimate(pool, estimate_id, site_id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json(estimate);
  } catch (err) {
    console.error('[estimates] Get error:', err);
    res.status(500).json({ error: 'Failed to get estimate' });
  }
});

/**
 * POST /api/estimates/:site_id/:estimate_id/approve
 * Approve an estimate
 */
router.post('/:site_id/:estimate_id/approve', userAuth, async (req, res) => {
  try {
    const { site_id, estimate_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const updated = await updateEstimateStatus(pool, estimate_id, site_id, 'approved', req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[estimates] Approve error:', err);
    res.status(500).json({ error: 'Failed to approve estimate' });
  }
});

/**
 * POST /api/estimates/:site_id/:estimate_id/reject
 * Reject an estimate
 */
router.post('/:site_id/:estimate_id/reject', userAuth, async (req, res) => {
  try {
    const { site_id, estimate_id } = req.params;
    const { reason } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const updated = await updateEstimateStatus(pool, estimate_id, site_id, 'rejected', req.user.id, reason);
    if (!updated) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[estimates] Reject error:', err);
    res.status(500).json({ error: 'Failed to reject estimate' });
  }
});

/**
 * POST /api/estimates/:site_id/:estimate_id/send
 * Send an estimate to the customer
 */
router.post('/:site_id/:estimate_id/send', userAuth, async (req, res) => {
  try {
    const { site_id, estimate_id } = req.params;
    const { channel = 'email' } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    // Check estimate is approved
    const estimate = await getEstimate(pool, estimate_id, site_id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (estimate.status !== 'approved' && estimate.status !== 'draft') {
      return res.status(400).json({ error: `Cannot send estimate with status: ${estimate.status}` });
    }

    // If draft, auto-approve first
    if (estimate.status === 'draft') {
      await updateEstimateStatus(pool, estimate_id, site_id, 'approved', req.user.id);
    }

    // Get mailer and twilio client from app context if available
    const mailer = req.app.get('mailer');
    const twilioClient = req.app.get('twilioClient');

    const result = await sendEstimate(pool, estimate_id, site_id, {
      channel,
      mailer,
      twilioClient,
    });

    if (!result.ok) {
      return res.status(400).json({ error: 'Failed to send estimate', details: result.results });
    }

    // Schedule follow-ups
    await scheduleFollowUps(pool, site_id, estimate_id);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[estimates] Send error:', err);
    res.status(500).json({ error: 'Failed to send estimate' });
  }
});

/**
 * POST /api/estimates/:site_id/:estimate_id/response
 * Record customer response to an estimate
 */
router.post('/:site_id/:estimate_id/response', userAuth, async (req, res) => {
  try {
    const { site_id, estimate_id } = req.params;
    const { response, responseText } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!['accept', 'decline'].includes(response)) {
      return res.status(400).json({ error: 'Response must be "accept" or "decline"' });
    }

    const updated = await recordCustomerResponse(pool, estimate_id, site_id, response, responseText);
    if (!updated) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Cancel pending follow-ups if customer responded
    await cancelFollowUps(pool, estimate_id);

    res.json(updated);
  } catch (err) {
    console.error('[estimates] Response error:', err);
    res.status(500).json({ error: 'Failed to record response' });
  }
});

module.exports = router;
