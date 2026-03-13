/**
 * Estimate Generator
 * Combines protocol data, historical pricing, and job complexity
 * to generate comprehensive estimates.
 */

const { getProtocolForRequest } = require('./protocolEngine');
const { generateEstimate } = require('./priceEstimator');

/**
 * Generate a full estimate for a service request
 */
async function generateFullEstimate(pool, siteId, requestId, options = {}) {
  const { complexityScore, customAdjustments } = options;

  // Get the service request
  const requestResult = await pool.query(
    `SELECT * FROM service_requests WHERE id = $1 AND site_id = $2`,
    [requestId, siteId]
  );

  const request = requestResult.rows[0];
  if (!request) {
    return { ok: false, error: 'Service request not found' };
  }

  if (!request.classified_job_type || !request.industry_id) {
    return { ok: false, error: 'Service request not yet classified' };
  }

  // Get protocol data
  const protocolResult = await getProtocolForRequest(pool, requestId, siteId);
  if (!protocolResult.ok) {
    return protocolResult;
  }

  const { protocol, pricing, scopeOfWork, riskFactors } = protocolResult;

  // Generate price estimate
  const priceResult = await generateEstimate(pool, siteId, {
    industryId: request.industry_id,
    jobType: request.classified_job_type,
    city: request.city,
    state: request.state,
    complexityScore,
  });

  if (!priceResult.ok) {
    // Fall back to protocol pricing
    return {
      ok: true,
      estimate: {
        priceLow: pricing.priceMin,
        priceHigh: pricing.priceMax,
        recommendedPrice: (pricing.priceMin + pricing.priceMax) / 2,
        timelineDaysMin: 1,
        timelineDaysMax: Math.ceil((protocol.typical_labor_hours_max || 8) / 6),
        scopeOfWork,
        riskFactors,
        confidence: { level: 'low', reasoning: 'Based on protocol defaults only' },
        historicalJobsCount: 0,
      },
      request,
      protocol,
    };
  }

  // Build comprehensive estimate
  const estimate = {
    ...priceResult.estimate,
    scopeOfWork,
    inclusions: buildInclusions(protocol),
    exclusions: buildExclusions(protocol),
    riskWarnings: buildRiskWarnings(riskFactors, request),
    confidence: priceResult.confidence,
    historicalJobsCount: priceResult.historicalJobsCount,
  };

  // Apply custom adjustments if provided
  if (customAdjustments) {
    if (customAdjustments.priceAdjustment) {
      estimate.priceLow += customAdjustments.priceAdjustment;
      estimate.priceHigh += customAdjustments.priceAdjustment;
      estimate.recommendedPrice += customAdjustments.priceAdjustment;
    }
    if (customAdjustments.additionalScope) {
      estimate.scopeOfWork += '\n\n' + customAdjustments.additionalScope;
    }
    if (customAdjustments.additionalRisks) {
      estimate.riskWarnings.push(...customAdjustments.additionalRisks);
    }
  }

  return {
    ok: true,
    estimate,
    request,
    protocol,
  };
}

/**
 * Build inclusions list from protocol
 */
function buildInclusions(protocol) {
  const inclusions = [];

  if (protocol.scope_of_work) {
    const lines = protocol.scope_of_work.split(/[.,]/).filter(l => l.trim());
    inclusions.push(...lines.slice(0, 5).map(l => l.trim()));
  }

  return inclusions;
}

/**
 * Build exclusions list (common exclusions)
 */
function buildExclusions(protocol) {
  const exclusions = [
    'Permits and inspection fees (if required)',
    'Repairs to pre-existing damage discovered during work',
    'Work outside the specified scope',
  ];

  if (protocol.requires_inspection) {
    exclusions.push('Final pricing subject to on-site inspection');
  }

  return exclusions;
}

/**
 * Build risk warnings based on protocol and request
 */
function buildRiskWarnings(riskFactors, request) {
  const warnings = [];

  if (Array.isArray(riskFactors)) {
    warnings.push(...riskFactors);
  }

  if (request.urgency_level === 'emergency') {
    warnings.push('Emergency service may incur additional charges');
  }

  if (request.attachments && request.attachments.length > 0) {
    warnings.push('Estimate based on provided photos; actual conditions may vary');
  }

  return warnings;
}

/**
 * Create an estimate record in the database
 */
async function createEstimateRecord(pool, siteId, requestId, estimateData) {
  const {
    jobType,
    industryId,
    priceLow,
    priceHigh,
    recommendedPrice,
    timelineDaysMin,
    timelineDaysMax,
    scopeOfWork,
    inclusions,
    exclusions,
    riskWarnings,
    confidence,
    historicalJobsCount,
    protocolId,
    validDays,
    notes,
  } = estimateData;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (validDays || 30));

  const result = await pool.query(
    `INSERT INTO estimates (
      site_id, request_id, job_type, industry_id,
      price_low, price_high, recommended_price,
      timeline_days_min, timeline_days_max,
      scope_of_work, inclusions, exclusions, risk_warnings,
      confidence_level, confidence_reasoning,
      historical_jobs_count, protocol_id,
      valid_until, notes, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'draft')
    RETURNING *`,
    [
      siteId,
      requestId,
      jobType,
      industryId,
      priceLow,
      priceHigh,
      recommendedPrice,
      timelineDaysMin,
      timelineDaysMax,
      scopeOfWork,
      JSON.stringify(inclusions || []),
      JSON.stringify(exclusions || []),
      JSON.stringify(riskWarnings || []),
      confidence?.level || 'medium',
      confidence?.reasoning || null,
      historicalJobsCount || 0,
      protocolId || null,
      validUntil,
      notes || null,
    ]
  );

  // Update service request status
  await pool.query(
    `UPDATE service_requests SET status = 'estimated', updated_at = NOW()
     WHERE id = $1 AND site_id = $2`,
    [requestId, siteId]
  );

  return result.rows[0];
}

/**
 * Generate and save an estimate for a service request
 */
async function generateAndSaveEstimate(pool, siteId, requestId, options = {}) {
  const result = await generateFullEstimate(pool, siteId, requestId, options);

  if (!result.ok) {
    return result;
  }

  const { estimate, request, protocol } = result;

  const savedEstimate = await createEstimateRecord(pool, siteId, requestId, {
    jobType: request.classified_job_type,
    industryId: request.industry_id,
    priceLow: estimate.priceLow,
    priceHigh: estimate.priceHigh,
    recommendedPrice: estimate.recommendedPrice,
    timelineDaysMin: estimate.timelineDaysMin,
    timelineDaysMax: estimate.timelineDaysMax,
    scopeOfWork: estimate.scopeOfWork,
    inclusions: estimate.inclusions,
    exclusions: estimate.exclusions,
    riskWarnings: estimate.riskWarnings,
    confidence: estimate.confidence,
    historicalJobsCount: estimate.historicalJobsCount,
    protocolId: protocol?.id,
    validDays: options.validDays || 30,
    notes: options.notes,
  });

  return {
    ok: true,
    estimate: savedEstimate,
    request,
    protocol,
  };
}

/**
 * Get an estimate by ID
 */
async function getEstimate(pool, estimateId, siteId) {
  const result = await pool.query(
    `SELECT e.*, sr.customer_name, sr.phone, sr.email, sr.address,
            sr.problem_description, i.name as industry_name
     FROM estimates e
     JOIN service_requests sr ON e.request_id = sr.id
     LEFT JOIN industries i ON e.industry_id = i.id
     WHERE e.id = $1 AND e.site_id = $2`,
    [estimateId, siteId]
  );
  return result.rows[0];
}

/**
 * List estimates for a site
 */
async function listEstimates(pool, siteId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  let query = `
    SELECT e.*, sr.customer_name, sr.phone, sr.email,
           sr.problem_description, i.name as industry_name
    FROM estimates e
    JOIN service_requests sr ON e.request_id = sr.id
    LEFT JOIN industries i ON e.industry_id = i.id
    WHERE e.site_id = $1
  `;
  const params = [siteId];

  if (status) {
    query += ` AND e.status = $${params.length + 1}`;
    params.push(status);
  }

  query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Update estimate status
 */
async function updateEstimateStatus(pool, estimateId, siteId, status, userId, reason) {
  const updates = { status };

  if (status === 'approved') {
    updates.approved_by = userId;
    updates.approved_at = new Date();
  } else if (status === 'rejected') {
    updates.rejection_reason = reason;
  } else if (status === 'sent') {
    updates.sent_at = new Date();
  } else if (status === 'viewed') {
    updates.viewed_at = new Date();
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const values = [estimateId, siteId, ...Object.values(updates)];

  const result = await pool.query(
    `UPDATE estimates SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND site_id = $2
     RETURNING *`,
    values
  );

  // Update service request status if estimate approved
  if (status === 'approved') {
    await pool.query(
      `UPDATE service_requests SET status = 'approved', updated_at = NOW()
       WHERE id = (SELECT request_id FROM estimates WHERE id = $1)`,
      [estimateId]
    );
  }

  return result.rows[0];
}

module.exports = {
  generateFullEstimate,
  createEstimateRecord,
  generateAndSaveEstimate,
  getEstimate,
  listEstimates,
  updateEstimateStatus,
};
