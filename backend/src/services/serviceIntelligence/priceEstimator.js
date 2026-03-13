/**
 * Price Estimator
 * Generates price estimates based on historical job data and protocols.
 */

/**
 * Get historical jobs matching criteria
 */
async function getHistoricalJobs(pool, siteId, options = {}) {
  const { industryId, jobType, city, state, limit = 50 } = options;

  let query = `
    SELECT * FROM historical_jobs
    WHERE site_id = $1
  `;
  const params = [siteId];

  if (industryId) {
    query += ` AND industry_id = $${params.length + 1}`;
    params.push(industryId);
  }

  if (jobType) {
    query += ` AND job_type = $${params.length + 1}`;
    params.push(jobType);
  }

  if (city) {
    query += ` AND LOWER(city) = LOWER($${params.length + 1})`;
    params.push(city);
  }

  if (state) {
    query += ` AND LOWER(state) = LOWER($${params.length + 1})`;
    params.push(state);
  }

  query += ` ORDER BY completed_at DESC NULLS LAST LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Calculate statistics from historical jobs
 */
function calculateJobStats(jobs) {
  if (jobs.length === 0) {
    return null;
  }

  const prices = jobs.map(j => parseFloat(j.final_price)).filter(p => !isNaN(p));
  const laborHours = jobs.map(j => parseFloat(j.labor_hours)).filter(h => !isNaN(h));
  const materialCosts = jobs.map(j => parseFloat(j.material_cost)).filter(c => !isNaN(c));
  const scopeCreep = jobs.map(j => parseFloat(j.scope_creep_cost) || 0);

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const min = arr => Math.min(...arr);
  const max = arr => Math.max(...arr);
  const percentile = (arr, p) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  return {
    count: jobs.length,
    price: {
      avg: avg(prices),
      min: min(prices),
      max: max(prices),
      p25: percentile(prices, 25),
      p75: percentile(prices, 75),
    },
    laborHours: laborHours.length > 0 ? {
      avg: avg(laborHours),
      min: min(laborHours),
      max: max(laborHours),
    } : null,
    materialCost: materialCosts.length > 0 ? {
      avg: avg(materialCosts),
      min: min(materialCosts),
      max: max(materialCosts),
    } : null,
    scopeCreep: {
      avg: avg(scopeCreep),
      max: max(scopeCreep),
      frequency: scopeCreep.filter(s => s > 0).length / jobs.length,
    },
  };
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(historicalStats, protocolData) {
  if (!historicalStats && !protocolData) {
    return { level: 'low', reasoning: 'No historical data or protocol available' };
  }

  if (historicalStats && historicalStats.count >= 10) {
    return { level: 'high', reasoning: `Based on ${historicalStats.count} similar completed jobs` };
  }

  if (historicalStats && historicalStats.count >= 3) {
    return { level: 'medium', reasoning: `Based on ${historicalStats.count} similar jobs (limited data)` };
  }

  if (protocolData) {
    return { level: 'medium', reasoning: 'Based on industry standard pricing (no site-specific history)' };
  }

  return { level: 'low', reasoning: 'Limited data available for accurate estimate' };
}

/**
 * Generate a price estimate
 * @param {Pool} pool - Database pool
 * @param {Object} options - Estimate options
 * @param {string} options.siteId - Site ID for tenant isolation
 * @param {string} [options.industry] - Industry slug
 * @param {string} [options.industryId] - Industry UUID
 * @param {string} options.jobType - Job type to estimate
 * @param {string} [options.city] - City for regional pricing
 * @param {string} [options.state] - State for regional pricing
 * @param {string} [options.projectSize] - small/medium/large
 * @param {number} [options.complexityScore] - 1-10 complexity score
 */
async function generateEstimate(pool, options) {
  const { siteId, industry, industryId: providedIndustryId, jobType, city, state, projectSize, complexityScore } = options;

  // Resolve industry ID from slug if needed
  let industryId = providedIndustryId;
  if (!industryId && industry) {
    const industryResult = await pool.query(
      'SELECT id FROM industries WHERE slug = $1',
      [industry]
    );
    industryId = industryResult.rows[0]?.id;
  }

  // Get historical data
  const historicalJobs = await getHistoricalJobs(pool, siteId, {
    industryId,
    jobType,
    city,
    state,
    limit: 100,
  });

  const historicalStats = calculateJobStats(historicalJobs);

  // Get protocol data
  let protocolData = null;
  if (industryId && jobType) {
    const protocolResult = await pool.query(
      `SELECT * FROM service_protocols WHERE industry_id = $1 AND job_type = $2`,
      [industryId, jobType]
    );
    protocolData = protocolResult.rows[0];
  }

  // Get site config for adjustments
  let siteConfig = null;
  if (industryId) {
    const configResult = await pool.query(
      `SELECT * FROM site_industry_config WHERE site_id = $1 AND industry_id = $2`,
      [siteId, industryId]
    );
    siteConfig = configResult.rows[0];
  }

  // Calculate estimate
  let priceLow, priceHigh, recommendedPrice;
  let timelineDaysMin, timelineDaysMax;

  if (historicalStats && historicalStats.count >= 3) {
    // Use historical data as primary source
    priceLow = historicalStats.price.p25;
    priceHigh = historicalStats.price.p75;
    recommendedPrice = historicalStats.price.avg;

    // Estimate timeline from labor hours
    if (historicalStats.laborHours) {
      const hoursPerDay = 6; // Assume 6 productive hours per day
      timelineDaysMin = Math.ceil(historicalStats.laborHours.min / hoursPerDay);
      timelineDaysMax = Math.ceil(historicalStats.laborHours.max / hoursPerDay);
    }
  } else if (protocolData) {
    // Fall back to protocol data
    priceLow = parseFloat(protocolData.typical_price_min);
    priceHigh = parseFloat(protocolData.typical_price_max);
    recommendedPrice = (priceLow + priceHigh) / 2;

    if (protocolData.typical_labor_hours_min) {
      const hoursPerDay = 6;
      timelineDaysMin = Math.ceil(protocolData.typical_labor_hours_min / hoursPerDay);
      timelineDaysMax = Math.ceil(protocolData.typical_labor_hours_max / hoursPerDay);
    }
  } else {
    return {
      ok: false,
      error: 'Insufficient data for estimate',
      confidence: { level: 'low', reasoning: 'No historical or protocol data available' },
    };
  }

  // Apply complexity adjustment
  if (complexityScore && complexityScore > 5) {
    const complexityMultiplier = 1 + ((complexityScore - 5) * 0.1);
    priceLow *= complexityMultiplier;
    priceHigh *= complexityMultiplier;
    recommendedPrice *= complexityMultiplier;
  }

  // Apply site markup
  if (siteConfig && siteConfig.markup_percentage) {
    const markup = 1 + (siteConfig.markup_percentage / 100);
    priceLow *= markup;
    priceHigh *= markup;
    recommendedPrice *= markup;
  }

  // Apply minimum job price
  if (siteConfig && siteConfig.minimum_job_price) {
    priceLow = Math.max(priceLow, siteConfig.minimum_job_price);
  }

  // Round prices
  priceLow = Math.round(priceLow);
  priceHigh = Math.round(priceHigh);
  recommendedPrice = Math.round(recommendedPrice);

  // Ensure timeline minimums
  timelineDaysMin = timelineDaysMin || 1;
  timelineDaysMax = timelineDaysMax || timelineDaysMin;

  const confidence = determineConfidence(historicalStats, protocolData);

  // Apply project size adjustment
  let sizeMultiplier = 1;
  if (projectSize === 'small') sizeMultiplier = 0.7;
  else if (projectSize === 'large') sizeMultiplier = 1.5;

  priceLow = Math.round(priceLow * sizeMultiplier);
  priceHigh = Math.round(priceHigh * sizeMultiplier);
  recommendedPrice = Math.round(recommendedPrice * sizeMultiplier);

  return {
    ok: true,
    price_low: priceLow,
    price_high: priceHigh,
    recommended_price: recommendedPrice,
    timeline_days_min: timelineDaysMin,
    timeline_days_max: timelineDaysMax,
    timeline_days: `${timelineDaysMin}-${timelineDaysMax}`,
    confidence_level: confidence.level,
    confidence_reasoning: confidence.reasoning,
    historical_jobs_count: historicalStats?.count || 0,
    data_source: historicalStats?.count >= 3 ? 'historical' : 'protocol',
    scope_of_work: protocolData?.scope_of_work || null,
    risk_warnings: protocolData?.risk_factors ? JSON.parse(protocolData.risk_factors) : [],
  };
}

/**
 * Record a completed job for future estimates
 */
async function recordCompletedJob(pool, siteId, jobData) {
  const {
    industryId,
    jobType,
    projectSize,
    complexityScore,
    laborHours,
    materialCost,
    finalPrice,
    scopeCreepCost,
    city,
    state,
    zipCode,
    customerSatisfaction,
    notes,
    completedAt,
  } = jobData;

  const result = await pool.query(
    `INSERT INTO historical_jobs (
      site_id, industry_id, job_type, project_size, complexity_score,
      labor_hours, material_cost, final_price, scope_creep_cost,
      city, state, zip_code, customer_satisfaction, notes, completed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      siteId,
      industryId,
      jobType,
      projectSize || null,
      complexityScore || null,
      laborHours || null,
      materialCost || null,
      finalPrice,
      scopeCreepCost || 0,
      city || null,
      state || null,
      zipCode || null,
      customerSatisfaction || null,
      notes || null,
      completedAt || new Date(),
    ]
  );

  return result.rows[0];
}

module.exports = {
  getHistoricalJobs,
  calculateJobStats,
  determineConfidence,
  generateEstimate,
  recordCompletedJob,
};
