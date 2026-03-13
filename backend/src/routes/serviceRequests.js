/**
 * Service Requests API Routes
 * Handles service request intake, classification, and management
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const {
  createServiceRequest,
  updateServiceRequest,
  getServiceRequest,
  listServiceRequests,
  extractRequestData,
  classifyServiceRequest,
  processIntakeFromChat,
} = require('../services/serviceIntelligence');

/**
 * POST /api/service-requests/:site_id
 * Create a new service request
 */
router.post('/:site_id', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const {
      conversationId,
      leadId,
      customerName,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      industryId,
      problemDescription,
      attachments,
      urgencyLevel,
      preferredContactMethod,
      preferredSchedule,
      source,
    } = req.body;

    if (!problemDescription) {
      return res.status(400).json({ error: 'Problem description is required' });
    }

    const request = await createServiceRequest(pool, site_id, {
      conversationId,
      leadId,
      customerName,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      industryId,
      problemDescription,
      attachments,
      urgencyLevel,
      preferredContactMethod,
      preferredSchedule,
      source,
    });

    res.status(201).json(request);
  } catch (err) {
    console.error('[serviceRequests] Create error:', err);
    res.status(500).json({ error: 'Failed to create service request' });
  }
});

/**
 * GET /api/service-requests/:site_id
 * List service requests for a site
 */
router.get('/:site_id', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { status, limit, offset } = req.query;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const requests = await listServiceRequests(pool, site_id, {
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });

    res.json(requests);
  } catch (err) {
    console.error('[serviceRequests] List error:', err);
    res.status(500).json({ error: 'Failed to list service requests' });
  }
});

/**
 * GET /api/service-requests/:site_id/:request_id
 * Get a specific service request
 */
router.get('/:site_id/:request_id', userAuth, async (req, res) => {
  try {
    const { site_id, request_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const request = await getServiceRequest(pool, request_id, site_id);
    if (!request) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    res.json(request);
  } catch (err) {
    console.error('[serviceRequests] Get error:', err);
    res.status(500).json({ error: 'Failed to get service request' });
  }
});

/**
 * PATCH /api/service-requests/:site_id/:request_id
 * Update a service request
 */
router.patch('/:site_id/:request_id', userAuth, async (req, res) => {
  try {
    const { site_id, request_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const updated = await updateServiceRequest(pool, request_id, site_id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Service request not found or no valid updates' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[serviceRequests] Update error:', err);
    res.status(500).json({ error: 'Failed to update service request' });
  }
});

/**
 * POST /api/service-requests/:site_id/:request_id/classify
 * Classify a service request
 */
router.post('/:site_id/:request_id/classify', userAuth, async (req, res) => {
  try {
    const { site_id, request_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await classifyServiceRequest(pool, request_id, site_id);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('[serviceRequests] Classify error:', err);
    res.status(500).json({ error: 'Failed to classify service request' });
  }
});

/**
 * POST /api/service-requests/:site_id/extract
 * Extract structured data from a message (without creating a request)
 */
router.post('/:site_id/extract', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { message, context } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await extractRequestData(message, context || {});
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.data);
  } catch (err) {
    console.error('[serviceRequests] Extract error:', err);
    res.status(500).json({ error: 'Failed to extract request data' });
  }
});

/**
 * POST /api/service-requests/:site_id/from-chat
 * Create a service request from a chat conversation
 */
router.post('/:site_id/from-chat', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const { conversationId, messages, leadData } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const result = await processIntakeFromChat(pool, site_id, conversationId, messages, leadData || {});
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('[serviceRequests] From-chat error:', err);
    res.status(500).json({ error: 'Failed to create service request from chat' });
  }
});

/**
 * POST /api/service-requests/:site_id/extract-from-chats
 * Bulk: create service requests from all conversations that have user messages
 * and don't already have a service request. Populates Service Requests (and
 * later Estimates/Analytics) from existing chat data.
 */
router.post('/:site_id/extract-from-chats', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const limit = Math.min(parseInt(req.body.limit, 10) || 100, 200);

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const convosRes = await pool.query(
      `SELECT id FROM conversations WHERE site_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [site_id, limit]
    );

    const created = [];
    const skipped = [];
    const errors = [];

    for (const row of convosRes.rows) {
      const conversationId = row.id;

      const existingSr = await pool.query(
        `SELECT id FROM service_requests WHERE site_id = $1 AND conversation_id = $2`,
        [site_id, conversationId]
      );
      if (existingSr.rows.length > 0) {
        skipped.push({ conversationId, reason: 'already_has_request' });
        continue;
      }

      const msgRes = await pool.query(
        `SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`,
        [conversationId]
      );
      const messages = msgRes.rows.map((m) => ({
        role: m.role,
        content: m.content || '',
      }));
      const userMessages = messages.filter((m) => m.role === 'user');
      if (userMessages.length === 0) {
        skipped.push({ conversationId, reason: 'no_user_messages' });
        continue;
      }

      let leadData = {};
      const leadRes = await pool.query(
        `SELECT id, name, email, phone, issue FROM leads WHERE conversation_id = $1 LIMIT 1`,
        [conversationId]
      );
      if (leadRes.rows.length > 0) {
        const l = leadRes.rows[0];
        leadData = { id: l.id, name: l.name, email: l.email, phone: l.phone, issue: l.issue };
      }

      try {
        const result = await processIntakeFromChat(pool, site_id, conversationId, messages, leadData);
        if (result.ok) {
          created.push({ conversationId, requestId: result.request.id });
        } else {
          errors.push({ conversationId, error: result.error });
        }
      } catch (err) {
        errors.push({ conversationId, error: err.message || 'Unknown error' });
      }
    }

    return res.json({
      totalConversationsChecked: convosRes.rows.length,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { created, skipped, errors },
    });
  } catch (err) {
    console.error('[serviceRequests] Extract-from-chats error:', err);
    res.status(500).json({ error: 'Failed to extract from chats' });
  }
});

module.exports = router;
