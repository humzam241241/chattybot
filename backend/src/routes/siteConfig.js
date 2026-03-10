const express = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { getEffectiveRaffySettings } = require('../services/raffySettings');

const router = express.Router();

/**
 * GET /site-config/:site_id
 * 
 * Public endpoint called by the widget on load to fetch branding config.
 * Only exposes non-sensitive fields — no system prompt, no internal data.
 */
router.get('/:site_id', apiLimiter, async (req, res) => {
  const { site_id } = req.params;

  // Basic UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(site_id)) {
    return res.status(400).json({ error: 'Invalid site_id' });
  }

  try {
    const settings = await getEffectiveRaffySettings(site_id);
    if (!settings) return res.status(404).json({ error: 'Site not found' });

    const { site, raffy } = settings;
    const suggested = Array.isArray(raffy?.ui?.suggested_questions)
      ? raffy.ui.suggested_questions.slice(0, 8).map((s) => String(s)).filter(Boolean)
      : [];

    return res.json({
      config: {
        id: site.id,
        company_name: site.company_name,
        primary_color: site.primary_color,
        tone: site.tone,
        intro_message: raffy?.ui?.intro_message || undefined,
        suggested_questions: suggested,
        booking_url: raffy?.booking?.url || undefined,
        booking_embed: Boolean(raffy?.booking?.embed),
        booking_button_text: raffy?.booking?.button_text ? String(raffy.booking.button_text) : undefined,
      },
    });
  } catch (err) {
    console.error('Site config error:', err);
    return res.status(500).json({ error: 'Failed to fetch config' });
  }
});

module.exports = router;
