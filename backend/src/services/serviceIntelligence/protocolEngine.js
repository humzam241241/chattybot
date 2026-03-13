/**
 * Protocol Engine
 * Fetches and applies service protocols for job types.
 * Returns scope of work, risk factors, and baseline estimates.
 */

/**
 * Get a service protocol by ID
 */
async function getProtocol(pool, protocolId) {
  const result = await pool.query(
    `SELECT sp.*, i.slug as industry_slug, i.name as industry_name
     FROM service_protocols sp
     JOIN industries i ON sp.industry_id = i.id
     WHERE sp.id = $1`,
    [protocolId]
  );
  return result.rows[0];
}

/**
 * Get a protocol by industry and job type
 */
async function getProtocolByJobType(pool, industryId, jobType) {
  const result = await pool.query(
    `SELECT sp.*, i.slug as industry_slug, i.name as industry_name
     FROM service_protocols sp
     JOIN industries i ON sp.industry_id = i.id
     WHERE sp.industry_id = $1 AND sp.job_type = $2 AND sp.is_active = true`,
    [industryId, jobType]
  );
  return result.rows[0];
}

/**
 * Get protocol by industry slug and job type
 */
async function getProtocolBySlug(pool, industrySlug, jobType) {
  const result = await pool.query(
    `SELECT sp.*, i.slug as industry_slug, i.name as industry_name
     FROM service_protocols sp
     JOIN industries i ON sp.industry_id = i.id
     WHERE i.slug = $1 AND sp.job_type = $2 AND sp.is_active = true`,
    [industrySlug, jobType]
  );
  return result.rows[0];
}

/**
 * Get site-specific industry configuration
 */
async function getSiteIndustryConfig(pool, siteId, industryId) {
  const result = await pool.query(
    `SELECT * FROM site_industry_config
     WHERE site_id = $1 AND industry_id = $2 AND is_active = true`,
    [siteId, industryId]
  );
  return result.rows[0];
}

/**
 * Apply site-specific adjustments to protocol pricing
 */
function applyPricingAdjustments(protocol, siteConfig) {
  if (!siteConfig) {
    return {
      laborHoursMin: protocol.typical_labor_hours_min,
      laborHoursMax: protocol.typical_labor_hours_max,
      materialCostMin: protocol.material_cost_min,
      materialCostMax: protocol.material_cost_max,
      priceMin: protocol.typical_price_min,
      priceMax: protocol.typical_price_max,
    };
  }

  const markup = (siteConfig.markup_percentage || 0) / 100;
  const laborRate = siteConfig.labor_rate_per_hour;

  let priceMin = protocol.typical_price_min;
  let priceMax = protocol.typical_price_max;

  // If site has custom labor rate, recalculate
  if (laborRate && protocol.typical_labor_hours_min) {
    const laborMin = protocol.typical_labor_hours_min * laborRate;
    const laborMax = protocol.typical_labor_hours_max * laborRate;
    priceMin = laborMin + protocol.material_cost_min;
    priceMax = laborMax + protocol.material_cost_max;
  }

  // Apply markup
  priceMin = priceMin * (1 + markup);
  priceMax = priceMax * (1 + markup);

  // Apply minimum job price
  if (siteConfig.minimum_job_price && priceMin < siteConfig.minimum_job_price) {
    priceMin = siteConfig.minimum_job_price;
  }

  return {
    laborHoursMin: protocol.typical_labor_hours_min,
    laborHoursMax: protocol.typical_labor_hours_max,
    materialCostMin: protocol.material_cost_min,
    materialCostMax: protocol.material_cost_max,
    priceMin: Math.round(priceMin * 100) / 100,
    priceMax: Math.round(priceMax * 100) / 100,
    laborRate,
    markup: siteConfig.markup_percentage,
  };
}

/**
 * Get full protocol data with site adjustments
 */
async function getProtocolWithSiteConfig(pool, siteId, industryId, jobType) {
  const protocol = await getProtocolByJobType(pool, industryId, jobType);
  if (!protocol) {
    return null;
  }

  const siteConfig = await getSiteIndustryConfig(pool, siteId, industryId);
  const pricing = applyPricingAdjustments(protocol, siteConfig);

  return {
    protocol,
    siteConfig,
    pricing,
    scopeOfWork: protocol.scope_of_work,
    riskFactors: protocol.risk_factors || [],
    requiresInspection: protocol.requires_inspection,
    followUpQuestions: protocol.follow_up_questions || [],
  };
}

/**
 * Get protocol data for a service request
 */
async function getProtocolForRequest(pool, requestId, siteId) {
  const requestResult = await pool.query(
    `SELECT sr.*, i.id as industry_id
     FROM service_requests sr
     LEFT JOIN industries i ON sr.industry_id = i.id
     WHERE sr.id = $1 AND sr.site_id = $2`,
    [requestId, siteId]
  );

  const request = requestResult.rows[0];
  if (!request || !request.industry_id || !request.classified_job_type) {
    return { ok: false, error: 'Request not classified or industry not set' };
  }

  const protocolData = await getProtocolWithSiteConfig(
    pool,
    siteId,
    request.industry_id,
    request.classified_job_type
  );

  if (!protocolData) {
    return { ok: false, error: 'No protocol found for this job type' };
  }

  return { ok: true, ...protocolData, request };
}

/**
 * List all protocols for an industry
 */
async function listProtocolsForIndustry(pool, industryId) {
  const result = await pool.query(
    `SELECT sp.*, i.slug as industry_slug, i.name as industry_name
     FROM service_protocols sp
     JOIN industries i ON sp.industry_id = i.id
     WHERE sp.industry_id = $1 AND sp.is_active = true
     ORDER BY sp.job_type`,
    [industryId]
  );
  return result.rows;
}

/**
 * Create or update a custom protocol for a site
 */
async function upsertSiteProtocol(pool, siteId, industryId, protocolData) {
  const {
    jobType,
    description,
    diagnosisSignals,
    typicalLaborHoursMin,
    typicalLaborHoursMax,
    materialCostMin,
    materialCostMax,
    typicalPriceMin,
    typicalPriceMax,
    scopeOfWork,
    riskFactors,
    requiresInspection,
    urgencyKeywords,
    followUpQuestions,
  } = protocolData;

  // For now, we update the global protocol
  // Future: support site-specific protocol overrides
  const result = await pool.query(
    `INSERT INTO service_protocols (
      industry_id, job_type, description, diagnosis_signals,
      typical_labor_hours_min, typical_labor_hours_max,
      material_cost_min, material_cost_max,
      typical_price_min, typical_price_max,
      scope_of_work, risk_factors, requires_inspection,
      urgency_keywords, follow_up_questions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (industry_id, job_type) DO UPDATE SET
      description = EXCLUDED.description,
      diagnosis_signals = EXCLUDED.diagnosis_signals,
      typical_labor_hours_min = EXCLUDED.typical_labor_hours_min,
      typical_labor_hours_max = EXCLUDED.typical_labor_hours_max,
      material_cost_min = EXCLUDED.material_cost_min,
      material_cost_max = EXCLUDED.material_cost_max,
      typical_price_min = EXCLUDED.typical_price_min,
      typical_price_max = EXCLUDED.typical_price_max,
      scope_of_work = EXCLUDED.scope_of_work,
      risk_factors = EXCLUDED.risk_factors,
      requires_inspection = EXCLUDED.requires_inspection,
      urgency_keywords = EXCLUDED.urgency_keywords,
      follow_up_questions = EXCLUDED.follow_up_questions,
      updated_at = NOW()
    RETURNING *`,
    [
      industryId,
      jobType,
      description,
      JSON.stringify(diagnosisSignals || []),
      typicalLaborHoursMin,
      typicalLaborHoursMax,
      materialCostMin,
      materialCostMax,
      typicalPriceMin,
      typicalPriceMax,
      scopeOfWork,
      JSON.stringify(riskFactors || []),
      requiresInspection !== false,
      JSON.stringify(urgencyKeywords || []),
      JSON.stringify(followUpQuestions || []),
    ]
  );

  return result.rows[0];
}

module.exports = {
  getProtocol,
  getProtocolByJobType,
  getProtocolBySlug,
  getSiteIndustryConfig,
  applyPricingAdjustments,
  getProtocolWithSiteConfig,
  getProtocolForRequest,
  listProtocolsForIndustry,
  upsertSiteProtocol,
};
