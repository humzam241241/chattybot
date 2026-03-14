const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

async function createInvoiceFromJob(siteId, jobId, customerId, options = {}) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO invoices (id, site_id, job_id, customer_id, status, total_amount)
     VALUES ($1, $2, $3, $4, 'draft', 0)`,
    [id, siteId, jobId, customerId]
  );
  const lineItems = options.line_items || [];
  for (let i = 0; i < lineItems.length; i++) {
    await addInvoiceLineItem(siteId, id, lineItems[i]);
  }
  await recalcInvoiceTotal(id, siteId);
  return getInvoice(id, siteId);
}

async function createInvoice(siteId, customerId, options = {}) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO invoices (id, site_id, customer_id, status, total_amount)
     VALUES ($1, $2, $3, 'draft', 0)`,
    [id, siteId, customerId]
  );
  const lineItems = options.line_items || options.job_id ? [] : [];
  if (options.job_id) {
    await pool.query(
      'UPDATE invoices SET job_id = $1 WHERE id = $2 AND site_id = $3',
      [options.job_id, id, siteId]
    );
  }
  for (let i = 0; i < lineItems.length; i++) {
    await addInvoiceLineItem(siteId, id, lineItems[i]);
  }
  await recalcInvoiceTotal(id, siteId);
  return getInvoice(id, siteId);
}

async function addInvoiceLineItem(siteId, invoiceId, data) {
  const id = uuidv4();
  const quantity = Number(data.quantity) || 1;
  const unitPrice = Number(data.unit_price) || 0;
  await pool.query(
    `INSERT INTO invoice_line_items (id, site_id, invoice_id, description, quantity, unit_price, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, siteId, invoiceId, data.description || '', quantity, unitPrice, data.sort_order != null ? data.sort_order : 0]
  );
  await recalcInvoiceTotal(invoiceId, siteId);
  const r = await pool.query('SELECT * FROM invoice_line_items WHERE id = $1 AND site_id = $2', [id, siteId]);
  return r.rows[0] || null;
}

async function recalcInvoiceTotal(invoiceId, siteId) {
  await pool.query(
    `UPDATE invoices SET total_amount = (
       SELECT COALESCE(SUM(quantity * unit_price), 0) FROM invoice_line_items WHERE invoice_id = $1 AND site_id = $2
     ) WHERE id = $1 AND site_id = $2`,
    [invoiceId, siteId]
  );
}

async function getInvoice(invoiceId, siteId) {
  const r = await pool.query(
    `SELECT i.*, c.name AS customer_name, c.email AS customer_email, j.title AS job_title
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id AND c.site_id = i.site_id
     LEFT JOIN jobs j ON j.id = i.job_id
     WHERE i.id = $1 AND i.site_id = $2`,
    [invoiceId, siteId]
  );
  const inv = r.rows[0];
  if (!inv) return null;
  const lines = await pool.query(
    'SELECT * FROM invoice_line_items WHERE invoice_id = $1 AND site_id = $2 ORDER BY sort_order, created_at',
    [invoiceId, siteId]
  );
  inv.line_items = lines.rows;
  return inv;
}

async function getInvoicesBySite(siteId, options = {}) {
  const { customer_id, status, limit = 100, offset = 0 } = options;
  let where = 'WHERE i.site_id = $1';
  const params = [siteId];
  if (customer_id) {
    params.push(customer_id);
    where += ` AND i.customer_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    where += ` AND i.status = $${params.length}`;
  }
  params.push(limit, offset);
  const r = await pool.query(
    `SELECT i.*, c.name AS customer_name
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id AND c.site_id = i.site_id
     ${where}
     ORDER BY i.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

async function updateInvoiceLineItem(lineItemId, siteId, data) {
  const allowed = ['description', 'quantity', 'unit_price', 'sort_order'];
  const fields = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (fields.length === 0) return null;
  values.push(lineItemId, siteId);
  await pool.query(
    `UPDATE invoice_line_items SET ${fields.join(', ')} WHERE id = $${i} AND site_id = $${i + 1}`,
    values
  );
  const r = await pool.query('SELECT * FROM invoice_line_items WHERE id = $1 AND site_id = $2', [lineItemId, siteId]);
  const row = r.rows[0];
  if (row) await recalcInvoiceTotal(row.invoice_id, siteId);
  return row || null;
}

async function sendInvoice(invoiceId, siteId) {
  await pool.query(
    "UPDATE invoices SET status = 'sent' WHERE id = $1 AND site_id = $2",
    [invoiceId, siteId]
  );
  return getInvoice(invoiceId, siteId);
}

async function markInvoicePaid(invoiceId, siteId) {
  await pool.query(
    "UPDATE invoices SET status = 'paid' WHERE id = $1 AND site_id = $2",
    [invoiceId, siteId]
  );
  return getInvoice(invoiceId, siteId);
}

module.exports = {
  createInvoiceFromJob,
  createInvoice,
  addInvoiceLineItem,
  getInvoice,
  getInvoicesBySite,
  updateInvoiceLineItem,
  sendInvoice,
  markInvoicePaid,
  recalcInvoiceTotal,
};
