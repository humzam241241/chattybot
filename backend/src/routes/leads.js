const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { sendLeadEmail } = require('../services/mailer');

const router = express.Router();

/**
 * POST /lead
 * Captures a lead from the chat widget.
 */
router.post(
  '/',
  apiLimiter,
  [
    body('site_id').isUUID(),
    body('email').isEmail().normalizeEmail(),
    body('name').optional().isString().trim().isLength({ max: 200 }),
    body('message').optional().isString().trim().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, name, email, message } = req.body;

    try {
      // Verify site exists (tenant isolation)
      const siteCheck = await pool.query('SELECT id, company_name FROM sites WHERE id = $1', [site_id]);
      const siteRow = siteCheck.rows[0];
      if (!siteRow) {
        return res.status(404).json({ error: 'Site not found' });
      }

      const leadId = uuidv4();
      await pool.query(
        `INSERT INTO leads (id, site_id, name, email, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [leadId, site_id, name || null, email, message || null]
      );

      // Optional: email notification (SMTP), configured per-site via raffy_overrides.notifications.lead_email
      try {
        const settings = await getEffectiveRaffySettings(site_id);
        const to = settings?.raffy?.notifications?.lead_email ? String(settings.raffy.notifications.lead_email) : '';
        if (to) {
          await sendLeadEmail({
            to,
            siteName: siteRow.company_name,
            lead: { id: leadId, name, email, message },
          });
        }
      } catch (e) {
        console.warn('Lead email notification failed (non-fatal):', e.message);
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Lead capture error:', err);
      return res.status(500).json({ error: 'Failed to save lead' });
    }
  }
);

/**
 * GET /lead/debug/all
 * Debug: List ALL leads across all sites (admin only)
 */
router.get('/debug/all', adminAuth, async (req, res) => {
  try {
    // Get all sites first
    const sites = await pool.query('SELECT id, company_name FROM sites');
    
    // Get all leads with site info
    const result = await pool.query(`
      SELECT 
        l.id,
        l.site_id,
        s.company_name as site_name,
        l.name,
        l.email,
        l.phone,
        l.lead_rating,
        l.created_at
      FROM leads l
      LEFT JOIN sites s ON l.site_id = s.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);
    
    // Count leads per site
    const countsBySite = await pool.query(`
      SELECT site_id, COUNT(*) as lead_count
      FROM leads
      GROUP BY site_id
    `);
    
    return res.json({ 
      total_leads: result.rows.length,
      sites: sites.rows,
      leads_per_site: countsBySite.rows,
      leads: result.rows 
    });
  } catch (err) {
    console.error('Debug leads error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * DELETE /lead/:site_id/:lead_id
 * Delete a single lead (admin only).
 */
router.delete('/:site_id/:lead_id', adminAuth, async (req, res) => {
  const { site_id, lead_id } = req.params;
  try {
    const del = await pool.query(
      `DELETE FROM leads
       WHERE id = $1 AND site_id = $2
       RETURNING id`,
      [lead_id, site_id]
    );
    if (del.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete lead error:', err);
    return res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/**
 * DELETE /lead/:site_id/clear
 * Delete ALL leads for a site (admin only).
 * Use carefully — intended for testing/cleanup.
 */
router.delete('/:site_id/clear', adminAuth, async (req, res) => {
  const { site_id } = req.params;
  try {
    const del = await pool.query(
      `DELETE FROM leads WHERE site_id = $1`,
      [site_id]
    );
    return res.json({ success: true, deleted: del.rowCount || 0 });
  } catch (err) {
    console.error('Clear leads error:', err);
    return res.status(500).json({ error: 'Failed to clear leads' });
  }
});

/**
 * GET /lead/:site_id
 * List leads for a site (admin only).
 * Returns enhanced lead data including phone, issue, scoring.
 */
router.get('/:site_id', adminAuth, async (req, res) => {
  const { site_id } = req.params;
  const { rating, limit = 200 } = req.query;

  console.log(`[Leads API] Fetching leads for site_id: ${site_id}`);

  try {
    // Debug: count total leads for this site
    const totalCheck = await pool.query(
      'SELECT COUNT(*) as count FROM leads WHERE site_id = $1',
      [site_id]
    );
    console.log(`[Leads API] Total leads for site ${site_id}: ${totalCheck.rows[0]?.count}`);

    let query = `
      SELECT 
        l.id,
        l.name,
        l.email,
        l.phone,
        l.message,
        l.issue,
        l.location,
        l.lead_score,
        l.lead_rating,
        l.conversation_id,
        l.extraction_json,
        l.extracted_at,
        l.created_at,
        c.visitor_id,
        c.summary as conversation_summary
      FROM leads l
      LEFT JOIN conversations c ON l.conversation_id = c.id
      WHERE l.site_id = $1
    `;

    const params = [site_id];

    // Optional filter by rating
    if (rating && ['HOT', 'WARM', 'COLD'].includes(rating.toUpperCase())) {
      params.push(rating.toUpperCase());
      query += ` AND l.lead_rating = $${params.length}`;
    }

    // Sort: HOT first, then by most recently extracted/created
    query += `
      ORDER BY 
        CASE l.lead_rating 
          WHEN 'HOT' THEN 1 
          WHEN 'WARM' THEN 2 
          WHEN 'COLD' THEN 3 
          ELSE 4 
        END,
        COALESCE(l.extracted_at, l.created_at) DESC
      LIMIT $${params.length + 1}
    `;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    console.log(`[Leads API] Query returned ${result.rows.length} leads`);

    // Get counts by rating
    const countResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE lead_rating = 'HOT') as hot_count,
        COUNT(*) FILTER (WHERE lead_rating = 'WARM') as warm_count,
        COUNT(*) FILTER (WHERE lead_rating = 'COLD') as cold_count,
        COUNT(*) as total_count
       FROM leads
       WHERE site_id = $1`,
      [site_id]
    );

    const counts = countResult.rows[0] || {};

    return res.json({
      leads: result.rows,
      counts: {
        hot: parseInt(counts.hot_count) || 0,
        warm: parseInt(counts.warm_count) || 0,
        cold: parseInt(counts.cold_count) || 0,
        total: parseInt(counts.total_count) || 0,
      },
    });
  } catch (err) {
    console.error('Get leads error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * POST /lead/:site_id/rescore
 * Re-score all leads for a site that are missing ratings
 */
router.post('/:site_id/rescore', adminAuth, async (req, res) => {
  const { site_id } = req.params;
  
  try {
    // Import scoreLead
    const { scoreLead } = require('../services/leadScore');
    
    // Get leads without ratings or with NULL rating
    const leadsToScore = await pool.query(
      `SELECT l.id, l.conversation_id, l.email, l.phone, l.name
       FROM leads l
       WHERE l.site_id = $1 
       AND (l.lead_rating IS NULL OR l.lead_rating = '')`,
      [site_id]
    );
    
    let updated = 0;
    
    for (const lead of leadsToScore.rows) {
      // Get messages for this conversation
      let messages = [];
      if (lead.conversation_id) {
        const msgResult = await pool.query(
          `SELECT role, content FROM messages 
           WHERE conversation_id = $1 
           ORDER BY created_at ASC`,
          [lead.conversation_id]
        );
        messages = msgResult.rows;
      }
      
      // Score the lead
      const { score, rating } = scoreLead({
        messages,
        extracted: {
          email: lead.email,
          phone: lead.phone,
          name: lead.name,
        },
      });
      
      // Update the lead
      await pool.query(
        `UPDATE leads SET lead_score = $1, lead_rating = $2 WHERE id = $3`,
        [score, rating, lead.id]
      );
      updated++;
    }
    
    console.log(`[Rescore] Updated ${updated} leads for site ${site_id}`);
    
    return res.json({
      success: true,
      updated,
      message: `Re-scored ${updated} leads`,
    });
  } catch (err) {
    console.error('Rescore leads error:', err);
    return res.status(500).json({ error: 'Failed to rescore leads' });
  }
});

module.exports = router;
