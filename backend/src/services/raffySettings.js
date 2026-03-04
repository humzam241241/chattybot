const pool = require('../config/database');

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

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
  const globalRes = await pool.query('SELECT settings FROM global_settings WHERE id = 1');
  const globalSettings = globalRes.rows[0]?.settings || {};

  const siteRes = await pool.query(
    'SELECT id, company_name, tone, system_prompt, raffy_overrides FROM sites WHERE id = $1',
    [siteId]
  );
  if (siteRes.rows.length === 0) return null;

  const site = siteRes.rows[0];
  const overrides = site.raffy_overrides || {};
  const merged = deepMerge(globalSettings, overrides);

  return {
    site,
    raffy: merged,
  };
}

module.exports = { getEffectiveRaffySettings, deepMerge };

