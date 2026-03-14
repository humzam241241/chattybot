const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const invoiceService = require('../services/operations/invoiceService');

router.use(userAuth);

/** GET /api/admin/invoices/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await invoiceService.getInvoicesBySite(req.params.site_id, {
      customer_id: req.query.customer_id,
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    });
    res.json(list);
  } catch (err) {
    console.error('[invoices] List error:', err);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

/** POST /api/admin/invoices/:site_id */
router.post('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { customer_id, job_id, line_items } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id required' });
    const invoice = job_id
      ? await invoiceService.createInvoiceFromJob(req.params.site_id, job_id, customer_id, { line_items })
      : await invoiceService.createInvoice(req.params.site_id, customer_id, { job_id, line_items });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('[invoices] Create error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

/** GET /api/admin/invoices/:site_id/:invoice_id */
router.get('/:site_id/:invoice_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const invoice = await invoiceService.getInvoice(req.params.invoice_id, req.params.site_id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    console.error('[invoices] Get error:', err);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

/** POST /api/admin/invoices/:site_id/:invoice_id/line-items */
router.post('/:site_id/:invoice_id/line-items', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const line = await invoiceService.addInvoiceLineItem(
      req.params.site_id,
      req.params.invoice_id,
      req.body
    );
    res.status(201).json(line);
  } catch (err) {
    console.error('[invoices] Add line item error:', err);
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

/** PATCH /api/admin/invoices/:site_id/:invoice_id/line-items/:line_id */
router.patch('/:site_id/:invoice_id/line-items/:line_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const line = await invoiceService.updateInvoiceLineItem(
      req.params.line_id,
      req.params.site_id,
      req.body
    );
    res.json(line);
  } catch (err) {
    console.error('[invoices] Update line item error:', err);
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

/** POST /api/admin/invoices/:site_id/:invoice_id/send */
router.post('/:site_id/:invoice_id/send', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const invoice = await invoiceService.sendInvoice(req.params.invoice_id, req.params.site_id);
    res.json(invoice);
  } catch (err) {
    console.error('[invoices] Send error:', err);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

/** POST /api/admin/invoices/:site_id/:invoice_id/mark-paid */
router.post('/:site_id/:invoice_id/mark-paid', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const invoice = await invoiceService.markInvoicePaid(req.params.invoice_id, req.params.site_id);
    res.json(invoice);
  } catch (err) {
    console.error('[invoices] Mark paid error:', err);
    res.status(500).json({ error: 'Failed to mark invoice paid' });
  }
});

module.exports = router;
