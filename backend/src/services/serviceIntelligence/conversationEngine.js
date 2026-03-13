/**
 * Conversation Engine
 * Generates contextual, conversational responses based on intent, classification, and estimates.
 * Layer 5 of the Universal Service Intelligence Engine.
 */

const OpenAI = require('openai');
const { INTENTS } = require('./intentEngine');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Conversation stages
 */
const STAGES = {
  GREETING: 'greeting',
  PROBLEM_DISCOVERY: 'problem_discovery',
  DIAGNOSTIC_QUESTIONS: 'diagnostic_questions',
  CLASSIFICATION_CONFIRMED: 'classification_confirmed',
  ESTIMATE_PRESENTED: 'estimate_presented',
  OBJECTION_HANDLING: 'objection_handling',
  BOOKING: 'booking',
  FOLLOW_UP: 'follow_up',
  CLOSED: 'closed',
};

/**
 * Conversation strategies
 */
const STRATEGIES = {
  DIAGNOSTIC_QUESTIONING: 'diagnostic_questioning',
  ANTICIPATORY_SELLING: 'anticipatory_selling',
  EDUCATIONAL_GUIDANCE: 'educational_guidance',
  TRUST_BUILDING: 'trust_building',
  OBJECTION_HANDLING: 'objection_handling',
  URGENCY_RESPONSE: 'urgency_response',
};

/**
 * Build system prompt for conversation generation
 */
function buildConversationPrompt(context) {
  const { siteName, industry, stage, strategy } = context;

  return `You are a helpful AI assistant for ${siteName || 'a service business'}${industry ? ` specializing in ${industry}` : ''}.

Your role is to:
- Help customers with service requests professionally
- Ask diagnostic questions to understand their problem
- Provide preliminary estimates when appropriate
- Guide customers toward booking inspections or service
- Build trust through transparency and expertise

Tone requirements:
- Professional but friendly
- Consultative, not salesy
- Transparent about pricing and process
- Educational when explaining technical concepts
- Non-pushy, let the customer lead

Current conversation stage: ${stage || 'greeting'}
${strategy ? `Current strategy: ${strategy}` : ''}

Guidelines:
- Keep responses concise (2-4 sentences typically)
- Ask one question at a time
- Always acknowledge the customer's concern first
- If providing an estimate, always include the disclaimer about final pricing
- Never make promises about exact timing or pricing without inspection
- If unsure, offer to have a human follow up`;
}

/**
 * Generate a conversational response
 */
async function generateResponse(context) {
  const {
    message,
    intent,
    classification,
    estimate,
    conversationHistory,
    siteConfig,
    stage,
    collectedInfo,
    missingInfo,
  } = context;

  const systemPrompt = buildConversationPrompt({
    siteName: siteConfig?.name,
    industry: classification?.industry_name,
    stage,
    strategy: determineStrategy(intent, stage, classification),
  });

  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-10)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
  }

  // Build context for the current response
  let contextInfo = `Current customer message: "${message}"\n`;

  if (intent) {
    contextInfo += `Detected intent: ${intent.intent} (confidence: ${intent.confidence})\n`;
  }

  if (classification) {
    contextInfo += `Problem classification: ${classification.job_type || 'pending'} (${classification.industry_name || 'unknown industry'})\n`;
    if (classification.needs_more_info) {
      contextInfo += `Suggested questions to ask: ${JSON.stringify(classification.suggested_questions)}\n`;
    }
  }

  if (estimate) {
    contextInfo += `Preliminary estimate: $${estimate.price_low} - $${estimate.price_high}\n`;
    contextInfo += `Timeline: ${estimate.timeline_days_min}-${estimate.timeline_days_max} days\n`;
    contextInfo += `Confidence: ${estimate.confidence_level}\n`;
  }

  if (collectedInfo && Object.keys(collectedInfo).length > 0) {
    contextInfo += `Information collected: ${JSON.stringify(collectedInfo)}\n`;
  }

  if (missingInfo && missingInfo.length > 0) {
    contextInfo += `Information still needed: ${missingInfo.join(', ')}\n`;
  }

  messages.push({
    role: 'user',
    content: contextInfo + '\n\nGenerate an appropriate response for this customer.',
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    return {
      ok: true,
      response: response.choices[0].message.content,
      stage: determineNextStage(stage, intent, classification, estimate),
    };
  } catch (err) {
    console.error('[conversationEngine] Generation error:', err.message);
    return {
      ok: false,
      error: err.message,
      response: getFallbackResponse(stage),
    };
  }
}

/**
 * Determine the appropriate conversation strategy
 */
function determineStrategy(intent, stage, classification) {
  if (!intent) return STRATEGIES.DIAGNOSTIC_QUESTIONING;

  if (intent.urgencyDetected === 'emergency') {
    return STRATEGIES.URGENCY_RESPONSE;
  }

  if (intent.intent === INTENTS.INFORMATION_QUESTION) {
    return STRATEGIES.EDUCATIONAL_GUIDANCE;
  }

  if (stage === STAGES.OBJECTION_HANDLING) {
    return STRATEGIES.OBJECTION_HANDLING;
  }

  if (classification && classification.confidence >= 0.8) {
    return STRATEGIES.ANTICIPATORY_SELLING;
  }

  if (stage === STAGES.PROBLEM_DISCOVERY || stage === STAGES.DIAGNOSTIC_QUESTIONS) {
    return STRATEGIES.DIAGNOSTIC_QUESTIONING;
  }

  return STRATEGIES.TRUST_BUILDING;
}

/**
 * Determine the next conversation stage
 */
function determineNextStage(currentStage, intent, classification, estimate) {
  if (!currentStage || currentStage === STAGES.GREETING) {
    if (intent?.intent === INTENTS.SERVICE_REQUEST || intent?.intent === INTENTS.ESTIMATE_REQUEST) {
      return STAGES.PROBLEM_DISCOVERY;
    }
    return STAGES.GREETING;
  }

  if (currentStage === STAGES.PROBLEM_DISCOVERY) {
    if (classification && classification.confidence >= 0.7) {
      return STAGES.CLASSIFICATION_CONFIRMED;
    }
    return STAGES.DIAGNOSTIC_QUESTIONS;
  }

  if (currentStage === STAGES.DIAGNOSTIC_QUESTIONS) {
    if (classification && classification.confidence >= 0.7) {
      return STAGES.CLASSIFICATION_CONFIRMED;
    }
    return STAGES.DIAGNOSTIC_QUESTIONS;
  }

  if (currentStage === STAGES.CLASSIFICATION_CONFIRMED) {
    if (estimate) {
      return STAGES.ESTIMATE_PRESENTED;
    }
    return STAGES.CLASSIFICATION_CONFIRMED;
  }

  if (currentStage === STAGES.ESTIMATE_PRESENTED) {
    if (intent?.intent === INTENTS.INSPECTION_BOOKING) {
      return STAGES.BOOKING;
    }
    return STAGES.ESTIMATE_PRESENTED;
  }

  return currentStage;
}

/**
 * Get fallback response for errors
 */
function getFallbackResponse(stage) {
  const fallbacks = {
    [STAGES.GREETING]: "Hi! I'm here to help. What can I assist you with today?",
    [STAGES.PROBLEM_DISCOVERY]: "I'd like to understand your situation better. Can you tell me more about what's going on?",
    [STAGES.DIAGNOSTIC_QUESTIONS]: "Let me ask a few more questions to better understand your needs.",
    [STAGES.CLASSIFICATION_CONFIRMED]: "Based on what you've told me, I have a good understanding of your situation. Would you like me to provide a preliminary estimate?",
    [STAGES.ESTIMATE_PRESENTED]: "I've provided a preliminary estimate. Would you like to schedule an inspection to get a final quote?",
    [STAGES.BOOKING]: "I'd be happy to help you schedule. What day works best for you?",
    default: "I'm here to help! How can I assist you today?",
  };

  return fallbacks[stage] || fallbacks.default;
}

/**
 * Generate greeting response
 */
function generateGreeting(siteConfig) {
  const name = siteConfig?.name || 'our team';
  const greetings = [
    `Hi! Welcome to ${name}. I'm here to help with any questions or service needs. What can I do for you today?`,
    `Hello! Thanks for reaching out to ${name}. How can I assist you?`,
    `Hi there! I'm the virtual assistant for ${name}. Whether you need a repair, an estimate, or just have questions, I'm here to help.`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * Generate estimate presentation response
 */
function generateEstimateResponse(estimate, classification) {
  const priceRange = estimate.price_low === estimate.price_high
    ? `$${estimate.price_low}`
    : `$${estimate.price_low} - $${estimate.price_high}`;

  const timeline = estimate.timeline_days_min === estimate.timeline_days_max
    ? `${estimate.timeline_days_min} day${estimate.timeline_days_min > 1 ? 's' : ''}`
    : `${estimate.timeline_days_min}-${estimate.timeline_days_max} days`;

  let response = `Based on what you've described, here's a preliminary estimate for ${classification?.job_type?.replace(/_/g, ' ') || 'this work'}:\n\n`;
  response += `**Estimated Cost:** ${priceRange}\n`;
  response += `**Estimated Timeline:** ${timeline}\n\n`;

  if (estimate.scope_of_work) {
    response += `**What's included:** ${estimate.scope_of_work}\n\n`;
  }

  if (estimate.risk_warnings && estimate.risk_warnings.length > 0) {
    response += `**Please note:** ${estimate.risk_warnings[0]}\n\n`;
  }

  response += `*This is a preliminary estimate. Final pricing will be confirmed after an on-site inspection.*\n\n`;
  response += `Would you like to schedule a free inspection to get an exact quote?`;

  return response;
}

/**
 * Generate diagnostic question based on missing info
 */
function generateDiagnosticQuestion(missingInfo, classification) {
  if (classification?.suggested_questions && classification.suggested_questions.length > 0) {
    return classification.suggested_questions[0];
  }

  const genericQuestions = {
    location: "Where is the issue located in your home or property?",
    duration: "How long have you been experiencing this issue?",
    severity: "On a scale of 1-10, how urgent would you say this is?",
    previous_repair: "Has this been repaired before, or is this a new issue?",
    symptoms: "Can you describe any other symptoms or issues you've noticed?",
  };

  if (missingInfo && missingInfo.length > 0) {
    const missing = missingInfo[0];
    return genericQuestions[missing] || `Could you tell me more about ${missing}?`;
  }

  return "Can you tell me a bit more about what's happening?";
}

/**
 * Get or create conversation context
 */
async function getConversationContext(pool, siteId, conversationId) {
  const result = await pool.query(
    `SELECT * FROM ai_conversation_context
     WHERE conversation_id = $1`,
    [conversationId]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  // Create new context
  const insertResult = await pool.query(
    `INSERT INTO ai_conversation_context (site_id, conversation_id)
     VALUES ($1, $2)
     RETURNING *`,
    [siteId, conversationId]
  );

  return insertResult.rows[0];
}

/**
 * Update conversation context
 */
async function updateConversationContext(pool, conversationId, updates) {
  const allowedFields = [
    'current_intent', 'current_job_type', 'current_industry_id',
    'collected_info', 'missing_info', 'conversation_stage',
    'estimate_id', 'estimate_presented', 'customer_response'
  ];

  const setClauses = [];
  const values = [conversationId];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      setClauses.push(`${snakeKey} = $${paramIndex}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return null;

  const result = await pool.query(
    `UPDATE ai_conversation_context
     SET ${setClauses.join(', ')}
     WHERE conversation_id = $1
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Store classification result
 */
async function storeClassificationResult(pool, siteId, data) {
  const {
    requestId,
    conversationId,
    jobType,
    industryId,
    industrySlug,
    confidence,
    reasoning,
    keyIndicators,
    detectedUrgency,
    needsMoreInfo,
    suggestedQuestions,
    inputText,
    processingTimeMs,
  } = data;

  const result = await pool.query(
    `INSERT INTO ai_classifications (
      site_id, request_id, conversation_id,
      job_type, industry_id, industry_slug, confidence,
      reasoning, key_indicators, detected_urgency,
      needs_more_info, suggested_questions,
      input_text, processing_time_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      siteId,
      requestId || null,
      conversationId || null,
      jobType || null,
      industryId || null,
      industrySlug || null,
      confidence,
      reasoning || null,
      JSON.stringify(keyIndicators || []),
      detectedUrgency || 'normal',
      needsMoreInfo || false,
      JSON.stringify(suggestedQuestions || []),
      inputText || null,
      processingTimeMs || null,
    ]
  );

  return result.rows[0];
}

module.exports = {
  STAGES,
  STRATEGIES,
  generateResponse,
  determineStrategy,
  determineNextStage,
  generateGreeting,
  generateEstimateResponse,
  generateDiagnosticQuestion,
  getConversationContext,
  updateConversationContext,
  storeClassificationResult,
  getFallbackResponse,
};
