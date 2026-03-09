/**
 * Stripe Price ID → Plan mapping
 *
 * Configure by env so you don't hardcode sensitive identifiers.
 * Supports both new naming (STARTER/PRO/AGENCY) and existing (MONTHLY/YEARLY/LIFETIME).
 */

const PRICE_TO_PLAN = {};

const starter = process.env.STRIPE_PRICE_ID_STARTER || process.env.STRIPE_PRICE_ID_MONTHLY;
const pro = process.env.STRIPE_PRICE_ID_PRO || process.env.STRIPE_PRICE_ID_YEARLY;
const agency = process.env.STRIPE_PRICE_ID_AGENCY;

if (starter) PRICE_TO_PLAN[starter] = 'starter';
if (pro) PRICE_TO_PLAN[pro] = 'pro';
if (agency) PRICE_TO_PLAN[agency] = 'agency';

module.exports = PRICE_TO_PLAN;

