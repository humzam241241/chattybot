const pool = require('../config/database');

/**
 * Verifies the request Origin header matches the domain registered for this site.
 * Applied on the /chat endpoint to prevent hotlinking/abuse.
 * 
 * We cache the lookup in a simple in-memory map to avoid a DB hit per message.
 * Cache TTL is 5 minutes — good enough for MVP.
 */
const domainCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getSiteDomain(siteId) {
  const cached = domainCache.get(siteId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.domain;
  }

  const result = await pool.query(
    'SELECT domain FROM sites WHERE id = $1',
    [siteId]
  );

  if (result.rows.length === 0) return null;

  const domain = result.rows[0].domain;
  domainCache.set(siteId, { domain, ts: Date.now() });
  return domain;
}

function normalizeDomain(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw?.replace(/^www\./, '').replace(/^https?:\/\//, '');
  }
}

async function domainVerify(req, res, next) {
  // Skip verification in development
  if (process.env.NODE_ENV !== 'production') return next();

  const siteId = req.body?.site_id || req.params?.site_id;
  if (!siteId) return res.status(400).json({ error: 'site_id required' });

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    // Allow server-to-server calls without origin (e.g. Postman / admin)
    return next();
  }

  try {
    const registeredDomain = await getSiteDomain(siteId);
    if (!registeredDomain) return res.status(404).json({ error: 'Site not found' });

    const requestDomain = normalizeDomain(origin);
    const allowed = normalizeDomain(registeredDomain);

    if (requestDomain !== allowed) {
      return res.status(403).json({
        error: 'Domain mismatch. This widget is not authorized for this domain.',
      });
    }

    next();
  } catch (err) {
    console.error('domainVerify error:', err);
    next(); // Fail open to not break the widget on DB hiccup
  }
}

module.exports = domainVerify;
