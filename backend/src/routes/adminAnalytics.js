/**
 * Admin Analytics Routes
 * 
 * Endpoints for conversation analytics, transcripts, leads, and stats
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/admin/conversations
// Returns list of all conversations with summary and metadata
router.get('/conversations', async (req, res) => {
  const { site_id, limit = 50, offset = 0 } = req.query;

  try {
    const params = [];
    let whereClause = '';
    
    if (site_id) {
      params.push(site_id);
      whereClause = `WHERE site_id = $${params.length}`;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM conversations ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get paginated conversations
    const query = `
      SELECT 
        id as conversation_id,
        site_id,
        visitor_id,
        message_count,
        summary,
        lead_score,
        created_at,
        updated_at
      FROM conversations
      ${whereClause}
      ORDER BY updated_at DESC 
      LIMIT $${params.length + 1} 
      OFFSET $${params.length + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);

    return res.json({
      conversations: result.rows,
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

  } catch (err) {
    console.error('[AdminAnalytics] Error fetching conversations:', err);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/admin/transcript/:id
// Returns full conversation transcript
router.get('/transcript/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch conversation metadata
    const convo = await pool.query(
      `SELECT id, site_id, visitor_id, message_count, summary, created_at
       FROM conversations
       WHERE id = $1`,
      [id]
    );

    if (convo.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Fetch all messages
    const messages = await pool.query(
      `SELECT role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    return res.json({
      conversation: convo.rows[0],
      messages: messages.rows,
    });

  } catch (err) {
    console.error('[AdminAnalytics] Error fetching transcript:', err);
    return res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

// GET /api/admin/leads
// Returns extracted leads with conversation context
router.get('/leads', async (req, res) => {
  const { site_id, limit = 50, offset = 0 } = req.query;

  try {
    let query = `
      SELECT 
        l.id,
        l.site_id,
        l.conversation_id,
        l.name,
        l.email,
        l.phone,
        l.message,
        l.extracted_at,
        l.created_at,
        c.message_count,
        c.summary
      FROM leads l
      LEFT JOIN conversations c ON c.id = l.conversation_id
      WHERE l.extracted_at IS NOT NULL
    `;

    const params = [];

    if (site_id) {
      params.push(site_id);
      query += ` AND l.site_id = $${params.length}`;
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Parse message JSON for easier frontend access
    const leads = result.rows.map(lead => {
      let parsedMessage = {};
      try {
        parsedMessage = typeof lead.message === 'string' ? JSON.parse(lead.message) : lead.message;
      } catch (err) {
        // Leave as is if not JSON
      }
      return {
        ...lead,
        service_requested: parsedMessage.service_requested || null,
        urgency: parsedMessage.urgency || null,
        address: parsedMessage.address || null,
      };
    });

    return res.json({
      leads,
      total: result.rowCount,
    });

  } catch (err) {
    console.error('[AdminAnalytics] Error fetching leads:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/admin/stats
// Returns aggregate analytics
router.get('/stats', async (req, res) => {
  const { site_id } = req.query;

  try {
    const params = [];
    let siteFilter = '';
    
    if (site_id) {
      params.push(site_id);
      siteFilter = `WHERE site_id = $1`;
    }

    // Total conversations
    const totalConvos = await pool.query(
      `SELECT COUNT(*) as count FROM conversations ${siteFilter}`,
      params
    );

    // Total leads
    const totalLeads = await pool.query(
      `SELECT COUNT(*) as count FROM leads WHERE extracted_at IS NOT NULL ${site_id ? 'AND site_id = $1' : ''}`,
      params
    );

    // Average messages per chat
    const avgMessages = await pool.query(
      `SELECT AVG(message_count) as avg FROM conversations ${siteFilter} ${site_id ? 'AND' : 'WHERE'} message_count > 0`,
      params
    );

    // Daily conversation volume (last 7 days)
    const dailyVolume = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM conversations
       ${siteFilter}
       ${siteFilter ? 'AND' : 'WHERE'} created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      params
    );

    return res.json({
      total_conversations: parseInt(totalConvos.rows[0].count),
      total_leads: parseInt(totalLeads.rows[0].count),
      avg_messages_per_chat: parseFloat(avgMessages.rows[0].avg || 0).toFixed(1),
      daily_volume: dailyVolume.rows,
    });

  } catch (err) {
    console.error('[AdminAnalytics] Error fetching stats:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/debug
// Debug endpoint for system health checks
router.get('/debug', async (req, res) => {
  try {
    const conversationCount = await pool.query('SELECT COUNT(*) as count FROM conversations');
    const messageCount = await pool.query('SELECT COUNT(*) as count FROM messages');
    const orphanMessages = await pool.query(
      `SELECT COUNT(*) as count FROM messages m 
       WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id)`
    );
    const jobsPending = await pool.query(
      `SELECT COUNT(*) as count FROM conversation_summary_jobs WHERE status = 'pending'`
    );

    return res.json({
      conversation_count: parseInt(conversationCount.rows[0].count),
      message_count: parseInt(messageCount.rows[0].count),
      orphan_messages: parseInt(orphanMessages.rows[0].count),
      jobs_pending: parseInt(jobsPending.rows[0].count),
      database_connected: true,
    });

  } catch (err) {
    console.error('[AdminAnalytics] Debug error:', err);
    return res.status(500).json({ 
      error: 'Debug check failed',
      database_connected: false,
    });
  }
});

// DELETE /api/admin/conversations/:id
// Deletes a conversation and all related records
router.delete('/conversations/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Use a transaction to ensure referential integrity
    await pool.query('BEGIN');

    // Delete related records first
    // 1. Delete summary jobs
    await pool.query(
      'DELETE FROM conversation_summary_jobs WHERE conversation_id = $1',
      [id]
    );
    console.log(`[AdminAnalytics] Deleted summary jobs for conversation ${id}`);

    // 2. Delete leads
    await pool.query(
      'DELETE FROM leads WHERE conversation_id = $1',
      [id]
    );
    console.log(`[AdminAnalytics] Deleted leads for conversation ${id}`);

    // 3. Delete messages
    const messagesResult = await pool.query(
      'DELETE FROM messages WHERE conversation_id = $1',
      [id]
    );
    console.log(`[AdminAnalytics] Deleted ${messagesResult.rowCount} messages for conversation ${id}`);

    // 4. Finally, delete the conversation
    const conversationResult = await pool.query(
      'DELETE FROM conversations WHERE id = $1 RETURNING id',
      [id]
    );

    if (conversationResult.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await pool.query('COMMIT');

    console.log(`[AdminAnalytics] Successfully deleted conversation ${id}`);

    return res.json({
      success: true,
      message: 'Conversation and related records deleted successfully',
      conversation_id: id,
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[AdminAnalytics] Error deleting conversation:', err);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
