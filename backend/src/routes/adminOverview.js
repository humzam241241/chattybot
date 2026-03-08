/**
 * Admin Overview Routes
 * 
 * Comprehensive admin dashboard with leads, payments, analytics, users, texts, API usage
 */
const express = require('express');
const pool = require('../config/database');
const { requireAdmin } = require('../middleware/userAuth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    const [
      leadsResult,
      paymentsResult,
      conversationsResult,
      usersResult,
      smsResult,
      apiResult,
      sitesResult,
    ] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE lead_rating = 'HOT') as hot,
          COUNT(*) FILTER (WHERE lead_rating = 'WARM') as warm,
          COUNT(*) FILTER (WHERE lead_rating = 'COLD') as cold,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as last_24_hours
        FROM leads
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `),
      
      pool.query(`
        SELECT 
          COALESCE(SUM(amount_cents), 0) as total_revenue,
          COUNT(*) as total_payments,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30_days_count,
          COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) as last_30_days_revenue
        FROM payments
        WHERE status = 'succeeded'
      `),
      
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as last_24_hours,
          COUNT(DISTINCT visitor_id) as unique_visitors,
          AVG(message_count) as avg_messages
        FROM conversations
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `),
      
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE subscription_status = 'active') as active,
          COUNT(*) FILTER (WHERE subscription_status = 'trialing') as trialing,
          COUNT(*) FILTER (WHERE subscription_status = 'lifetime') as lifetime,
          COUNT(*) FILTER (WHERE subscription_status = 'canceled') as canceled,
          COUNT(*) FILTER (WHERE subscription_status = 'past_due') as past_due
        FROM app_users
      `),
      
      pool.query(`
        SELECT 
          COALESCE(SUM(message_count) FILTER (WHERE direction = 'outbound'), 0) as outbound,
          COALESCE(SUM(message_count) FILTER (WHERE direction = 'inbound'), 0) as inbound,
          COALESCE(SUM(message_count), 0) as total
        FROM sms_usage
        WHERE usage_date >= NOW() - INTERVAL '${days} days'
      `),
      
      pool.query(`
        SELECT 
          endpoint,
          COALESCE(SUM(request_count), 0) as count
        FROM api_usage
        WHERE usage_date >= NOW() - INTERVAL '${days} days'
        GROUP BY endpoint
        ORDER BY count DESC
      `),
      
      pool.query(`
        SELECT COUNT(*) as total FROM sites
      `),
    ]);
    
    const leads = leadsResult.rows[0];
    const payments = paymentsResult.rows[0];
    const conversations = conversationsResult.rows[0];
    const users = usersResult.rows[0];
    const sms = smsResult.rows[0];
    const api = apiResult.rows;
    const sites = sitesResult.rows[0];
    
    const conversionRate = parseInt(conversations.total) > 0
      ? ((parseInt(leads.total) / parseInt(conversations.total)) * 100).toFixed(1)
      : 0;
    
    const activeSubscribers = parseInt(users.active || 0) + parseInt(users.lifetime || 0);
    const mrr = activeSubscribers > 0 
      ? Math.round(parseInt(payments.last_30_days_revenue || 0) / 100)
      : 0;
    
    return res.json({
      period_days: parseInt(days),
      leads: {
        total: parseInt(leads.total),
        hot: parseInt(leads.hot),
        warm: parseInt(leads.warm),
        cold: parseInt(leads.cold),
        last_7_days: parseInt(leads.last_7_days),
        last_24_hours: parseInt(leads.last_24_hours),
      },
      payments: {
        total_revenue_cents: parseInt(payments.total_revenue),
        total_payments: parseInt(payments.total_payments),
        mrr_dollars: mrr,
        last_30_days_revenue_cents: parseInt(payments.last_30_days_revenue),
      },
      conversations: {
        total: parseInt(conversations.total),
        last_7_days: parseInt(conversations.last_7_days),
        last_24_hours: parseInt(conversations.last_24_hours),
        unique_visitors: parseInt(conversations.unique_visitors),
        avg_messages: parseFloat(conversations.avg_messages || 0).toFixed(1),
        conversion_rate: parseFloat(conversionRate),
      },
      users: {
        total: parseInt(users.total),
        active: parseInt(users.active),
        trialing: parseInt(users.trialing),
        lifetime: parseInt(users.lifetime),
        canceled: parseInt(users.canceled),
        past_due: parseInt(users.past_due),
      },
      sms: {
        outbound: parseInt(sms.outbound),
        inbound: parseInt(sms.inbound),
        total: parseInt(sms.total),
      },
      api_usage: api.reduce((acc, row) => {
        acc[row.endpoint] = parseInt(row.count);
        return acc;
      }, {}),
      sites: {
        total: parseInt(sites.total),
      },
    });
  } catch (err) {
    console.error('[AdminOverview] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.is_admin,
        u.subscription_status,
        u.trial_ends_at,
        u.stripe_customer_id,
        u.custom_pricing,
        u.created_at,
        COUNT(s.id) as site_count
      FROM app_users u
      LEFT JOIN sites s ON s.owner_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('[AdminOverview] Users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id/pricing', async (req, res) => {
  const { id } = req.params;
  const { custom_pricing } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE app_users 
       SET custom_pricing = $2, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id, custom_pricing || {}]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[AdminOverview] Update pricing error:', err);
    return res.status(500).json({ error: 'Failed to update pricing' });
  }
});

router.get('/leads-by-site', async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        s.id as site_id,
        s.company_name,
        COUNT(l.id) as lead_count,
        COUNT(l.id) FILTER (WHERE l.lead_rating = 'HOT') as hot,
        COUNT(l.id) FILTER (WHERE l.lead_rating = 'WARM') as warm,
        COUNT(l.id) FILTER (WHERE l.lead_rating = 'COLD') as cold
      FROM sites s
      LEFT JOIN leads l ON l.site_id = s.id 
        AND l.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY s.id, s.company_name
      ORDER BY lead_count DESC
    `);
    
    return res.json({ sites: result.rows });
  } catch (err) {
    console.error('[AdminOverview] Leads by site error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads by site' });
  }
});

router.get('/api-usage-by-site', async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        s.id as site_id,
        s.company_name,
        COALESCE(SUM(a.request_count) FILTER (WHERE a.endpoint = 'chat'), 0) as chat_requests,
        COALESCE(SUM(a.request_count) FILTER (WHERE a.endpoint = 'ingest'), 0) as ingest_requests,
        COALESCE(SUM(a.request_count) FILTER (WHERE a.endpoint = 'lead'), 0) as lead_requests,
        COALESCE(SUM(a.request_count), 0) as total_requests
      FROM sites s
      LEFT JOIN api_usage a ON a.site_id = s.id 
        AND a.usage_date >= NOW() - INTERVAL '${days} days'
      GROUP BY s.id, s.company_name
      ORDER BY total_requests DESC
    `);
    
    return res.json({ sites: result.rows });
  } catch (err) {
    console.error('[AdminOverview] API usage by site error:', err);
    return res.status(500).json({ error: 'Failed to fetch API usage' });
  }
});

router.get('/sms-usage-by-site', async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        s.id as site_id,
        s.company_name,
        COALESCE(SUM(sm.message_count) FILTER (WHERE sm.direction = 'outbound'), 0) as outbound,
        COALESCE(SUM(sm.message_count) FILTER (WHERE sm.direction = 'inbound'), 0) as inbound,
        COALESCE(SUM(sm.message_count), 0) as total
      FROM sites s
      LEFT JOIN sms_usage sm ON sm.site_id = s.id 
        AND sm.usage_date >= NOW() - INTERVAL '${days} days'
      GROUP BY s.id, s.company_name
      ORDER BY total DESC
    `);
    
    return res.json({ sites: result.rows });
  } catch (err) {
    console.error('[AdminOverview] SMS usage by site error:', err);
    return res.status(500).json({ error: 'Failed to fetch SMS usage' });
  }
});

module.exports = router;
