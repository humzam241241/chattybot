const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

async function createAppointment(siteId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO appointments (id, site_id, job_id, technician_id, start_time, end_time, location, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      siteId,
      data.job_id,
      data.technician_id || null,
      data.start_time,
      data.end_time,
      data.location || null,
      data.notes || null,
      data.status || 'scheduled',
    ]
  );
  return getAppointment(id, siteId);
}

async function assignTechnician(appointmentId, siteId, technicianId) {
  await pool.query(
    'UPDATE appointments SET technician_id = $1 WHERE id = $2 AND site_id = $3',
    [technicianId, appointmentId, siteId]
  );
  return getAppointment(appointmentId, siteId);
}

async function updateAppointment(appointmentId, siteId, data) {
  const fields = [];
  const values = [];
  let i = 1;
  const allowed = ['job_id', 'technician_id', 'start_time', 'end_time', 'location', 'notes', 'status'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (fields.length === 0) return getAppointment(appointmentId, siteId);
  values.push(appointmentId, siteId);
  await pool.query(
    `UPDATE appointments SET ${fields.join(', ')} WHERE id = $${i} AND site_id = $${i + 1}`,
    values
  );
  return getAppointment(appointmentId, siteId);
}

async function getAppointment(appointmentId, siteId) {
  const r = await pool.query(
    `SELECT a.*, t.name AS technician_name, j.title AS job_title, j.job_status
     FROM appointments a
     LEFT JOIN technicians t ON t.id = a.technician_id AND t.site_id = a.site_id
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE a.id = $1 AND a.site_id = $2`,
    [appointmentId, siteId]
  );
  return r.rows[0] || null;
}

/**
 * Get schedule for a given day (start of day to end of day in site time; we use UTC day for simplicity).
 */
async function getScheduleForDay(siteId, dateStr) {
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;
  const r = await pool.query(
    `SELECT a.*, t.name AS technician_name, j.title AS job_title, c.name AS customer_name
     FROM appointments a
     LEFT JOIN technicians t ON t.id = a.technician_id AND t.site_id = a.site_id
     LEFT JOIN jobs j ON j.id = a.job_id
     LEFT JOIN customers c ON c.id = j.customer_id AND c.site_id = j.site_id
     WHERE a.site_id = $1 AND a.start_time >= $2 AND a.start_time <= $3 AND a.status NOT IN ('cancelled')
     ORDER BY a.start_time`,
    [siteId, dayStart, dayEnd]
  );
  return r.rows;
}

async function getAppointmentsBySite(siteId, options = {}) {
  const { technician_id, from, to, limit = 200 } = options;
  let where = 'WHERE a.site_id = $1';
  const params = [siteId];
  if (technician_id) {
    params.push(technician_id);
    where += ` AND a.technician_id = $${params.length}`;
  }
  if (from) {
    params.push(from);
    where += ` AND a.start_time >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += ` AND a.start_time <= $${params.length}`;
  }
  params.push(limit);
  const r = await pool.query(
    `SELECT a.*, t.name AS technician_name, j.title AS job_title
     FROM appointments a
     LEFT JOIN technicians t ON t.id = a.technician_id
     LEFT JOIN jobs j ON j.id = a.job_id
     ${where}
     ORDER BY a.start_time
     LIMIT $${params.length}`,
    params
  );
  return r.rows;
}

async function createDispatchEvent(siteId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO dispatch_events (id, site_id, appointment_id, event_type, timestamp, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      siteId,
      data.appointment_id || null,
      data.event_type || 'note',
      data.timestamp || new Date().toISOString(),
      data.notes || null,
    ]
  );
  const r = await pool.query('SELECT * FROM dispatch_events WHERE id = $1 AND site_id = $2', [id, siteId]);
  return r.rows[0] || null;
}

module.exports = {
  createAppointment,
  assignTechnician,
  updateAppointment,
  getAppointment,
  getScheduleForDay,
  getAppointmentsBySite,
  createDispatchEvent,
};
