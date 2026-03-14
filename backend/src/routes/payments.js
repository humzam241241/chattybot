const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const paymentService = require('../services/operations/paymentService');

router.use(userAuth);

/** GET /api/admin/payments/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await paymentService.getPaymentsBySite(req.params.site_id, {
      customer_id: req.query.customer_id,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    });
    res.json(list);
  } catch (err) {
    console.error('[payments] List error:', err);
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

/** GET /api/admin/payments/:site_id/invoice/:invoice_id */
router.get('/:site_id/invoice/:invoice_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await paymentService.getPaymentsByInvoice(
      req.params.invoice_id,
      req.params.site_id
    );
    res.json(list);
  } catch (err) {
    console.error('[payments] By invoice error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

/** POST /api/admin/payments/:site_id */
router.post('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { invoice_id, amount, payment_method, paid_at, notes, stripe_payment_intent_id } = req.body;
    if (!invoice_id || amount == null) {
      return res.status(400).json({ error: 'invoice_id and amount required' });
    }
    const payment = await paymentService.recordPayment(req.params.site_id, invoice_id, {
      amount,
      payment_method,
      paid_at,
      notes,
      stripe_payment_intent_id,
    });
    res.status(201).json(payment);
  } catch (err) {
    console.error('[payments] Record error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
