const pool = require('../config/database');
const { PLAN_LIMITS } = require('../config/plans');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

async function getSite(siteId) {
  const r = await pool.query(
    `SELECT id, owner_id, plan, messages_used, stripe_customer_id, stripe_subscription_id
     FROM sites
     WHERE id = $1`,
    [siteId]
  );
  return r.rows?.[0] || null;
}

function getLimitForPlan(plan) {
  const key = String(plan || 'starter').toLowerCase();
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.starter;
}

async function sendStripeMeterEvent(customerId) {
  if (!stripe) return;
  if (!customerId) return;

  try {
    await stripe.billing.meterEvents.create({
      event_name: 'api_requests',
      payload: {
        value: 1,
        stripe_customer_id: customerId,
      },
    });
  } catch (err) {
    // Fail-safe: never break chat if Stripe is down
    console.error('[Usage] Stripe meter event failed (non-fatal):', err.message);
  }
}

async function getUsage(siteId) {
  const site = await getSite(siteId);
  if (!site) return null;

  // Prefer site_subscriptions if active; fallback to sites fields.
  const sub = await pool.query(
    `SELECT plan, message_limit, messages_used
     FROM site_subscriptions
     WHERE site_id = $1 AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [siteId]
  );

  const row = sub.rows?.[0];
  const plan = String(row?.plan || site.plan || 'starter').toLowerCase();
  const used = parseInt(row?.messages_used ?? site.messages_used ?? 0, 10);
  const limit = parseInt(row?.message_limit ?? getLimitForPlan(plan), 10);
  const remaining = Math.max(0, limit - used);
  const usage_percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  // Return both shapes (back-compat + requested SaaS shape)
  return {
    plan,
    messages_used: used,
    message_limit: limit,
    usage_percent,
    used,
    limit,
    remaining,
    percent: usage_percent,
  };
}

async function checkLimit(siteId) {
  const site = await getSite(siteId);
  if (!site) {
    const err = new Error('Site not found');
    err.status = 404;
    throw err;
  }

  const usage = await getUsage(siteId);
  const plan = usage.plan;
  const limit = usage.message_limit;
  const used = usage.messages_used;

  if (used >= limit) {
    const err = new Error('PLAN_LIMIT_REACHED');
    err.status = 429;
    err.code = 'PLAN_LIMIT_REACHED';
    err.plan = plan;
    err.limit = limit;
    err.used = used;
    throw err;
  }

  return { site, plan, limit, used };
}

async function recordUsage(siteId) {
  if (!siteId) return;

  // Prefer active subscription row for counting
  const subUpdate = await pool.query(
    `UPDATE site_subscriptions
     SET messages_used = messages_used + 1,
         updated_at = NOW()
     WHERE site_id = $1 AND status = 'active'
     RETURNING messages_used, stripe_customer_id`,
    [siteId]
  );

  if (subUpdate.rows.length > 0) {
    const used = parseInt(subUpdate.rows[0].messages_used || 0, 10);
    const customerId = subUpdate.rows[0].stripe_customer_id || null;
    console.log(`[Usage] Message counted (site ${siteId}, used ${used})`);
    await sendStripeMeterEvent(customerId);
    return;
  }

  // Fallback (no active subscription row yet)
  const r = await pool.query(
    `UPDATE sites
     SET messages_used = COALESCE(messages_used, 0) + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING messages_used, stripe_customer_id`,
    [siteId]
  );
  const used = parseInt(r.rows?.[0]?.messages_used || 0, 10);
  const customerId = r.rows?.[0]?.stripe_customer_id || null;
  console.log(`[Usage] Message counted (site ${siteId}, used ${used})`);
  await sendStripeMeterEvent(customerId);
}

module.exports = {
  getSite,
  getUsage,
  checkLimit,
  recordUsage,
};

