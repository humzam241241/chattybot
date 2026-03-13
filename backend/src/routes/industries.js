/**
 * Industries API Routes
 * Handles industry and protocol management
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { userAuth, requireAdmin } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const {
  getIndustries,
  getProtocolsForIndustry,
  getAllProtocols,
} = require('../services/serviceIntelligence/problemClassifier');
const {
  listProtocolsForIndustry,
  upsertSiteProtocol,
  getSiteIndustryConfig,
} = require('../services/serviceIntelligence/protocolEngine');

/**
 * GET /api/industries
 * List all active industries
 */
router.get('/', async (req, res) => {
  try {
    const industries = await getIndustries(pool);
    res.json(industries);
  } catch (err) {
    console.error('[industries] List error:', err);
    res.status(500).json({ error: 'Failed to list industries' });
  }
});

/**
 * GET /api/industries/:industry_id/protocols
 * List protocols for an industry
 */
router.get('/:industry_id/protocols', async (req, res) => {
  try {
    const { industry_id } = req.params;
    const protocols = await listProtocolsForIndustry(pool, industry_id);
    res.json(protocols);
  } catch (err) {
    console.error('[industries] Protocols error:', err);
    res.status(500).json({ error: 'Failed to list protocols' });
  }
});

/**
 * GET /api/industries/protocols
 * List all protocols across industries
 */
router.get('/all/protocols', async (req, res) => {
  try {
    const protocols = await getAllProtocols(pool);
    res.json(protocols);
  } catch (err) {
    console.error('[industries] All protocols error:', err);
    res.status(500).json({ error: 'Failed to list all protocols' });
  }
});

/**
 * POST /api/industries/:industry_id/protocols
 * Create or update a protocol (admin only)
 */
router.post('/:industry_id/protocols', userAuth, requireAdmin, async (req, res) => {
  try {
    const { industry_id } = req.params;
    const protocolData = req.body;

    if (!protocolData.jobType) {
      return res.status(400).json({ error: 'Job type is required' });
    }

    const protocol = await upsertSiteProtocol(pool, null, industry_id, protocolData);
    res.status(201).json(protocol);
  } catch (err) {
    console.error('[industries] Create protocol error:', err);
    res.status(500).json({ error: 'Failed to create protocol' });
  }
});

/**
 * GET /api/industries/site/:site_id/config
 * Get site industry configurations
 */
router.get('/site/:site_id/config', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await pool.query(
      `SELECT sic.*, i.slug as industry_slug, i.name as industry_name
       FROM site_industry_config sic
       JOIN industries i ON sic.industry_id = i.id
       WHERE sic.site_id = $1 AND sic.is_active = true`,
      [site_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[industries] Site config error:', err);
    res.status(500).json({ error: 'Failed to get site config' });
  }
});

/**
 * POST /api/industries/site/:site_id/config
 * Create or update site industry configuration
 */
router.post('/site/:site_id/config', userAuth, async (req, res) => {
  try {
    const { site_id } = req.params;
    const {
      industryId,
      laborRatePerHour,
      markupPercentage,
      minimumJobPrice,
      serviceRadiusMiles,
      serviceZipCodes,
      leadTimeDays,
      maxJobsPerDay,
      customProtocols,
      customFollowUpSchedule,
    } = req.body;

    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!industryId) {
      return res.status(400).json({ error: 'Industry ID is required' });
    }

    const result = await pool.query(
      `INSERT INTO site_industry_config (
        site_id, industry_id, labor_rate_per_hour, markup_percentage,
        minimum_job_price, service_radius_miles, service_zip_codes,
        lead_time_days, max_jobs_per_day, custom_protocols, custom_follow_up_schedule
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (site_id, industry_id) DO UPDATE SET
        labor_rate_per_hour = COALESCE(EXCLUDED.labor_rate_per_hour, site_industry_config.labor_rate_per_hour),
        markup_percentage = COALESCE(EXCLUDED.markup_percentage, site_industry_config.markup_percentage),
        minimum_job_price = COALESCE(EXCLUDED.minimum_job_price, site_industry_config.minimum_job_price),
        service_radius_miles = COALESCE(EXCLUDED.service_radius_miles, site_industry_config.service_radius_miles),
        service_zip_codes = COALESCE(EXCLUDED.service_zip_codes, site_industry_config.service_zip_codes),
        lead_time_days = COALESCE(EXCLUDED.lead_time_days, site_industry_config.lead_time_days),
        max_jobs_per_day = COALESCE(EXCLUDED.max_jobs_per_day, site_industry_config.max_jobs_per_day),
        custom_protocols = COALESCE(EXCLUDED.custom_protocols, site_industry_config.custom_protocols),
        custom_follow_up_schedule = COALESCE(EXCLUDED.custom_follow_up_schedule, site_industry_config.custom_follow_up_schedule),
        updated_at = NOW()
      RETURNING *`,
      [
        site_id,
        industryId,
        laborRatePerHour || null,
        markupPercentage || null,
        minimumJobPrice || null,
        serviceRadiusMiles || null,
        JSON.stringify(serviceZipCodes || []),
        leadTimeDays || null,
        maxJobsPerDay || null,
        JSON.stringify(customProtocols || {}),
        JSON.stringify(customFollowUpSchedule || []),
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[industries] Save config error:', err);
    res.status(500).json({ error: 'Failed to save site config' });
  }
});

module.exports = router;
