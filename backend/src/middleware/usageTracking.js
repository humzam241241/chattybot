/**
 * Usage Tracking Middleware
 * 
 * Records API usage per site for admin overview
 */
const pool = require('../config/database');

async function trackApiUsage(siteId, endpoint) {
  if (!siteId) return;
  
  try {
    await pool.query('SELECT increment_api_usage($1, $2)', [siteId, endpoint]);
  } catch (err) {
    console.error('[UsageTracking] Failed to track API usage:', err.message);
  }
}

async function trackSmsUsage(siteId, direction) {
  if (!siteId) return;
  
  try {
    await pool.query('SELECT increment_sms_usage($1, $2)', [siteId, direction]);
  } catch (err) {
    console.error('[UsageTracking] Failed to track SMS usage:', err.message);
  }
}

function createUsageMiddleware(endpoint) {
  return (req, res, next) => {
    const siteId = req.params.site_id || req.body.site_id || req.query.site_id;
    if (siteId) {
      trackApiUsage(siteId, endpoint).catch(() => {});
    }
    next();
  };
}

module.exports = { trackApiUsage, trackSmsUsage, createUsageMiddleware };
