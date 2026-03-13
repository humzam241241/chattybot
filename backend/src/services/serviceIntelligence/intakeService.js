/**
 * Intake Service
 * Parses customer messages and extracts structured service request data.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_PROMPT = `You are a service request intake specialist. Extract structured information from the customer's message.

Return a JSON object with these fields (use null for missing info):
{
  "problem_description": "Clear description of the issue",
  "urgency_level": "low" | "normal" | "high" | "emergency",
  "location_details": "Any location/address info mentioned",
  "preferred_contact": "phone" | "email" | "text" | null,
  "preferred_schedule": "Any scheduling preferences mentioned",
  "additional_context": "Any other relevant details",
  "has_attachments_mentioned": boolean,
  "keywords": ["relevant", "keywords", "for", "classification"]
}

Urgency guidelines:
- emergency: active flooding, gas leak, no heat in winter, no AC in extreme heat, safety hazard
- high: significant inconvenience, worsening problem, time-sensitive
- normal: standard service request, no immediate urgency
- low: routine maintenance, future planning`;

/**
 * Extract structured data from a customer message
 */
async function extractRequestData(message, existingContext = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `Customer message: "${message}"\n\nExisting context: ${JSON.stringify(existingContext)}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const extracted = JSON.parse(response.choices[0].message.content);
    return { ok: true, data: extracted };
  } catch (err) {
    console.error('[intakeService] Extraction error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Create a new service request from intake data
 */
async function createServiceRequest(pool, siteId, data) {
  const {
    conversationId,
    leadId,
    customerName,
    phone,
    email,
    address,
    city,
    state,
    zipCode,
    industryId,
    problemDescription,
    attachments,
    urgencyLevel,
    preferredContactMethod,
    preferredSchedule,
    source,
  } = data;

  const result = await pool.query(
    `INSERT INTO service_requests (
      site_id, conversation_id, lead_id,
      customer_name, phone, email, address, city, state, zip_code,
      industry_id, problem_description, attachments, urgency_level,
      preferred_contact_method, preferred_schedule, source, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'new')
    RETURNING *`,
    [
      siteId,
      conversationId || null,
      leadId || null,
      customerName || null,
      phone || null,
      email || null,
      address || null,
      city || null,
      state || null,
      zipCode || null,
      industryId || null,
      problemDescription,
      JSON.stringify(attachments || []),
      urgencyLevel || 'normal',
      preferredContactMethod || 'phone',
      preferredSchedule || null,
      source || 'chat',
    ]
  );

  return result.rows[0];
}

/**
 * Update an existing service request
 */
async function updateServiceRequest(pool, requestId, siteId, updates) {
  const allowedFields = [
    'customer_name', 'phone', 'email', 'address', 'city', 'state', 'zip_code',
    'industry_id', 'problem_description', 'attachments', 'urgency_level',
    'preferred_contact_method', 'preferred_schedule', 'classified_job_type',
    'classification_confidence', 'classification_reasoning', 'status', 'assigned_to'
  ];

  const setClauses = [];
  const values = [requestId, siteId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      setClauses.push(`${snakeKey} = $${paramIndex}`);
      values.push(key === 'attachments' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return null;
  }

  const result = await pool.query(
    `UPDATE service_requests
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND site_id = $2
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Get a service request by ID
 */
async function getServiceRequest(pool, requestId, siteId) {
  const result = await pool.query(
    `SELECT sr.*, i.slug as industry_slug, i.name as industry_name
     FROM service_requests sr
     LEFT JOIN industries i ON sr.industry_id = i.id
     WHERE sr.id = $1 AND sr.site_id = $2`,
    [requestId, siteId]
  );
  return result.rows[0];
}

/**
 * List service requests for a site
 */
async function listServiceRequests(pool, siteId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  let query = `
    SELECT sr.*, i.slug as industry_slug, i.name as industry_name
    FROM service_requests sr
    LEFT JOIN industries i ON sr.industry_id = i.id
    WHERE sr.site_id = $1
  `;
  const params = [siteId];

  if (status) {
    query += ` AND sr.status = $${params.length + 1}`;
    params.push(status);
  }

  query += ` ORDER BY sr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Process intake from a chat conversation
 */
async function processIntakeFromChat(pool, siteId, conversationId, messages, leadData = {}) {
  const combinedMessage = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  const extraction = await extractRequestData(combinedMessage, leadData);
  if (!extraction.ok) {
    return { ok: false, error: extraction.error };
  }

  const request = await createServiceRequest(pool, siteId, {
    conversationId,
    leadId: leadData.id || null,
    customerName: leadData.name || null,
    phone: leadData.phone || null,
    email: leadData.email || null,
    problemDescription: extraction.data.problem_description || combinedMessage,
    urgencyLevel: extraction.data.urgency_level || 'normal',
    preferredContactMethod: extraction.data.preferred_contact || 'phone',
    preferredSchedule: extraction.data.preferred_schedule || null,
    source: 'chat',
  });

  return { ok: true, request, extraction: extraction.data };
}

module.exports = {
  extractRequestData,
  createServiceRequest,
  updateServiceRequest,
  getServiceRequest,
  listServiceRequests,
  processIntakeFromChat,
};
