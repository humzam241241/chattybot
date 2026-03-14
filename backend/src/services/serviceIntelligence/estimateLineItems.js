/**
 * Estimate line items: get and upsert line items for an estimate (tenant-isolated).
 */

/**
 * Get line items for an estimate. Ensures estimate belongs to site_id.
 */
async function getLineItems(pool, estimateId, siteId) {
  const result = await pool.query(
    `SELECT id, site_id, estimate_id, sort_order, label, description,
            quantity, unit, unit_price, amount, is_optional, created_at, updated_at
     FROM estimate_line_items
     WHERE estimate_id = $1 AND site_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [estimateId, siteId]
  );
  return result.rows;
}

/**
 * Upsert line items for an estimate. Replaces all line items for that estimate.
 * Each item: { label, description?, quantity?, unit?, unit_price?, is_optional? }
 * Validates estimate belongs to site_id.
 */
async function upsertLineItems(pool, estimateId, siteId, items) {
  const client = await pool.connect();
  try {
    const estimateCheck = await client.query(
      'SELECT id FROM estimates WHERE id = $1 AND site_id = $2',
      [estimateId, siteId]
    );
    if (estimateCheck.rows.length === 0) {
      return { ok: false, error: 'Estimate not found' };
    }

    await client.query('DELETE FROM estimate_line_items WHERE estimate_id = $1 AND site_id = $2', [
      estimateId,
      siteId,
    ]);

    if (!Array.isArray(items) || items.length === 0) {
      return { ok: true, items: [] };
    }

    const inserted = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const label = it.label != null ? String(it.label).trim() : '';
      const quantity = parseFloat(it.quantity) || 1;
      const unit = it.unit != null ? String(it.unit).trim() : 'ea';
      const unitPrice = parseFloat(it.unit_price) || 0;
      const isOptional = Boolean(it.is_optional);
      const description = it.description != null ? String(it.description).trim() : null;

      const ins = await client.query(
        `INSERT INTO estimate_line_items (site_id, estimate_id, sort_order, label, description, quantity, unit, unit_price, is_optional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, site_id, estimate_id, sort_order, label, description, quantity, unit, unit_price, amount, is_optional, created_at, updated_at`,
        [siteId, estimateId, i, label || 'Line item', description, quantity, unit, unitPrice, isOptional]
      );
      inserted.push(ins.rows[0]);
    }

    return { ok: true, items: inserted };
  } finally {
    client.release();
  }
}

module.exports = {
  getLineItems,
  upsertLineItems,
};
