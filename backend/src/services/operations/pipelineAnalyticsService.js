const pool = require('../../config/database');

/**
 * Lead → job conversion (count of jobs that came from lead status or have linked service_request/estimate).
 */
async function calculateLeadConversion(siteId, fromDate, toDate) {
  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE job_status = 'lead') AS lead_count,
       COUNT(*) FILTER (WHERE job_status = 'scheduled') AS scheduled_count,
       COUNT(*) FILTER (WHERE job_status = 'dispatched') AS dispatched_count,
       COUNT(*) FILTER (WHERE job_status = 'in_progress') AS in_progress_count,
       COUNT(*) FILTER (WHERE job_status = 'completed') AS completed_count,
       COUNT(*) FILTER (WHERE job_status = 'cancelled') AS cancelled_count,
       COUNT(*) AS total_jobs
     FROM jobs
     WHERE site_id = $1 AND created_at >= $2 AND created_at <= $3`,
    [siteId, fromDate, toDate]
  );
  return r.rows[0] || {};
}

/**
 * Revenue in period (sum of payments).
 */
async function calculateRevenue(siteId, fromDate, toDate) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS revenue
     FROM invoice_payments
     WHERE site_id = $1 AND paid_at >= $2 AND paid_at <= $3`,
    [siteId, fromDate, toDate]
  );
  return { revenue: Number(r.rows[0]?.revenue || 0) };
}

/**
 * Average job value (from completed jobs with invoices paid, or from invoice totals).
 */
async function calculateAverageJobValue(siteId, fromDate, toDate) {
  const r = await pool.query(
    `SELECT COUNT(*) AS paid_invoices, COALESCE(SUM(total_amount), 0)::numeric AS total
     FROM invoices
     WHERE site_id = $1 AND status = 'paid' AND updated_at >= $2 AND updated_at <= $3`,
    [siteId, fromDate, toDate]
  );
  const row = r.rows[0];
  const count = Number(row?.paid_invoices || 0);
  const total = Number(row?.total || 0);
  return {
    average_job_value: count > 0 ? total / count : 0,
    total_revenue: total,
    job_count: count,
  };
}

/**
 * Pipeline summary for dashboard (all-time or period).
 */
async function getPipelineSummary(siteId, options = {}) {
  const { from_date, to_date } = options;
  let where = 'WHERE site_id = $1';
  const params = [siteId];
  if (from_date) {
    params.push(from_date);
    where += ` AND created_at >= $${params.length}`;
  }
  if (to_date) {
    params.push(to_date);
    where += ` AND created_at <= $${params.length}`;
  }

  const jobs = await pool.query(
    `SELECT job_status, COUNT(*) AS count FROM jobs ${where} GROUP BY job_status`,
    params
  );
  const byStatus = {};
  jobs.rows.forEach((row) => { byStatus[row.job_status] = parseInt(row.count, 10); });

  let revQuery = 'SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM invoice_payments WHERE site_id = $1';
  const revParams = [siteId];
  if (from_date) { revParams.push(from_date); revQuery += ` AND paid_at >= $${revParams.length}`; }
  if (to_date) { revParams.push(to_date); revQuery += ` AND paid_at <= $${revParams.length}`; }
  const rev = await pool.query(revQuery, revParams);
  const revenue = Number(rev.rows[0]?.total || 0);

  const avgRange = await calculateAverageJobValue(
    siteId,
    from_date || '1970-01-01',
    to_date || new Date().toISOString().slice(0, 10)
  );

  return {
    jobs_by_status: byStatus,
    revenue,
    ...avgRange,
  };
}

module.exports = {
  calculateLeadConversion,
  calculateRevenue,
  calculateAverageJobValue,
  getPipelineSummary,
};
