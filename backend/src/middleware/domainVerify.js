const pool = require('../config/database');

/**
 * Domain verification middleware for chat endpoints.
 * Prevents unauthorized domains from using the widget while allowing legitimate requests.
 * 
 * Strategy:
 * - Sites with no domain configured → ALLOW (no restrictions)
 * - Sites with domain configured → VERIFY match
 * - Normalize both domains before comparison (remove www, protocol, trailing slashes)
 * - Cache lookups to avoid DB hits on every message
 */

const domainCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the registered domain for a site from the database.
 * Caches results to minimize DB queries.
 */
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

/**
 * Normalize a domain string for comparison.
 * 
 * Examples:
 * - "https://www.example.com/" → "example.com"
 * - "http://example.com" → "example.com"
 * - "www.example.com" → "example.com"
 * - "example.com/" → "example.com"
 * 
 * @param {string} input - Domain or URL string
 * @returns {string} - Normalized hostname in lowercase
 */
function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';
  
  try {
    // Try parsing as URL (handles full URLs with protocol)
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // Fallback: manual cleanup for edge cases
    return input
      .replace(/^https?:\/\//, '')  // Remove protocol
      .replace(/^www\./, '')         // Remove www prefix
      .replace(/\/$/, '')            // Remove trailing slash
      .split('/')[0]                 // Take only hostname
      .toLowerCase();
  }
}

/**
 * Extract the request domain from headers.
 * Checks Origin first, then falls back to Referer.
 * 
 * @param {object} req - Express request object
 * @returns {string} - Normalized request domain
 */
function getRequestDomain(req) {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return '';
  return normalizeDomain(origin);
}

/**
 * Domain verification middleware.
 * 
 * Flow:
 * 1. Skip in development mode
 * 2. Extract site_id from request
 * 3. Get request domain from headers
 * 4. Fetch registered domain from DB
 * 5. If no domain configured → ALLOW
 * 6. If domains match → ALLOW
 * 7. Otherwise → 403 Forbidden
 */
async function domainVerify(req, res, next) {
  // Skip verification in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Extract site_id from body or params
  const siteId = req.body?.site_id || req.params?.site_id;
  if (!siteId) {
    return res.status(400).json({ error: 'site_id required' });
  }

  // Get request domain
  const requestDomain = getRequestDomain(req);
  
  // Allow requests without origin (server-to-server, testing tools)
  if (!requestDomain) {
    return next();
  }

  try {
    // Fetch registered domain from DB
    const registeredDomain = await getSiteDomain(siteId);
    
    // Site not found in database
    if (registeredDomain === null) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Normalize the registered domain
    const allowedDomain = normalizeDomain(registeredDomain);

    // No domain configured → allow all requests
    if (!allowedDomain) {
      return next();
    }

    // Check if domains match
    if (requestDomain === allowedDomain) {
      return next();
    }

    // Log mismatch for debugging (always, even in production)
    console.warn(`[domainVerify] BLOCKED: request="${requestDomain}" vs allowed="${allowedDomain}" for site=${siteId}`);

    // Domain mismatch → block request
    return res.status(403).json({
      error: 'Domain not authorized. This widget is not configured for this domain.',
      requestDomain,
      allowedDomain,
    });

  } catch (err) {
    console.error('[domainVerify] Error:', err);
    // Fail open to prevent breaking the widget on transient DB errors
    return next();
  }
}

module.exports = domainVerify;
