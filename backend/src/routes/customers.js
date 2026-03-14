const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const customerService = require('../services/operations/customerService');

router.use(userAuth);

/** GET /api/admin/customers/:site_id */
router.get('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const list = await customerService.getCustomersBySite(req.params.site_id, {
      q: req.query.q,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    });
    res.json(list);
  } catch (err) {
    console.error('[customers] List error:', err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

/** POST /api/admin/customers/:site_id */
router.post('/:site_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const customer = await customerService.createCustomer(req.params.site_id, req.body);
    res.status(201).json(customer);
  } catch (err) {
    console.error('[customers] Create error:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/** POST /api/admin/customers/:site_id/import-from-leads */
router.post('/:site_id/import-from-leads', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const result = await customerService.importCustomersFromLeads(req.params.site_id);
    res.json(result);
  } catch (err) {
    console.error('[customers] Import from leads error:', err);
    res.status(500).json({ error: 'Failed to import customers from leads' });
  }
});

/** POST /api/admin/customers/:site_id/:customer_id/addresses (must be before GET :customer_id) */
router.post('/:site_id/:customer_id/addresses', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const address = await customerService.addCustomerAddress(
      req.params.site_id,
      req.params.customer_id,
      req.body
    );
    res.status(201).json(address);
  } catch (err) {
    console.error('[customers] Add address error:', err);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

/** GET /api/admin/customers/:site_id/:customer_id */
router.get('/:site_id/:customer_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const customer = await customerService.getCustomer(req.params.customer_id, req.params.site_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const addresses = await customerService.getAddressesByCustomer(req.params.customer_id, req.params.site_id);
    res.json({ ...customer, addresses });
  } catch (err) {
    console.error('[customers] Get error:', err);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

/** PATCH /api/admin/customers/:site_id/:customer_id */
router.patch('/:site_id/:customer_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const customer = await customerService.updateCustomer(
      req.params.customer_id,
      req.params.site_id,
      req.body
    );
    res.json(customer);
  } catch (err) {
    console.error('[customers] Update error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/** DELETE /api/admin/customers/:site_id/:customer_id */
router.delete('/:site_id/:customer_id', async (req, res) => {
  try {
    const access = await checkSiteAccess(pool, req.user, req.params.site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const ok = await customerService.deleteCustomer(req.params.customer_id, req.params.site_id);
    if (!ok) return res.status(404).json({ error: 'Customer not found' });
    res.status(204).send();
  } catch (err) {
    console.error('[customers] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
