// Canonical plan config (limits are messages/month; prices in CAD/month).
const PLANS = {
  monthly: {
    name: 'Monthly',
    plan_key: 'starter',
    message_limit: 5000,
    price_cad: 50,
  },
  pro: {
    name: 'Pro',
    plan_key: 'pro',
    message_limit: 20000,
    price_cad: 150,
  },
  agency: {
    name: 'Agency',
    plan_key: 'agency',
    message_limit: 100000,
    price_cad: 400,
  },
};

// Back-compat exports used elsewhere in the codebase.
const PLAN_LIMITS = {
  starter: 5000,
  pro: 20000,
  agency: 100000,
};

const PLAN_PRICES = {
  starter: 50,
  pro: 150,
  agency: 400,
};

module.exports = { PLANS, PLAN_LIMITS, PLAN_PRICES };

