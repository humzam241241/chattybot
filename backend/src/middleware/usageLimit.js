const { checkLimit } = require('../services/usageService');

module.exports = async function usageLimit(req, res, next) {
  try {
    const siteId = req.body?.site_id || req.params?.site_id || req.query?.site_id;
    if (!siteId) return next();

    await checkLimit(siteId);
    next();
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Site not found' });
    if (err.status === 429) {
      return res.status(429).json({
        error: err.message || 'Message limit reached',
        plan: err.plan,
        limit: err.limit,
        used: err.used,
      });
    }

    console.error('[UsageLimit] Error checking limits:', err.message);
    // Fail-safe: do not block chat on usage check errors
    next();
  }
};

