/**
 * Stripe Price ID → Plan mapping
 *
 * Configure by env so you don't hardcode identifiers.
 *
 * Expected envs for this SaaS setup:
 * - STRIPE_PRICE_ID_PRO      -> pro
 * - STRIPE_PRICE_ID_PLUS     -> plus
 * - STRIPE_PRICE_ID_ULTRA    -> ultra
 *
 * Back-compat:
 * - STRIPE_PRICE_ID_MONTHLY  -> pro
 * - STRIPE_PRICE_ID_AGENCY   -> ultra
 */

const PRICE_TO_PLAN = {};

const monthly = process.env.STRIPE_PRICE_ID_MONTHLY; // legacy
const pro = process.env.STRIPE_PRICE_ID_PRO;
const plus = process.env.STRIPE_PRICE_ID_PLUS;
const ultra = process.env.STRIPE_PRICE_ID_ULTRA;
const agency = process.env.STRIPE_PRICE_ID_AGENCY; // legacy alias

if (monthly) PRICE_TO_PLAN[monthly] = 'pro';
if (pro) PRICE_TO_PLAN[pro] = 'pro';
if (plus) PRICE_TO_PLAN[plus] = 'plus';
if (ultra) PRICE_TO_PLAN[ultra] = 'ultra';
if (agency) PRICE_TO_PLAN[agency] = 'ultra';

module.exports = PRICE_TO_PLAN;

