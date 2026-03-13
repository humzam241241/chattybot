/**
 * Service Intelligence Orchestrator
 * Unified handler that coordinates all five AI layers.
 * 
 * Flow:
 * 1. Intent Engine - detect what user wants
 * 2. Problem Classifier - identify the issue
 * 3. Protocol Engine - determine how to fix it
 * 4. Estimator Engine - calculate cost
 * 5. Conversation Engine - generate response
 */

const intentEngine = require('./intentEngine');
const problemClassifier = require('./problemClassifier');
const protocolEngine = require('./protocolEngine');
const priceEstimator = require('./priceEstimator');
const estimateGenerator = require('./estimateGenerator');
const conversationEngine = require('./conversationEngine');

const { INTENTS } = intentEngine;
const { STAGES } = conversationEngine;

/**
 * Process a customer message through all AI layers
 */
async function processMessage(pool, siteId, message, options = {}) {
  const {
    conversationId,
    requestId,
    messageId,
    conversationHistory = [],
    siteConfig = {},
  } = options;

  const result = {
    intent: null,
    classification: null,
    protocol: null,
    estimate: null,
    response: null,
    stage: null,
    actions: [],
  };

  try {
    // Get or create conversation context
    let context = null;
    if (conversationId) {
      context = await conversationEngine.getConversationContext(pool, siteId, conversationId);
    }

    // Layer 1: Intent Detection
    const intentResult = await intentEngine.processIntent(pool, siteId, message, {
      conversationId,
      requestId,
      messageId,
      context: {
        stage: context?.conversation_stage,
        previousIntents: context?.current_intent,
      },
    });

    result.intent = intentResult;

    // Handle conversational intents quickly
    if (intentEngine.isConversationalIntent(intentResult.intent)) {
      result.response = await handleConversationalIntent(intentResult, siteConfig);
      result.stage = context?.conversation_stage || STAGES.GREETING;
      return result;
    }

    // Layer 2: Problem Classification (for service intents)
    if (intentEngine.isServiceIntent(intentResult.intent) || 
        context?.conversation_stage === STAGES.DIAGNOSTIC_QUESTIONS ||
        context?.conversation_stage === STAGES.PROBLEM_DISCOVERY) {
      
      const classificationResult = await problemClassifier.classifyRequest(pool, {
        siteId,
        problemDescription: message,
        previousContext: context?.collected_info,
      });

      if (classificationResult.ok) {
        // Store classification
        await conversationEngine.storeClassificationResult(pool, siteId, {
          conversationId,
          requestId,
          jobType: classificationResult.jobType,
          industryId: classificationResult.industryId,
          industrySlug: classificationResult.industry,
          confidence: classificationResult.confidence,
          reasoning: classificationResult.reasoning,
          keyIndicators: classificationResult.keyIndicators,
          detectedUrgency: intentResult.urgencyDetected,
          needsMoreInfo: classificationResult.needsMoreInfo,
          suggestedQuestions: classificationResult.suggestedQuestions,
          inputText: message,
          processingTimeMs: classificationResult.processingTimeMs,
        });

        result.classification = classificationResult;

        // Layer 3: Protocol Lookup (if classification is confident)
        if (classificationResult.confidence >= 0.7 && classificationResult.jobType) {
          const protocol = await protocolEngine.getProtocolByJobType(
            pool,
            classificationResult.industry,
            classificationResult.jobType
          );

          if (protocol) {
            result.protocol = protocol;

            // Layer 4: Price Estimation (if we have enough info)
            if (shouldGenerateEstimate(context, classificationResult, intentResult)) {
              const estimateResult = await priceEstimator.generateEstimate(pool, {
                siteId,
                industry: classificationResult.industry,
                jobType: classificationResult.jobType,
                projectSize: classificationResult.projectSize || 'medium',
                complexityScore: classificationResult.complexityScore || 5,
              });

              if (estimateResult.ok) {
                result.estimate = estimateResult;
                result.actions.push({
                  type: 'estimate_generated',
                  data: estimateResult,
                });
              }
            }
          }
        }
      }
    }

    // Layer 5: Conversation Response Generation
    const conversationResult = await conversationEngine.generateResponse({
      message,
      intent: result.intent,
      classification: result.classification,
      estimate: result.estimate,
      conversationHistory,
      siteConfig,
      stage: context?.conversation_stage,
      collectedInfo: context?.collected_info,
      missingInfo: result.classification?.suggestedQuestions,
    });

    result.response = conversationResult.response;
    result.stage = conversationResult.stage;

    // Update conversation context
    if (conversationId) {
      await conversationEngine.updateConversationContext(pool, conversationId, {
        currentIntent: result.intent?.intent,
        currentJobType: result.classification?.jobType,
        currentIndustryId: result.classification?.industryId,
        conversationStage: result.stage,
        collectedInfo: mergeCollectedInfo(context?.collected_info, result.classification),
        missingInfo: result.classification?.suggestedQuestions || [],
        estimateId: result.estimate?.id,
        estimatePresented: !!result.estimate,
      });
    }

    // Determine actions needed
    result.actions.push(...determineActions(result, context));

    return result;

  } catch (err) {
    console.error('[orchestrator] Processing error:', err);
    return {
      ...result,
      error: err.message,
      response: conversationEngine.getFallbackResponse(STAGES.GREETING),
    };
  }
}

/**
 * Handle conversational intents (greetings, thanks, etc.)
 */
async function handleConversationalIntent(intent, siteConfig) {
  switch (intent.intent) {
    case INTENTS.GREETING:
      return conversationEngine.generateGreeting(siteConfig);

    case INTENTS.THANK_YOU:
      return "You're welcome! Is there anything else I can help you with?";

    case INTENTS.GOODBYE:
      return "Thank you for reaching out! Don't hesitate to contact us if you have any more questions. Have a great day!";

    case INTENTS.GENERAL_CONVERSATION:
      return "I'm here to help with any service needs or questions you might have. What can I assist you with today?";

    default:
      return "How can I help you today?";
  }
}

/**
 * Determine if we should generate an estimate
 */
function shouldGenerateEstimate(context, classification, intent) {
  // Explicit estimate request
  if (intent.intent === INTENTS.ESTIMATE_REQUEST) {
    return true;
  }

  // High confidence classification and in the right stage
  if (classification.confidence >= 0.8 && 
      context?.conversation_stage === STAGES.CLASSIFICATION_CONFIRMED) {
    return true;
  }

  // Already presented estimate, don't regenerate
  if (context?.estimate_presented) {
    return false;
  }

  return false;
}

/**
 * Merge new classification info with existing collected info
 */
function mergeCollectedInfo(existing, classification) {
  const merged = existing ? { ...existing } : {};

  if (classification) {
    if (classification.jobType) merged.jobType = classification.jobType;
    if (classification.industry) merged.industry = classification.industry;
    if (classification.projectSize) merged.projectSize = classification.projectSize;
    if (classification.keyIndicators) merged.keyIndicators = classification.keyIndicators;
  }

  return merged;
}

/**
 * Determine what actions should be taken based on results
 */
function determineActions(result, context) {
  const actions = [];

  // Need human review for low confidence
  if (result.classification?.confidence < 0.5 && result.classification?.confidence > 0) {
    actions.push({
      type: 'needs_human_review',
      reason: 'Low classification confidence',
    });
  }

  // Emergency detected
  if (result.intent?.urgencyDetected === 'emergency') {
    actions.push({
      type: 'urgent_notification',
      reason: 'Emergency situation detected',
    });
  }

  // Ready for booking
  if (result.stage === STAGES.BOOKING) {
    actions.push({
      type: 'show_booking_options',
    });
  }

  // Estimate ready for approval
  if (result.estimate && !context?.estimate_presented) {
    actions.push({
      type: 'estimate_ready',
      estimateId: result.estimate.id,
    });
  }

  return actions;
}

/**
 * Process a service request through the full pipeline
 * (Used when a service request has already been created)
 */
async function processServiceRequest(pool, requestId) {
  const reqResult = await pool.query(
    `SELECT sr.*, s.name as site_name
     FROM service_requests sr
     JOIN sites s ON sr.site_id = s.id
     WHERE sr.id = $1`,
    [requestId]
  );

  if (reqResult.rows.length === 0) {
    return { ok: false, error: 'Service request not found' };
  }

  const request = reqResult.rows[0];

  return processMessage(pool, request.site_id, request.problem_description, {
    requestId,
    siteConfig: { name: request.site_name },
  });
}

/**
 * Get conversation summary for handoff to human
 */
async function getConversationSummary(pool, conversationId) {
  const [contextResult, intentsResult, classificationsResult] = await Promise.all([
    pool.query(
      `SELECT * FROM ai_conversation_context WHERE conversation_id = $1`,
      [conversationId]
    ),
    pool.query(
      `SELECT intent, confidence, created_at 
       FROM ai_intents 
       WHERE conversation_id = $1 
       ORDER BY created_at DESC LIMIT 5`,
      [conversationId]
    ),
    pool.query(
      `SELECT job_type, industry_slug, confidence, reasoning, created_at
       FROM ai_classifications
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT 3`,
      [conversationId]
    ),
  ]);

  const context = contextResult.rows[0];
  const intents = intentsResult.rows;
  const classifications = classificationsResult.rows;

  return {
    stage: context?.conversation_stage,
    currentIntent: context?.current_intent,
    jobType: context?.current_job_type,
    collectedInfo: context?.collected_info,
    missingInfo: context?.missing_info,
    estimatePresented: context?.estimate_presented,
    recentIntents: intents,
    recentClassifications: classifications,
  };
}

module.exports = {
  processMessage,
  processServiceRequest,
  handleConversationalIntent,
  getConversationSummary,
  shouldGenerateEstimate,
  determineActions,
};
