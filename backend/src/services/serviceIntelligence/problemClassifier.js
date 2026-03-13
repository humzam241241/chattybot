/**
 * Problem Classifier
 * Analyzes service requests and classifies them to appropriate job types.
 * Industry-agnostic with plugin support.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Get all active industries
 */
async function getIndustries(pool) {
  const result = await pool.query(
    `SELECT id, slug, name, description FROM industries WHERE is_active = true ORDER BY name`
  );
  return result.rows;
}

/**
 * Get service protocols for an industry
 */
async function getProtocolsForIndustry(pool, industryId) {
  const result = await pool.query(
    `SELECT id, job_type, description, diagnosis_signals, urgency_keywords
     FROM service_protocols
     WHERE industry_id = $1 AND is_active = true
     ORDER BY job_type`,
    [industryId]
  );
  return result.rows;
}

/**
 * Get all active protocols across industries
 */
async function getAllProtocols(pool) {
  const result = await pool.query(
    `SELECT sp.id, sp.job_type, sp.description, sp.diagnosis_signals, sp.urgency_keywords,
            i.id as industry_id, i.slug as industry_slug, i.name as industry_name
     FROM service_protocols sp
     JOIN industries i ON sp.industry_id = i.id
     WHERE sp.is_active = true AND i.is_active = true
     ORDER BY i.name, sp.job_type`
  );
  return result.rows;
}

/**
 * Build classification prompt with available protocols
 */
function buildClassificationPrompt(protocols) {
  const protocolList = protocols.map(p => ({
    industry: p.industry_name,
    industry_slug: p.industry_slug,
    job_type: p.job_type,
    description: p.description,
    signals: p.diagnosis_signals,
  }));

  return `You are a service request classifier. Analyze the customer's problem and classify it.

Available service types:
${JSON.stringify(protocolList, null, 2)}

Return a JSON object:
{
  "industry_slug": "the industry slug or null if unclear",
  "job_type": "the specific job_type or null if unclear",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification",
  "needs_more_info": boolean,
  "suggested_questions": ["questions to ask if needs_more_info is true"],
  "detected_urgency": "low" | "normal" | "high" | "emergency",
  "key_indicators": ["keywords/phrases that led to this classification"]
}

Guidelines:
- confidence >= 0.8: Clear match to a specific job type
- confidence 0.5-0.8: Likely match but could use confirmation
- confidence < 0.5: Unclear, set needs_more_info to true
- If the problem doesn't match any available service type, set job_type to null`;
}

/**
 * Classify a service request
 * @param {Pool} pool - Database pool
 * @param {Object} options - Classification options
 * @param {string} options.siteId - Site ID for tenant isolation
 * @param {string} options.problemDescription - The problem to classify
 * @param {string} [options.industryId] - Optional industry ID to narrow classification
 * @param {Object} [options.previousContext] - Previous conversation context
 */
async function classifyRequest(pool, options = {}) {
  const { siteId, problemDescription, industryId, previousContext = {} } = options;
  const startTime = Date.now();

  if (!problemDescription) {
    return {
      ok: false,
      error: 'Problem description is required',
      needsMoreInfo: true,
    };
  }

  let protocols;
  if (industryId) {
    protocols = await getProtocolsForIndustry(pool, industryId);
    const industry = await pool.query('SELECT slug, name FROM industries WHERE id = $1', [industryId]);
    protocols = protocols.map(p => ({
      ...p,
      industry_slug: industry.rows[0]?.slug,
      industry_name: industry.rows[0]?.name,
    }));
  } else {
    protocols = await getAllProtocols(pool);
  }

  if (protocols.length === 0) {
    return {
      ok: false,
      error: 'No service protocols configured',
      needsMoreInfo: true,
      suggestedQuestions: ['What type of service do you need help with?'],
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildClassificationPrompt(protocols) },
        {
          role: 'user',
          content: `Problem description: "${problemDescription}"\n\nAdditional context: ${JSON.stringify(previousContext)}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const processingTime = Date.now() - startTime;

    // Look up industry ID if we got a slug
    let resolvedIndustryId = industryId;
    if (result.industry_slug && !industryId) {
      const industryResult = await pool.query(
        'SELECT id, name FROM industries WHERE slug = $1',
        [result.industry_slug]
      );
      resolvedIndustryId = industryResult.rows[0]?.id || null;
      result.industry_name = industryResult.rows[0]?.name || null;
    }

    // Look up protocol ID if we have a match
    let protocolId = null;
    if (result.job_type && resolvedIndustryId) {
      const protocolResult = await pool.query(
        'SELECT id FROM service_protocols WHERE industry_id = $1 AND job_type = $2',
        [resolvedIndustryId, result.job_type]
      );
      protocolId = protocolResult.rows[0]?.id || null;
    }

    return {
      ok: true,
      jobType: result.job_type,
      industry: result.industry_slug,
      industryId: resolvedIndustryId,
      industryName: result.industry_name,
      protocolId,
      confidence: result.confidence,
      reasoning: result.reasoning,
      needsMoreInfo: result.needs_more_info || false,
      suggestedQuestions: result.suggested_questions || [],
      detectedUrgency: result.detected_urgency || 'normal',
      keyIndicators: result.key_indicators || [],
      processingTimeMs: processingTime,
    };
  } catch (err) {
    console.error('[problemClassifier] Classification error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use classifyRequest with options object instead
 */
async function classifyRequestLegacy(pool, problemDescription, options = {}) {
  const { industryId, existingContext = {} } = options;
  return classifyRequest(pool, {
    problemDescription,
    industryId,
    previousContext: existingContext,
  });
}

/**
 * Update a service request with classification results
 */
async function applyClassification(pool, requestId, siteId, classification) {
  const result = await pool.query(
    `UPDATE service_requests
     SET industry_id = COALESCE($3, industry_id),
         classified_job_type = $4,
         classification_confidence = $5,
         classification_reasoning = $6,
         status = CASE
           WHEN $5 >= 0.5 THEN 'classified'
           ELSE 'needs_assessment'
         END,
         updated_at = NOW()
     WHERE id = $1 AND site_id = $2
     RETURNING *`,
    [
      requestId,
      siteId,
      classification.industry_id,
      classification.job_type,
      classification.confidence,
      classification.reasoning,
    ]
  );

  return result.rows[0];
}

/**
 * Classify and update a service request in one step
 */
async function classifyServiceRequest(pool, requestId, siteId) {
  const requestResult = await pool.query(
    'SELECT * FROM service_requests WHERE id = $1 AND site_id = $2',
    [requestId, siteId]
  );

  const request = requestResult.rows[0];
  if (!request) {
    return { ok: false, error: 'Service request not found' };
  }

  const classificationResult = await classifyRequest(pool, {
    siteId,
    problemDescription: request.problem_description,
    industryId: request.industry_id,
    previousContext: {
      urgency: request.urgency_level,
      attachments: request.attachments,
    },
  });

  if (!classificationResult.ok) {
    return classificationResult;
  }

  // Convert to legacy format for applyClassification
  const legacyClassification = {
    industry_id: classificationResult.industryId,
    job_type: classificationResult.jobType,
    confidence: classificationResult.confidence,
    reasoning: classificationResult.reasoning,
  };

  const updatedRequest = await applyClassification(
    pool,
    requestId,
    siteId,
    legacyClassification
  );

  return {
    ok: true,
    request: updatedRequest,
    classification: classificationResult,
  };
}

module.exports = {
  getIndustries,
  getProtocolsForIndustry,
  getAllProtocols,
  classifyRequest,
  classifyRequestLegacy,
  applyClassification,
  classifyServiceRequest,
};
