const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

async function createTechnician(siteId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO technicians (id, site_id, name, phone, role, active)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      siteId,
      data.name || '',
      data.phone || null,
      data.role || null,
      data.active !== false,
    ]
  );
  return getTechnician(id, siteId);
}

async function getTechnicians(siteId, activeOnly = false) {
  let query = 'SELECT * FROM technicians WHERE site_id = $1';
  const params = [siteId];
  if (activeOnly) {
    query += ' AND active = true';
  }
  query += ' ORDER BY name';
  const r = await pool.query(query, params);
  return r.rows;
}

async function getTechnician(technicianId, siteId) {
  const r = await pool.query(
    'SELECT * FROM technicians WHERE id = $1 AND site_id = $2',
    [technicianId, siteId]
  );
  return r.rows[0] || null;
}

async function updateTechnician(technicianId, siteId, data) {
  const fields = [];
  const values = [];
  let i = 1;
  const allowed = ['name', 'phone', 'role', 'active'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i}`);
      values.push(key === 'active' ? Boolean(data[key]) : data[key]);
      i++;
    }
  }
  if (fields.length === 0) return getTechnician(technicianId, siteId);
  values.push(technicianId, siteId);
  await pool.query(
    `UPDATE technicians SET ${fields.join(', ')} WHERE id = $${i} AND site_id = $${i + 1}`,
    values
  );
  return getTechnician(technicianId, siteId);
}

module.exports = {
  createTechnician,
  getTechnicians,
  getTechnician,
  updateTechnician,
};
