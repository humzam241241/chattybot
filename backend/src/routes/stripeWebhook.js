/**
 * Stripe Webhook: Plan assignment + subscription tracking
 *
 * Handles:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 */

const express = require('express');
const pool = require('../config/database');
const PRICE_TO_PLAN = require('../config/stripePlans');

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

function getPlanFromPriceId(priceId) {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] || null;
}

async function updateSitesForCustomer(customerId, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [k, v] of Object.entries(updates)) {
    fields.push(`${k} = $${idx++}`);
    values.push(v);
  }
  fields.push(`updated_at = NOW()`);

  values.push(customerId);
  const query = `UPDATE sites SET ${fields.join(', ')} WHERE stripe_customer_id = $${idx}`;
  await pool.query(query, values);
}

async function applySubscription(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = getPlanFromPriceId(priceId) || 'starter';

  await updateSitesForCustomer(customerId, {
    plan,
    stripe_subscription_id: subscriptionId,
  });
}

async function applySubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  await updateSitesForCustomer(customerId, {
    plan: 'starter',
    stripe_subscription_id: null,
  });
}

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !webhookSecret) {
      return res.status(500).json({ error: 'Stripe webhook not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('[StripeWebhook] Signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === 'customer.subscription.updated') {
        await applySubscription(event.data.object);
      }

      if (event.type === 'customer.subscription.deleted') {
        await applySubscriptionDeleted(event.data.object);
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        // Ensure sites have stripe_customer_id set (best effort)
        if (customerId) {
          await updateSitesForCustomer(customerId, { stripe_customer_id: customerId });
        }

        // For subscription checkouts, retrieve subscription to get price_id
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await applySubscription(subscription);
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error('[StripeWebhook] Processing error:', err);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

module.exports = router;

