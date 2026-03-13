/**
 * Intent Engine
 * Detects what the user wants from their message.
 * Layer 1 of the Universal Service Intelligence Engine.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Supported intents
 */
const INTENTS = {
  SERVICE_REQUEST: 'service_request',
  ESTIMATE_REQUEST: 'estimate_request',
  INSPECTION_BOOKING: 'inspection_booking',
  SCHEDULE_CHANGE: 'schedule_change',
  INFORMATION_QUESTION: 'information_question',
  INSURANCE_QUESTION: 'insurance_question',
  WARRANTY_ISSUE: 'warranty_issue',
  DIY_HELP: 'diy_help',
  COMPLAINT: 'complaint',
  GENERAL_CONVERSATION: 'general_conversation',
  GREETING: 'greeting',
  THANK_YOU: 'thank_you',
  GOODBYE: 'goodbye',
  UNKNOWN: 'unknown',
};

const INTENT_DETECTION_PROMPT = `You are an intent detection system for a service business AI assistant.

Analyze the customer's message and determine their primary intent.

Available intents:
- service_request: Customer has a problem and needs service (repair, fix, installation)
- estimate_request: Customer specifically asking for a quote or price
- inspection_booking: Customer wants to schedule an inspection or appointment
- schedule_change: Customer wants to reschedule or cancel an existing appointment
- information_question: Customer asking general questions about services, hours, areas served
- insurance_question: Customer asking about insurance claims, coverage, documentation
- warranty_issue: Customer has a warranty-related concern
- diy_help: Customer asking for DIY advice or if they can fix it themselves
- complaint: Customer expressing dissatisfaction or filing a complaint
- general_conversation: Casual conversation, small talk
- greeting: Customer saying hello, hi, good morning, etc.
- thank_you: Customer expressing gratitude
- goodbye: Customer ending the conversation
- unknown: Cannot determine intent with confidence

Return a JSON object:
{
  "intent": "the primary intent",
  "confidence": 0.0-1.0,
  "sub_intents": ["any secondary intents detected"],
  "reasoning": "brief explanation",
  "urgency_detected": "low" | "normal" | "high" | "emergency",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated"
}

Guidelines:
- confidence >= 0.8: Clear intent
- confidence 0.6-0.8: Likely intent but could use confirmation
- confidence < 0.6: Set intent to "unknown"
- Detect urgency from words like "emergency", "urgent", "asap", "flooding", "no heat"
- Detect sentiment from tone and word choice`;

/**
 * Detect intent from a message
 */
async function detectIntent(message, context = {}) {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INTENT_DETECTION_PROMPT },
        {
          role: 'user',
          content: `Customer message: "${message}"\n\nConversation context: ${JSON.stringify(context)}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const processingTime = Date.now() - startTime;

    // Normalize confidence below threshold to unknown
    if (result.confidence < 0.6) {
      result.intent = INTENTS.UNKNOWN;
    }

    return {
      ok: true,
      intent: result.intent,
      confidence: result.confidence,
      subIntents: result.sub_intents || [],
      reasoning: result.reasoning,
      urgencyDetected: result.urgency_detected || 'normal',
      sentiment: result.sentiment || 'neutral',
      processingTimeMs: processingTime,
    };
  } catch (err) {
    console.error('[intentEngine] Detection error:', err.message);
    return {
      ok: false,
      error: err.message,
      intent: INTENTS.UNKNOWN,
      confidence: 0,
    };
  }
}

/**
 * Store intent detection result in database
 */
async function storeIntentResult(pool, siteId, data) {
  const {
    requestId,
    conversationId,
    messageId,
    intent,
    confidence,
    subIntents,
    inputText,
    modelUsed,
    processingTimeMs,
  } = data;

  const result = await pool.query(
    `INSERT INTO ai_intents (
      site_id, request_id, conversation_id, message_id,
      intent, confidence, sub_intents, input_text,
      model_used, processing_time_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      siteId,
      requestId || null,
      conversationId || null,
      messageId || null,
      intent,
      confidence,
      JSON.stringify(subIntents || []),
      inputText || null,
      modelUsed || 'gpt-4o-mini',
      processingTimeMs || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get recent intents for a conversation
 */
async function getConversationIntents(pool, conversationId, limit = 10) {
  const result = await pool.query(
    `SELECT * FROM ai_intents
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows;
}

/**
 * Detect and store intent in one step
 */
async function processIntent(pool, siteId, message, options = {}) {
  const { conversationId, requestId, messageId, context } = options;

  const detection = await detectIntent(message, context);

  if (detection.ok) {
    const stored = await storeIntentResult(pool, siteId, {
      requestId,
      conversationId,
      messageId,
      intent: detection.intent,
      confidence: detection.confidence,
      subIntents: detection.subIntents,
      inputText: message,
      processingTimeMs: detection.processingTimeMs,
    });

    return {
      ok: true,
      ...detection,
      stored,
    };
  }

  return detection;
}

/**
 * Check if intent requires service flow
 */
function isServiceIntent(intent) {
  return [
    INTENTS.SERVICE_REQUEST,
    INTENTS.ESTIMATE_REQUEST,
    INTENTS.INSPECTION_BOOKING,
  ].includes(intent);
}

/**
 * Check if intent is conversational
 */
function isConversationalIntent(intent) {
  return [
    INTENTS.GREETING,
    INTENTS.THANK_YOU,
    INTENTS.GOODBYE,
    INTENTS.GENERAL_CONVERSATION,
  ].includes(intent);
}

/**
 * Get clarifying question for unknown intent
 */
function getClarifyingQuestion() {
  const questions = [
    "I want to make sure I understand correctly. Are you looking for help with a repair or service, or do you have a question I can answer?",
    "Could you tell me a bit more about what you need? I'm here to help with repairs, estimates, or answer any questions.",
    "I'd love to help! Are you experiencing an issue that needs repair, or would you like information about our services?",
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

module.exports = {
  INTENTS,
  detectIntent,
  storeIntentResult,
  getConversationIntents,
  processIntent,
  isServiceIntent,
  isConversationalIntent,
  getClarifyingQuestion,
};
