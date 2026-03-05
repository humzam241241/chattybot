const pool = require('../config/database');

// Simple in-memory cache for site settings (5 min TTL)
const settingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    keywords: ['suicide', 'self-harm', 'harm myself', 'kill myself', '911', 'ambulance', 'overdose', 'dying'],
    response: "If this is a life-threatening emergency, please call your local emergency number immediately. If you're in the US, call 911.",
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
  // Check cache first
  const cached = settingsCache.get(siteId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[RaffySettings] Cache hit for site ${siteId}`);
    return cached.data;
  }

  let globalSettings = {};
  try {
    const globalRes = await pool.query('SELECT settings FROM global_settings WHERE id = 1');
    globalSettings = globalRes.rows[0]?.settings || {};
  } catch (e) {
    // If migration hasn't been applied yet, fallback to defaults.
    globalSettings = {};
  }

  // Try to fetch site with all columns, but handle missing columns gracefully
  let siteRes;
  try {
    siteRes = await pool.query(
      'SELECT id, company_name, primary_color, tone, system_prompt, raffy_overrides FROM sites WHERE id = $1',
      [siteId]
    );
  } catch (err) {
    // If raffy_overrides column doesn't exist, try without it
    if (err.message && err.message.includes('raffy_overrides')) {
      siteRes = await pool.query(
        'SELECT id, company_name, primary_color, tone, system_prompt FROM sites WHERE id = $1',
        [siteId]
      );
    } else {
      throw err;
    }
  }

  if (siteRes.rows.length === 0) return null;

  const site = siteRes.rows[0];
  
  // Safely extract overrides - handle when column doesn't exist or is null
  let overrides = {};
  if (site.raffy_overrides) {
    // If it's a string (JSON), parse it
    if (typeof site.raffy_overrides === 'string') {
      try {
        overrides = JSON.parse(site.raffy_overrides);
      } catch (e) {
        console.warn('Failed to parse raffy_overrides JSON:', e);
        overrides = {};
      }
    } else if (isPlainObject(site.raffy_overrides)) {
      overrides = site.raffy_overrides;
    }
  }

  const merged = deepMerge(deepMerge(DEFAULT_RAFFY_SETTINGS, globalSettings), overrides);

  const result = {
    site,
    raffy: merged,
  };

  // Cache the result
  settingsCache.set(siteId, {
    data: result,
    timestamp: Date.now(),
  });
  
  console.log(`[RaffySettings] Cached settings for site ${siteId}`);

  return result;
}

// Export a function to clear cache (useful for admin updates)
function clearSettingsCache(siteId = null) {
  if (siteId) {
    settingsCache.delete(siteId);
    console.log(`[RaffySettings] Cleared cache for site ${siteId}`);
  } else {
    settingsCache.clear();
    console.log('[RaffySettings] Cleared all settings cache');
  }
}

module.exports = { getEffectiveRaffySettings, deepMerge, clearSettingsCache };

