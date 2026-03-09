/**
 * Stripe Routes
 * 
 * Handles checkout sessions, webhooks, and customer portal
 */
const express = require('express');
const pool = require('../config/database');
const { userAuth } = require('../middleware/userAuth');

const router = express.Router();

let stripe = null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (stripeSecretKey) {
  stripe = require('stripe')(stripeSecretKey);
}

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  yearly: process.env.STRIPE_PRICE_ID_YEARLY,
  lifetime: process.env.STRIPE_PRICE_ID_LIFETIME,
};


async function getOrCreateStripeCustomer(appUser) {
  if (appUser.stripe_customer_id) {
    return appUser.stripe_customer_id;
  }
  
  const customer = await stripe.customers.create({
    email: appUser.email,
    metadata: { app_user_id: appUser.id },
  });
  
  await pool.query(
    'UPDATE app_users SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, appUser.id]
  );
  
  return customer.id;
}

async function backfillSitesCustomerId(userId, customerId) {
  if (!userId || !customerId) return;
  try {
    await pool.query(
      `UPDATE sites
       SET stripe_customer_id = COALESCE(stripe_customer_id, $2)
       WHERE owner_id = $1`,
      [userId, customerId]
    );
  } catch (err) {
    console.error('[Stripe] Failed to backfill sites stripe_customer_id (non-fatal):', err.message);
  }
}

router.post('/create-checkout-session', userAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  let { plan, successUrl, cancelUrl, site_id } = req.body;
  const appUser = req.user?.appUser;
  
  if (!appUser) {
    return res.status(401).json({ error: 'User not found' });
  }

  // For site-based subscriptions, require site_id. If not provided, pick most recent site for user (if any).
  if (!site_id) {
    try {
      const r = await pool.query(
        `SELECT id FROM sites WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [appUser.id]
      );
      site_id = r.rows?.[0]?.id || null;
    } catch {}
  }
  if (!site_id) return res.status(400).json({ error: 'site_id is required' });
  
  let priceId = PRICE_IDS[plan];
  
  if (appUser.custom_pricing && typeof appUser.custom_pricing === 'object') {
    const customKey = `${plan}_cents`;
    if (appUser.custom_pricing[customKey]) {
      try {
        const price = await stripe.prices.create({
          unit_amount: appUser.custom_pricing[customKey],
          currency: 'usd',
          product: process.env.STRIPE_PRODUCT_ID,
          ...(plan !== 'lifetime' && { recurring: { interval: plan === 'yearly' ? 'year' : 'month' } }),
        });
        priceId = price.id;
      } catch (err) {
        console.error('[Stripe] Failed to create custom price:', err);
      }
    }
  }
  
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  try {
    const customerId = await getOrCreateStripeCustomer(appUser);
    // Keep sites table in sync for usage metering
    backfillSitesCustomerId(appUser.id, customerId).catch(() => {});
    
    const sessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: plan === 'lifetime' ? 'payment' : 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: { user_id: appUser.id, plan, site_id },
    };
    
    if (plan !== 'lifetime') {
      sessionParams.subscription_data = {
        metadata: { user_id: appUser.id },
      };
    }
    
    const session = await stripe.checkout.sessions.create(sessionParams);
    
    return res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Webhook handling moved to `routes/stripeWebhook.js` so it can be mounted
// before JSON body parsing (Stripe requires raw body for signature verification).

router.post('/portal', userAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  const appUser = req.user?.appUser;
  if (!appUser?.stripe_customer_id) {
    return res.status(400).json({ error: 'No subscription found' });
  }
  
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: appUser.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });
    
    return res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Portal error:', err);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
});

router.get('/subscription', userAuth, async (req, res) => {
  const appUser = req.user?.appUser;
  if (!appUser) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  return res.json({
    status: appUser.subscription_status,
    trialEndsAt: appUser.trial_ends_at,
    hasAccess: ['active', 'lifetime'].includes(appUser.subscription_status) ||
      (appUser.subscription_status === 'trialing' && 
       appUser.trial_ends_at && 
       new Date(appUser.trial_ends_at) > new Date()),
  });
});

module.exports = router;
