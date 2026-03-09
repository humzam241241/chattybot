/**
 * Stripe Price ID → Plan mapping
 *
 * Configure by env so you don't hardcode identifiers.
 *
 * Expected envs for this SaaS setup:
 * - STRIPE_PRICE_ID_MONTHLY  -> starter
 * - STRIPE_PRICE_ID_PRO      -> pro
 * - STRIPE_PRICE_ID_AGENCY   -> agency
 */

const PRICE_TO_PLAN = {};

const monthly = process.env.STRIPE_PRICE_ID_MONTHLY;
const pro = process.env.STRIPE_PRICE_ID_PRO;
const agency = process.env.STRIPE_PRICE_ID_AGENCY;

if (monthly) PRICE_TO_PLAN[monthly] = 'starter';
if (pro) PRICE_TO_PLAN[pro] = 'pro';
if (agency) PRICE_TO_PLAN[agency] = 'agency';

module.exports = PRICE_TO_PLAN;

