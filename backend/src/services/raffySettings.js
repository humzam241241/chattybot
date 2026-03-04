const pool = require('../config/database');

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

const DEFAULT_RAFFY_SETTINGS = {
  name: 'Raffy',
  role: 'AI assistant',
  tone: 'friendly, confident, never cocky',
  guardrails: {
    wont_say: [
      'Do not claim you are a human.',
      'Do not invent pricing, policies, or legal/medical advice.',
      'Do not request sensitive personal data.',
    ],
  },
  escalation_triggers: {
    keywords: ['human', 'agent', 'representative', 'call me', 'email me', 'talk to someone'],
  },
  emergency: {
    keywords: ['emergency', 'suicide', 'self-harm', 'harm myself', 'call 911', 'ambulance'],
    response: "If this is an emergency, please call your local emergency number immediately. If you're in the US, call 911.",
  },
  sales_prompts: {
    cta: '',
  },
  humor: {
    enabled: false,
    guidelines: '',
  },
  booking: {
    url: '',
    keywords: ['book', 'booking', 'appointment', 'schedule', 'calendar', 'meeting', 'demo', 'consultation'],
    prompt: 'Want to book a call?',
  },
  ui: {
    intro_message: "Hi! I'm here to help. Ask me anything about our products or services.",
    suggested_questions: [
      'What services do you offer?',
      'What are your pricing options?',
      'How can I contact support?',
    ],
  },
  notifications: {
    lead_email: '',
  },
};

function deepMerge(base, override) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(override || {})) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function getEffectiveRaffySettings(siteId) {
  let globalSettings = {};
  try {
    const globalRes = await pool.query('SELECT settings FROM global_settings WHERE id = 1');
    globalSettings = globalRes.rows[0]?.settings || {};
  } catch (e) {
    // If migration hasn't been applied yet, fallback to defaults.
    globalSettings = {};
  }

  const siteRes = await pool.query(
    'SELECT id, company_name, primary_color, tone, system_prompt, raffy_overrides FROM sites WHERE id = $1',
    [siteId]
  );
  if (siteRes.rows.length === 0) return null;

  const site = siteRes.rows[0];
  const overrides = site.raffy_overrides || {};
  const merged = deepMerge(deepMerge(DEFAULT_RAFFY_SETTINGS, globalSettings), overrides);

  return {
    site,
    raffy: merged,
  };
}

module.exports = { getEffectiveRaffySettings, deepMerge };

