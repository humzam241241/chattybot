const pool = require('../config/database');

function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(input || '')
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .split('/')[0]
      .toLowerCase();
  }
}

function getRequestDomainFromHeaders(headers) {
  const origin = headers?.origin || headers?.referer || '';
  return normalizeDomain(origin);
}

async function resolveSiteIdFromHeaders(headers) {
  const requestDomain = getRequestDomainFromHeaders(headers);
  if (!requestDomain) return null;

  const r = await pool.query(
    `SELECT id, domain
     FROM sites
     WHERE domain IS NOT NULL
       AND domain <> ''`
  );

  for (const row of r.rows) {
    const allowed = normalizeDomain(row.domain);
    if (allowed && allowed === requestDomain) return row.id;
  }

  return null;
}

module.exports = {
  resolveSiteIdFromHeaders,
};

