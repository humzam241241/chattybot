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

  const plan = String(site.plan || 'starter').toLowerCase();
  const used = parseInt(site.messages_used || 0, 10);
  const limit = getLimitForPlan(plan);
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return { plan, used, limit, remaining, percent };
}

async function checkLimit(siteId) {
  const site = await getSite(siteId);
  if (!site) {
    const err = new Error('Site not found');
    err.status = 404;
    throw err;
  }

  const plan = String(site.plan || 'starter').toLowerCase();
  const limit = getLimitForPlan(plan);
  const used = parseInt(site.messages_used || 0, 10);

  if (used >= limit) {
    const err = new Error('Message limit reached');
    err.status = 429;
    err.code = 'MESSAGE_LIMIT_REACHED';
    err.plan = plan;
    err.limit = limit;
    err.used = used;
    throw err;
  }

  return { site, plan, limit, used };
}

async function recordUsage(siteId) {
  if (!siteId) return;

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

  console.log(`[Usage] Site ${siteId} used 1 request (month total: ${used})`);
  await sendStripeMeterEvent(customerId);
}

module.exports = {
  getSite,
  getUsage,
  checkLimit,
  recordUsage,
};

