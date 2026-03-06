/**
 * Missed Leads API Routes
 * 
 * GET /api/missed-leads/:site_id - Get missed leads for a site
 * GET /api/missed-leads/:site_id/stats - Get missed lead stats
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/missed-leads/:site_id
 * Get missed leads for a site with conversation details
 */
router.get('/:site_id', async (req, res) => {
  const { site_id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Validate site exists
    const site = await pool.query('SELECT id FROM sites WHERE id = $1', [site_id]);
    if (site.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Fetch missed leads with conversation info
    const result = await pool.query(`
      SELECT 
        ml.id,
        ml.conversation_id,
        ml.reason,
        ml.keywords_found,
        ml.message_count,
        ml.notified,
        ml.created_at,
        c.visitor_id,
        c.summary,
        c.current_page_url
      FROM missed_leads ml
      LEFT JOIN conversations c ON ml.conversation_id = c.id
      WHERE ml.site_id = $1
      ORDER BY ml.created_at DESC
      LIMIT $2 OFFSET $3
    `, [site_id, limit, offset]);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM missed_leads WHERE site_id = $1',
      [site_id]
    );

    res.json({
      missed_leads: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('[MissedLeads API] Error:', err);
    res.status(500).json({ error: 'Failed to fetch missed leads' });
  }
});

/**
 * GET /api/missed-leads/:site_id/stats
 * Get missed lead statistics
 */
router.get('/:site_id/stats', async (req, res) => {
  const { site_id } = req.params;
  const { days = 7 } = req.query;

  try {
    // Total missed leads in time period
    const total = await pool.query(`
      SELECT COUNT(*) as count
      FROM missed_leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    `, [site_id]);

    // Top keywords
    const keywords = await pool.query(`
      SELECT 
        unnest(keywords_found) as keyword,
        COUNT(*) as count
      FROM missed_leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY keyword
      ORDER BY count DESC
      LIMIT 10
    `, [site_id]);

    // Daily breakdown
    const daily = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM missed_leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [site_id]);

    res.json({
      total: parseInt(total.rows[0].count),
      top_keywords: keywords.rows,
      daily_breakdown: daily.rows,
      period_days: parseInt(days),
    });
  } catch (err) {
    console.error('[MissedLeads API] Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * DELETE /api/missed-leads/:site_id/:id
 * Delete a missed lead record
 */
router.delete('/:site_id/:id', async (req, res) => {
  const { site_id, id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM missed_leads WHERE id = $1 AND site_id = $2 RETURNING id',
      [id, site_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Missed lead not found' });
    }

    res.json({ success: true, deleted_id: id });
  } catch (err) {
    console.error('[MissedLeads API] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete missed lead' });
  }
});

module.exports = router;
