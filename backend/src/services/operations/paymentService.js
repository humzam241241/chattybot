const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

async function recordPayment(siteId, invoiceId, data) {
  const id = uuidv4();
  const amount = Number(data.amount) || 0;
  await pool.query(
    `INSERT INTO payments (id, site_id, invoice_id, amount, payment_method, paid_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      siteId,
      invoiceId,
      amount,
      data.payment_method || null,
      data.paid_at || new Date().toISOString(),
      data.notes || null,
    ]
  );
  const invoiceService = require('./invoiceService');
  await invoiceService.markInvoicePaid(invoiceId, siteId);
  const r = await pool.query('SELECT * FROM payments WHERE id = $1 AND site_id = $2', [id, siteId]);
  return r.rows[0] || null;
}

async function getPaymentsByInvoice(invoiceId, siteId) {
  const r = await pool.query(
    'SELECT * FROM payments WHERE invoice_id = $1 AND site_id = $2 ORDER BY paid_at DESC',
    [invoiceId, siteId]
  );
  return r.rows;
}

async function getPaymentsBySite(siteId, options = {}) {
  const { customer_id, from, to, limit = 100, offset = 0 } = options;
  let where = 'WHERE p.site_id = $1';
  const params = [siteId];
  if (customer_id) {
    params.push(customer_id);
    where += ` AND i.customer_id = $${params.length}`;
  }
  if (from) {
    params.push(from);
    where += ` AND p.paid_at >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += ` AND p.paid_at <= $${params.length}`;
  }
  params.push(limit, offset);
  const r = await pool.query(
    `SELECT p.*, i.customer_id, i.job_id
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id AND i.site_id = p.site_id
     ${where}
     ORDER BY p.paid_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

module.exports = {
  recordPayment,
  getPaymentsByInvoice,
  getPaymentsBySite,
};
