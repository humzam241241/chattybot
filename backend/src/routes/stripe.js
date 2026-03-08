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

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

router.post('/create-checkout-session', userAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  const { plan, successUrl, cancelUrl } = req.body;
  const appUser = req.user?.appUser;
  
  if (!appUser) {
    return res.status(401).json({ error: 'User not found' });
  }
  
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
    
    const sessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: plan === 'lifetime' ? 'payment' : 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: { user_id: appUser.id, plan },
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

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !webhookSecret) {
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        
        if (userId) {
          if (plan === 'lifetime') {
            await pool.query(
              `UPDATE app_users 
               SET subscription_status = 'lifetime', updated_at = NOW() 
               WHERE id = $1`,
              [userId]
            );
          } else if (session.subscription) {
            await pool.query(
              `UPDATE app_users 
               SET subscription_status = 'active', 
                   stripe_subscription_id = $2,
                   updated_at = NOW() 
               WHERE id = $1`,
              [userId, session.subscription]
            );
          }
          
          if (session.amount_total) {
            await pool.query(
              `INSERT INTO payments (user_id, stripe_payment_intent_id, amount_cents, status, payment_type)
               VALUES ($1, $2, $3, 'succeeded', $4)`,
              [userId, session.payment_intent, session.amount_total, plan]
            );
          }
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const user = await pool.query(
          'SELECT id FROM app_users WHERE stripe_customer_id = $1',
          [customerId]
        );
        
        if (user.rows.length > 0) {
          let status = 'active';
          if (subscription.status === 'canceled') status = 'canceled';
          else if (subscription.status === 'past_due') status = 'past_due';
          else if (subscription.status === 'trialing') status = 'trialing';
          
          await pool.query(
            `UPDATE app_users 
             SET subscription_status = $2, 
                 stripe_subscription_id = $3,
                 updated_at = NOW() 
             WHERE id = $1`,
            [user.rows[0].id, status, subscription.id]
          );
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const user = await pool.query(
          'SELECT id FROM app_users WHERE stripe_customer_id = $1',
          [customerId]
        );
        
        if (user.rows.length > 0) {
          await pool.query(
            `UPDATE app_users 
             SET subscription_status = 'canceled', 
                 stripe_subscription_id = NULL,
                 updated_at = NOW() 
             WHERE id = $1`,
            [user.rows[0].id]
          );
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        const user = await pool.query(
          'SELECT id FROM app_users WHERE stripe_customer_id = $1',
          [customerId]
        );
        
        if (user.rows.length > 0) {
          await pool.query(
            `UPDATE app_users SET subscription_status = 'past_due', updated_at = NOW() WHERE id = $1`,
            [user.rows[0].id]
          );
        }
        break;
      }
    }
    
    return res.json({ received: true });
  } catch (err) {
    console.error('[Stripe] Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

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
