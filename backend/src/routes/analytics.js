/**
 * Analytics API Routes
 * 
 * GET /api/analytics/:site_id - Get comprehensive analytics for a site
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/analytics/:site_id
 * Get comprehensive site analytics
 */
router.get('/:site_id', async (req, res) => {
  const { site_id } = req.params;
  const { days = 30 } = req.query;

  try {
    const site = await pool.query('SELECT id, company_name FROM sites WHERE id = $1', [site_id]);
    if (site.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Conversation stats
    const conversationStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as last_24_hours,
        AVG(message_count) as avg_messages
      FROM conversations
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    `, [site_id]);

    // Lead stats
    const leadStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE lead_rating = 'HOT') as hot,
        COUNT(*) FILTER (WHERE lead_rating = 'WARM') as warm,
        COUNT(*) FILTER (WHERE lead_rating = 'COLD') as cold
      FROM leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    `, [site_id]);

    // Missed leads stats
    const missedStats = await pool.query(`
      SELECT COUNT(*) as total
      FROM missed_leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    `, [site_id]);

    // Daily breakdown
    const dailyBreakdown = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversations,
        COUNT(DISTINCT visitor_id) as unique_visitors
      FROM conversations
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [site_id]);

    // Top intents
    const topIntents = await pool.query(`
      SELECT 
        intent,
        COUNT(*) as count
      FROM messages
      WHERE conversation_id IN (
        SELECT id FROM conversations WHERE site_id = $1
      )
      AND intent IS NOT NULL
      AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY intent
      ORDER BY count DESC
      LIMIT 5
    `, [site_id]);

    // Conversion rate (leads / conversations)
    const conversionRate = conversationStats.rows[0].total > 0
      ? (leadStats.rows[0].total / conversationStats.rows[0].total * 100).toFixed(1)
      : 0;

    res.json({
      site: site.rows[0],
      period_days: parseInt(days),
      conversations: {
        total: parseInt(conversationStats.rows[0].total),
        last_7_days: parseInt(conversationStats.rows[0].last_7_days),
        last_24_hours: parseInt(conversationStats.rows[0].last_24_hours),
        avg_messages: parseFloat(conversationStats.rows[0].avg_messages || 0).toFixed(1),
      },
      leads: {
        total: parseInt(leadStats.rows[0].total),
        hot: parseInt(leadStats.rows[0].hot),
        warm: parseInt(leadStats.rows[0].warm),
        cold: parseInt(leadStats.rows[0].cold),
        conversion_rate: conversionRate,
      },
      missed_leads: parseInt(missedStats.rows[0].total),
      daily_breakdown: dailyBreakdown.rows,
      top_intents: topIntents.rows,
    });
  } catch (err) {
    console.error('[AnalyticsAPI] Error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
