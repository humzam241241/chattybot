const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { apiLimiter } = require('../middleware/rateLimiter');
const domainVerify = require('../middleware/domainVerify');
const pool = require('../config/database');
const { generateQuote, getQuoteById } = require('../services/quoteGenerator');
const { getEffectiveRaffySettings } = require('../services/raffySettings');

const router = express.Router();

function cleanString(v) {
  const s = String(v || '').trim();
  return s ? s : null;
}

router.post(
  '/',
  apiLimiter,
  domainVerify,
  [
    body('site_id').optional({ nullable: true }).isUUID().withMessage('Valid site_id required'),
    body('serviceType').isString().trim().isLength({ min: 1, max: 120 }),
    body('roofSize').optional({ nullable: true }).isFloat({ min: 1, max: 200000 }),
    body('roofType').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('urgency').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const siteId = req.body.site_id || null;
    const serviceType = req.body.serviceType;
    const roofSize = req.body.roofSize ?? null;
    const roofType = cleanString(req.body.roofType);
    const urgency = cleanString(req.body.urgency) || 'standard';
    const notes = cleanString(req.body.notes);

    try {
      if (siteId) {
        // Basic existence check (domainVerify already handles 404 in prod, but dev skips it)
        const s = await pool.query('SELECT id FROM sites WHERE id = $1', [siteId]);
        if (!s.rows.length) return res.status(404).json({ error: 'Site not found' });
      }

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

    try {
      const quote = await getQuoteById({ quoteId: req.params.quoteId });
      if (!quote) return res.status(404).json({ error: 'Quote not found' });

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

