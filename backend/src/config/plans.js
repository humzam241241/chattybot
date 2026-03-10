// Canonical plan config (limits are messages/month; prices in USD/month).
//
// Plans:
// - pro   ($50/mo)  -> 5k messages/mo
// - plus  ($150/mo) -> 10k messages/mo
// - ultra ($400/mo) -> 20k messages/mo
const PLANS = {
  pro: {
    name: 'Pro',
    plan_key: 'pro',
    message_limit: 5000,
    price_usd: 50,
  },
  plus: {
    name: 'Plus',
    plan_key: 'plus',
    message_limit: 10000,
    price_usd: 150,
  },
  ultra: {
    name: 'Ultra',
    plan_key: 'ultra',
    message_limit: 20000,
    price_usd: 400,
  },
};

// Back-compat exports used elsewhere in the codebase.
// Keep starter as an alias for pro so older rows don't break.
const PLAN_LIMITS = {
  starter: 5000,
  pro: 5000,
  plus: 10000,
  ultra: 20000,
};

const PLAN_PRICES = {
  starter: 50,
  pro: 50,
  plus: 150,
  ultra: 400,
};

module.exports = { PLANS, PLAN_LIMITS, PLAN_PRICES };

