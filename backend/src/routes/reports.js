/**
 * Reports API Routes
 * 
 * GET /api/reports/:site_id - Get weekly reports for a site
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/reports/:site_id
 * Get weekly reports for a site
 */
router.get('/:site_id', async (req, res) => {
  const { site_id } = req.params;
  const { limit = 12 } = req.query;

  try {
    const site = await pool.query('SELECT id FROM sites WHERE id = $1', [site_id]);
    if (site.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const result = await pool.query(`
      SELECT 
        id,
        report_date,
        total_conversations,
        total_leads,
        hot_leads,
        warm_leads,
        cold_leads,
        missed_leads,
        top_questions,
        sent_at,
        created_at
      FROM weekly_reports
      WHERE site_id = $1
      ORDER BY report_date DESC
      LIMIT $2
    `, [site_id, limit]);

    res.json({
      reports: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    console.error('[ReportsAPI] Error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * GET /api/reports/:site_id/latest
 * Get the most recent report
 */
router.get('/:site_id/latest', async (req, res) => {
  const { site_id } = req.params;

  try {
    const result = await pool.query(`
      SELECT *
      FROM weekly_reports
      WHERE site_id = $1
      ORDER BY report_date DESC
      LIMIT 1
    `, [site_id]);

    if (result.rows.length === 0) {
      return res.json({ report: null });
    }

    res.json({ report: result.rows[0] });
  } catch (err) {
    console.error('[Reports API] Error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

module.exports = router;
