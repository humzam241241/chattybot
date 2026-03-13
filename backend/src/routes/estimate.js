const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { apiLimiter } = require('../middleware/rateLimiter');
const pool = require('../config/database');
const { generateQuote, getQuoteById } = require('../services/quoteGenerator');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { resolveSiteIdFromHeaders } = require('../services/siteLookup');

const router = express.Router();

function cleanString(v) {
  const s = String(v || '').trim();
  return s ? s : null;
}

router.post(
  '/',
  apiLimiter,
  [
    body('serviceType').isString().trim().isLength({ min: 1, max: 120 }),
    body('roofSize').optional({ nullable: true }).isFloat({ min: 1, max: 200000 }),
    body('roofType').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('urgency').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Endpoint spec doesn't require site_id; we attempt to infer it from Origin/Referer.
    const siteId = await resolveSiteIdFromHeaders(req.headers);
    const serviceType = req.body.serviceType;
    const roofSize = req.body.roofSize ?? null;
    const roofType = cleanString(req.body.roofType);
    const urgency = cleanString(req.body.urgency) || 'standard';
    const notes = cleanString(req.body.notes);

    try {
      // If siteId is inferred, it is guaranteed to exist. Otherwise we run off templates.

      const quote = await generateQuote({
        serviceType,
        roofSize,
        roofType,
        urgency,
        notes,
        siteId,
      });

      let booking_url = null;
      if (siteId) {
        const settings = await getEffectiveRaffySettings(siteId);
        booking_url = settings?.raffy?.booking?.url ? String(settings.raffy.booking.url) : null;
      }

      return res.json({ ...quote, booking_url });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Failed to generate quote' });
    }
  }
);

// Public quote fetch for the customer quote page.
// Supports both: (1) quote id from quotes table, (2) estimate id from estimates table (sent links).
router.get(
  '/:quoteId',
  apiLimiter,
  [
    param('quoteId').isUUID().withMessage('Valid quoteId required'),
    param('quoteId').customSanitizer((v) => String(v || '').trim()),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = req.params.quoteId;

    try {
      let quote = await getQuoteById({ quoteId: id });
      if (!quote) {
        const est = await pool.query(
          `SELECT e.id, e.site_id, e.price_low, e.price_high, e.timeline_days_min, e.timeline_days_max,
                  e.scope_of_work, e.notes, e.job_type
           FROM estimates e WHERE e.id = $1`,
          [id]
        );
        const row = est.rows[0];
        if (!row) return res.status(404).json({ error: 'Quote not found' });
        const timeline =
          row.timeline_days_min != null && row.timeline_days_max != null
            ? `${row.timeline_days_min}-${row.timeline_days_max} days`
            : row.timeline_days_min != null
              ? `${row.timeline_days_min} days`
              : null;
        quote = {
          id: row.id,
          site_id: row.site_id,
          service_type: row.job_type || 'Service estimate',
          price_low: Number(row.price_low),
          price_high: Number(row.price_high),
          timeline_estimate: timeline || 'Varies',
          recommended_service: null,
          roof_type: null,
          urgency: null,
          roof_size: null,
          notes: row.notes || null,
        };
      }

      let booking_url = null;
      const settings = await getEffectiveRaffySettings(quote.site_id);
      booking_url = settings?.raffy?.booking?.url ? String(settings.raffy.booking.url) : null;

      return res.json({ quote, booking_url });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch quote' });
    }
  }
);

module.exports = router;

