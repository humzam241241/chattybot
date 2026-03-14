const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

async function createJob(siteId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO jobs (id, site_id, customer_id, service_request_id, estimate_id, title, description, job_status, priority, scheduled_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      siteId,
      data.customer_id,
      data.service_request_id || null,
      data.estimate_id || null,
      data.title || 'Job',
      data.description || null,
      data.job_status || 'lead',
      data.priority || 'normal',
      data.scheduled_date || null,
    ]
  );
  return getJob(id, siteId);
}

/**
 * Create a job from a service request (links service_request_id; creates or uses customer).
 */
async function convertServiceRequestToJob(siteId, requestId, options = {}) {
  const req = await pool.query(
    `SELECT id, site_id, customer_name, email, phone, problem_description, classified_job_type
     FROM service_requests WHERE id = $1 AND site_id = $2`,
    [requestId, siteId]
  );
  if (req.rows.length === 0) return null;
  const r = req.rows[0];
  const customerService = require('./customerService');
  let customerId = options.customer_id;
  if (!customerId) {
    const cust = await customerService.createCustomer(siteId, {
      name: r.customer_name || 'Customer',
      email: r.email || null,
      phone: r.phone || null,
    });
    customerId = cust.id;
  }
  return createJob(siteId, {
    customer_id: customerId,
    service_request_id: requestId,
    title: options.title || (r.classified_job_type ? `${r.classified_job_type.replace(/_/g, ' ')}` : 'Job from request'),
    description: r.problem_description || null,
    job_status: 'lead',
    priority: options.priority || 'normal',
  });
}

/**
 * Create a job from a lead (creates customer from lead name/email/phone, then job).
 */
async function convertLeadToJob(siteId, leadId, options = {}) {
  const lead = await pool.query(
    'SELECT id, site_id, name, email, phone, issue FROM leads WHERE id = $1 AND site_id = $2',
    [leadId, siteId]
  );
  if (lead.rows.length === 0) return null;
  const r = lead.rows[0];
  const customerService = require('./customerService');
  let customerId = options.customer_id;
  if (!customerId) {
    const cust = await customerService.createCustomer(siteId, {
      name: r.name || 'Customer',
      email: r.email || null,
      phone: r.phone || null,
    });
    customerId = cust.id;
  }
  return createJob(siteId, {
    customer_id: customerId,
    title: options.title || (r.issue ? r.issue.slice(0, 120) : 'Job from lead'),
    description: r.issue || null,
    job_status: 'lead',
    priority: options.priority || 'normal',
  });
}

/**
 * Create a job from an estimate (links estimate_id; customer from service_requests or options).
 */
async function convertEstimateToJob(siteId, estimateId, options = {}) {
  const est = await pool.query(
    `SELECT e.id, e.site_id, e.request_id, sr.customer_name, sr.email AS customer_email, sr.phone AS customer_phone
     FROM estimates e
     LEFT JOIN service_requests sr ON sr.id = e.request_id AND sr.site_id = e.site_id
     WHERE e.id = $1 AND e.site_id = $2`,
    [estimateId, siteId]
  );
  if (est.rows.length === 0) return null;

  const e = est.rows[0];
  const customerService = require('./customerService');
  let customerId = options.customer_id;
  if (!customerId && (e.customer_name || e.customer_email || e.customer_phone)) {
    const cust = await customerService.createCustomer(siteId, {
      name: e.customer_name || 'Customer',
      email: e.customer_email || null,
      phone: e.customer_phone || null,
    });
    customerId = cust.id;
  }
  if (!customerId) return null;

  return createJob(siteId, {
    customer_id: customerId,
    estimate_id: estimateId,
    service_request_id: e.request_id || null,
    title: options.title || 'Job from estimate',
    description: options.description || null,
    job_status: 'lead',
    priority: options.priority || 'normal',
  });
}

async function updateJobStatus(jobId, siteId, jobStatus) {
  const valid = ['lead', 'scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled'];
  if (!valid.includes(jobStatus)) return null;
  await pool.query(
    'UPDATE jobs SET job_status = $1 WHERE id = $2 AND site_id = $3',
    [jobStatus, jobId, siteId]
  );
  return getJob(jobId, siteId);
}

async function getJobsBySite(siteId, options = {}) {
  const { status, customer_id, limit = 100, offset = 0 } = options;
  let where = 'WHERE j.site_id = $1';
  const params = [siteId];

  if (status) {
    params.push(status);
    where += ` AND j.job_status = $${params.length}`;
  }
  if (customer_id) {
    params.push(customer_id);
    where += ` AND j.customer_id = $${params.length}`;
  }

  params.push(limit, offset);
  const r = await pool.query(
    `SELECT j.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
       t.name AS technician_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id AND c.site_id = j.site_id
     LEFT JOIN technicians t ON t.id = j.technician_id AND t.site_id = j.site_id
     ${where}
     ORDER BY j.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

async function getJob(jobId, siteId) {
  const r = await pool.query(
    `SELECT j.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.address AS customer_address,
       t.name AS technician_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id AND c.site_id = j.site_id
     LEFT JOIN technicians t ON t.id = j.technician_id AND t.site_id = j.site_id
     WHERE j.id = $1 AND j.site_id = $2`,
    [jobId, siteId]
  );
  return r.rows[0] || null;
}

async function updateJob(jobId, siteId, data) {
  const fields = [];
  const values = [];
  let i = 1;
  const allowed = ['customer_id', 'service_request_id', 'estimate_id', 'technician_id', 'title', 'description', 'job_status', 'priority', 'scheduled_date'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (fields.length === 0) return getJob(jobId, siteId);
  values.push(jobId, siteId);
  await pool.query(
    `UPDATE jobs SET ${fields.join(', ')} WHERE id = $${i} AND site_id = $${i + 1}`,
    values
  );
  return getJob(jobId, siteId);
}

async function getJobTasks(jobId, siteId) {
  const r = await pool.query(
    'SELECT * FROM job_tasks WHERE job_id = $1 AND site_id = $2 ORDER BY sort_order, created_at',
    [jobId, siteId]
  );
  return r.rows;
}

async function addJobTask(siteId, jobId, data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO job_tasks (id, site_id, job_id, description, status, assigned_to, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      siteId,
      jobId,
      data.description || '',
      data.status || 'pending',
      data.assigned_to || null,
      data.sort_order != null ? data.sort_order : 0,
    ]
  );
  const r = await pool.query('SELECT * FROM job_tasks WHERE id = $1 AND site_id = $2', [id, siteId]);
  return r.rows[0] || null;
}

async function updateJobTask(taskId, siteId, data) {
  const fields = [];
  const values = [];
  let i = 1;
  const allowed = ['description', 'status', 'assigned_to', 'sort_order'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (fields.length === 0) return null;
  values.push(taskId, siteId);
  await pool.query(
    `UPDATE job_tasks SET ${fields.join(', ')} WHERE id = $${i} AND site_id = $${i + 1}`,
    values
  );
  const r = await pool.query('SELECT * FROM job_tasks WHERE id = $1 AND site_id = $2', [taskId, siteId]);
  return r.rows[0] || null;
}

module.exports = {
  createJob,
  convertLeadToJob,
  convertServiceRequestToJob,
  convertEstimateToJob,
  updateJobStatus,
  getJobsBySite,
  getJob,
  updateJob,
  getJobTasks,
  addJobTask,
  updateJobTask,
};
