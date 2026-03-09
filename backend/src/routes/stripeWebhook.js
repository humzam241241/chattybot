/**
 * Stripe Webhook: Customer → Site mapping + plan assignment
 *
 * Endpoint is mounted at:
 * POST /api/stripe/webhook
 *
 * Handles:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 */

const express = require('express');
const pool = require('../config/database');
const PRICE_TO_PLAN = require('../config/stripePlans');
const { PLAN_LIMITS } = require('../config/plans');

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
  const planKey = getPlanFromPriceId(priceId) || 'starter';
  const messageLimit = PLAN_LIMITS[planKey] || PLAN_LIMITS.starter;

  // If we already have a site_subscriptions row for this customer, update it.
  // Otherwise, we can only update sites table.
  await pool.query(
    `UPDATE site_subscriptions
     SET plan = $2,
         message_limit = $3,
         status = 'active',
         stripe_subscription_id = $4,
         current_period_start = to_timestamp($5),
         current_period_end = to_timestamp($6),
         updated_at = NOW()
     WHERE stripe_customer_id = $1`,
    [
      customerId,
      planKey,
      messageLimit,
      subscriptionId,
      subscription.current_period_start || null,
      subscription.current_period_end || null,
    ]
  );

  await updateSitesForCustomer(customerId, {
    plan: planKey,
    stripe_subscription_id: subscriptionId,
  });

  console.log('[Billing] Plan updated');
}

async function applySubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  await pool.query(
    `UPDATE site_subscriptions
     SET status = 'inactive',
         updated_at = NOW()
     WHERE stripe_customer_id = $1`,
    [customerId]
  );
  await updateSitesForCustomer(customerId, {
    plan: 'starter',
    stripe_subscription_id: null,
  });

  console.log('[Billing] Subscription cancelled');
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

    console.log('[StripeWebhook] Stripe event received:', event.type);

    try {
      // Logging-only events (do not affect plan assignment)
      if (event.type === 'checkout.session.completed') {
        console.log('[StripeWebhook] New subscription checkout completed');
      }
      if (event.type === 'customer.subscription.created') {
        console.log('[StripeWebhook] Subscription created');
      }
      if (event.type === 'customer.subscription.updated') {
        console.log('[StripeWebhook] Subscription updated');
      }
      if (event.type === 'customer.subscription.deleted') {
        console.log('[StripeWebhook] Subscription cancelled');
      }
      if (event.type === 'invoice.payment_succeeded') {
        console.log('[StripeWebhook] Subscription payment success');
      }
      if (event.type === 'invoice.payment_failed') {
        console.log('[StripeWebhook] Payment failed');
      }

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
        const siteId = session.metadata?.site_id;

        // Ensure sites have stripe_customer_id set (best effort)
        if (customerId) {
          await updateSitesForCustomer(customerId, { stripe_customer_id: customerId });
        }

        if (siteId && customerId) {
          // Insert or update subscription row bound to the site
          const subscription = subscriptionId
            ? await stripe.subscriptions.retrieve(subscriptionId)
            : null;
          const priceId = subscription?.items?.data?.[0]?.price?.id || null;
          const planKey = getPlanFromPriceId(priceId) || 'starter';
          const messageLimit = PLAN_LIMITS[planKey] || PLAN_LIMITS.starter;

          await pool.query(
            `INSERT INTO site_subscriptions
             (site_id, stripe_customer_id, stripe_subscription_id, plan, message_limit, status, current_period_start, current_period_end)
             VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
             ON CONFLICT (stripe_customer_id)
             DO UPDATE SET
               site_id = EXCLUDED.site_id,
               stripe_subscription_id = EXCLUDED.stripe_subscription_id,
               plan = EXCLUDED.plan,
               message_limit = EXCLUDED.message_limit,
               status = 'active',
               current_period_start = EXCLUDED.current_period_start,
               current_period_end = EXCLUDED.current_period_end,
               updated_at = NOW()`,
            [
              siteId,
              customerId,
              subscriptionId || null,
              planKey,
              messageLimit,
              subscription?.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
              subscription?.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
            ]
          );

          console.log('[Billing] Subscription activated');
        }

        // For subscription checkouts, retrieve subscription to get price_id
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await applySubscription(subscription);
        }
      }

      // Also apply plan on creation events (some setups emit created before updated)
      if (event.type === 'customer.subscription.created') {
        await applySubscription(event.data.object);
        console.log('[Billing] Subscription activated');
      }

      if (event.type === 'invoice.payment_succeeded') {
        // No-op besides logging; usage period reset handled by worker using current_period_end
        console.log('[StripeWebhook] invoice.payment_succeeded received');
      }

      return res.json({ received: true });
    } catch (err) {
      console.error('[StripeWebhook] Processing error:', err);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

module.exports = router;

