const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a customer for a site.
 */
async function createCustomer(siteId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO customers (id, site_id, name, phone, email, company, address, tags, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      siteId,
      data.name || '',
      data.phone || null,
      data.email || null,
      data.company || null,
      data.address || null,
      JSON.stringify(data.tags || {}),
      data.notes || null,
    ]
  );
  return getCustomer(id, siteId);
}

/**
 * List customers for a site with optional search.
 */
async function getCustomersBySite(siteId, options = {}) {
  const { q, limit = 100, offset = 0 } = options;
  let where = 'WHERE site_id = $1';
  const params = [siteId];

  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`;
  }

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM customers ${where}
     ORDER BY name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

/**
 * Get a single customer by id and site_id.
 */
async function getCustomer(customerId, siteId) {
  const r = await pool.query(
    'SELECT * FROM customers WHERE id = $1 AND site_id = $2',
    [customerId, siteId]
  );
  return r.rows[0] || null;
}

/**
 * Update a customer.
 */
async function updateCustomer(customerId, siteId, data) {
  const fields = [];
  const values = [];
  let i = 1;
  const allowed = ['name', 'phone', 'email', 'company', 'address', 'tags', 'notes'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i}`);
      values.push(key === 'tags' ? JSON.stringify(data[key] || {}) : data[key]);
      i++;
    }
  }
  if (fields.length === 0) return getCustomer(customerId, siteId);
  values.push(customerId, siteId);
  await pool.query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i} AND site_id = $${i + 1}`,
    values
  );
  return getCustomer(customerId, siteId);
}

/**
 * Delete a customer (cascade will remove addresses; jobs/invoices may restrict).
 */
async function deleteCustomer(customerId, siteId) {
  const r = await pool.query(
    'DELETE FROM customers WHERE id = $1 AND site_id = $2 RETURNING id',
    [customerId, siteId]
  );
  return r.rowCount > 0;
}

/**
 * Get addresses for a customer.
 */
async function getAddressesByCustomer(customerId, siteId) {
  const r = await pool.query(
    'SELECT * FROM customer_addresses WHERE customer_id = $1 AND site_id = $2 ORDER BY is_primary DESC, created_at',
    [customerId, siteId]
  );
  return r.rows;
}

/**
 * Import customers from leads: create a customer for each lead that does not already
 * have a matching customer (by email or phone). Returns { created, skipped }.
 */
async function importCustomersFromLeads(siteId) {
  const leads = await pool.query(
    'SELECT id, name, email, phone FROM leads WHERE site_id = $1 ORDER BY created_at DESC',
    [siteId]
  );
  let created = 0;
  let skipped = 0;
  for (const lead of leads.rows) {
    const hasEmail = lead.email && String(lead.email).trim();
    const hasPhone = lead.phone && String(lead.phone).trim();
    let existing = null;
    if (hasEmail) {
      const r = await pool.query(
        'SELECT id FROM customers WHERE site_id = $1 AND email = $2 LIMIT 1',
        [siteId, lead.email.trim()]
      );
      existing = r.rows[0];
    }
    if (!existing && hasPhone) {
      const r = await pool.query(
        'SELECT id FROM customers WHERE site_id = $1 AND phone = $2 LIMIT 1',
        [siteId, lead.phone.trim()]
      );
      existing = r.rows[0];
    }
    if (existing) {
      skipped++;
      continue;
    }
    await createCustomer(siteId, {
      name: lead.name || 'Customer',
      email: lead.email || null,
      phone: lead.phone || null,
    });
    created++;
  }
  return { created, skipped };
}

/**
 * Add a customer address.
 */
async function addCustomerAddress(siteId, customerId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO customer_addresses (id, site_id, customer_id, address, city, province, postal_code, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      siteId,
      customerId,
      data.address || null,
      data.city || null,
      data.province || null,
      data.postal_code || null,
      Boolean(data.is_primary),
    ]
  );
  const r = await pool.query('SELECT * FROM customer_addresses WHERE id = $1 AND site_id = $2', [id, siteId]);
  return r.rows[0] || null;
}

module.exports = {
  createCustomer,
  getCustomersBySite,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getAddressesByCustomer,
  addCustomerAddress,
  importCustomersFromLeads,
};
