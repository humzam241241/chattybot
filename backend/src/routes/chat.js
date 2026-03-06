const express = require('express');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const pool = require('../config/database');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { getOrCreateConversation, appendMessage, getRecentMessages, updateConversationSummary } = require('../services/conversationLog');
const { notifyOwnerOfLead } = require('../services/leadNotifier');
const { processConversationForLead } = require('../services/leadPipeline');
const { detectContactInfo } = require('../services/leadDetector');
const { chatLimiter } = require('../middleware/rateLimiter');
const domainVerify = require('../middleware/domainVerify');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple keyword detection for lead capture intent
const LEAD_KEYWORDS = [
  'contact', 'reach out', 'speak to', 'talk to', 'call me', 'email me',
  'get in touch', 'sales', 'pricing', 'demo', 'trial', 'human', 'agent',
  'representative', 'support team',
];

function detectLeadIntent(message) {
  const lower = message.toLowerCase();
  return LEAD_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectBookingIntent(message, raffy) {
  const lower = String(message || '').toLowerCase();
  const keywords = Array.isArray(raffy?.booking?.keywords) && raffy.booking.keywords.length
    ? raffy.booking.keywords
    : ['book', 'booking', 'appointment', 'schedule', 'calendar', 'meeting', 'demo', 'consultation'];
  return keywords.some((kw) => lower.includes(String(kw).toLowerCase()));
}

function detectLeadCaptureOpportunity(message, raffy) {
  if (!raffy?.lead_capture?.enabled) return false;
  const lower = String(message || '').toLowerCase();
  const keywords = raffy?.lead_capture?.trigger_keywords || [
    'repair', 'inspection', 'quote', 'estimate', 'pricing', 'leak', 'damage', 'help', 'service'
  ];
  return keywords.some((kw) => lower.includes(String(kw).toLowerCase()));
}

router.post(
  '/',
  chatLimiter,
  domainVerify,
  [
    body('site_id').isUUID().withMessage('Valid site_id required'),
    body('user_message').isString().trim().isLength({ min: 1, max: 2000 }),
    body('conversation_id').optional({ nullable: true, checkFalsy: false }).isUUID(),
    body('visitor_id').optional().isString().trim().isLength({ max: 128 }),
    body('current_page_url').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, user_message, current_page_url, conversation_id, visitor_id } = req.body;

    try {
      console.log(`[Chat] Processing message for site ${site_id}`);
      
      const settings = await getEffectiveRaffySettings(site_id);
      if (!settings) return res.status(404).json({ error: 'Site not found' });
      const { site, raffy } = settings;
      console.log(`[Chat] Settings loaded for ${site.company_name}`);
      console.log(`[Chat] SITE ID: ${site_id}`);
      console.log(`[Chat] Custom system_prompt exists: ${Boolean(site.system_prompt)}`);
      if (site.system_prompt) {
        console.log(`[Chat] Custom system_prompt (first 100 chars): ${site.system_prompt.substring(0, 100)}...`);
      }

      const convoId = await getOrCreateConversation({
        siteId: site_id,
        visitorId: visitor_id,
        conversationId: conversation_id,
        currentPageUrl: current_page_url,
      });
      console.log(`[Chat] Conversation: ${convoId}, Site: ${site_id}, Visitor: ${visitor_id}`);

      await appendMessage({ conversationId: convoId, siteId: site_id, role: 'user', content: user_message });

      // Emergency handling (keyword-based MVP) - only for life-threatening emergencies
      const emergencyKeywords = raffy?.emergency?.keywords || [];
      const emergencyResponse = raffy?.emergency?.response;
      const msgLower = user_message.toLowerCase();
      
      // More specific emergency detection - avoid false positives for business emergencies
      const isLifeThreateningEmergency = Array.isArray(emergencyKeywords) && emergencyKeywords.some((k) => {
        const keyword = String(k).toLowerCase();
        // Only trigger on specific life-threatening keywords, not generic "emergency" or "urgent"
        const criticalKeywords = ['suicide', 'self-harm', 'harm myself', 'kill myself', '911', 'ambulance', 'overdose', 'dying'];
        return criticalKeywords.includes(keyword) && msgLower.includes(keyword);
      });

      // RAG: retrieve relevant chunks
      console.log(`[Chat] Retrieving context...`);
      const contextChunks = await retrieveContext(site_id, user_message);
      console.log(`[Chat] Context chunks retrieved: ${contextChunks.length}`);

      // ALWAYS build the prompt with RAG context, even if custom system_prompt exists
      const basePrompt = buildSystemPrompt(site, contextChunks);
      console.log(`[Chat] Base prompt built (first 150 chars): ${basePrompt.substring(0, 150)}...`);
      
      const guardrails = raffy?.guardrails?.wont_say?.length
        ? `\n\nGuardrails (never do these):\n- ${raffy.guardrails.wont_say.join('\n- ')}`
        : '';
      const tone = raffy?.tone ? `\n\nTone: ${raffy.tone}.` : '';
      const humor = raffy?.humor?.enabled
        ? `\n\nHumor: ${raffy.humor.guidelines || 'Light, professional humor only.'}`
        : '\n\nHumor: disabled.';
      const sales = raffy?.sales_prompts?.cta
        ? `\n\nSales CTA (when relevant): ${raffy.sales_prompts.cta}`
        : '';
      const identity = `You are ${raffy?.name || 'Assistant'}, the ${raffy?.role || 'AI assistant'} for ${site.company_name}.`;
      const emergency = emergencyResponse && isLifeThreateningEmergency
        ? `\n\nCRITICAL EMERGENCY RULE: If the user mentions suicide, self-harm, or life-threatening crisis, respond with:\n"${emergencyResponse}"`
        : '';
      
      // Lead capture prompt - encourage asking for contact info when service interest detected
      const leadCapturePrompt = raffy?.lead_capture?.enabled
        ? `\n\nLEAD CAPTURE: When the user expresses interest in services (repair, inspection, quote, leak, damage, pricing), after answering their question, offer to have someone reach out. Ask for their email or phone number in a friendly, non-pushy way. Example: "${raffy?.lead_capture?.prompt || "Would you like someone from our team to reach out? I'd just need your email or phone number."}"`
        : '';

      // Consent guardrail: if user provides an email in chat, ask permission to email them.
      const contactInMessage = detectContactInfo(user_message);
      const consentPrompt = contactInMessage?.emails?.length
        ? `\n\nCONSENT (EMAIL): The user included an email address in their message. Before you confirm follow-up or say you'll email them, ask explicit permission in a simple yes/no question, e.g. "Is it okay if we email you at ${contactInMessage.emails[0]} about this?" If they say no, acknowledge and offer an alternative (phone call or booking link). If they already granted permission earlier in the conversation, you may proceed without asking again.`
        : '';

      const systemPrompt = `${identity}\n\n${basePrompt}${tone}${guardrails}${emergency}${sales}${leadCapturePrompt}${consentPrompt}${humor}`;
      
      console.log(`[Chat] SYSTEM PROMPT USED (first 200 chars):\n${systemPrompt.substring(0, 200)}...`);

      // Build messages array; optionally hint on the current page for context
      const userContent = current_page_url
        ? `[User is on page: ${current_page_url}]\n\n${user_message}`
        : user_message;

      // Load conversation history for context (exclude current user message - we add it with page context)
      const recent = await getRecentMessages(convoId, 201); // 201 = up to 100 turns + current
      const conversationHistory = recent.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      console.log(`[Chat] Conversation history: ${conversationHistory.length} messages loaded, conversation has ${recent.length} total messages`);

      let answer = emergencyResponse && isLifeThreateningEmergency
        ? emergencyResponse
        : null;

      if (!answer) {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Fast, cheap, good enough for RAG answers
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userContent },
          ],
          max_tokens: 500,
          temperature: 0.3, // Low temp = more factual, less hallucination
        });
        answer = completion.choices[0].message.content;
      }

      const escalationKeywords = raffy?.escalation_triggers?.keywords || [];
      const wantsHuman = Array.isArray(escalationKeywords) && escalationKeywords.some((k) => msgLower.includes(String(k).toLowerCase()));
      const shouldCaptureLead = wantsHuman || detectLeadIntent(user_message) || detectLeadIntent(answer);

      const bookingUrl = raffy?.booking?.url ? String(raffy.booking.url) : '';
      const wantsBooking = detectBookingIntent(user_message, raffy);
      const shouldOfferBooking = Boolean(bookingUrl) && wantsBooking;

      const intent = isLifeThreateningEmergency
        ? 'emergency'
        : shouldOfferBooking
          ? 'booking'
          : shouldCaptureLead
            ? 'escalation'
            : 'kb';

      const afterAssistant = await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
      console.log(`[Chat] Assistant response saved. Total messages in conversation: ${afterAssistant.message_count}`);

      // Rolling summary update every 8 messages (≈4 turns)
      if (afterAssistant.message_count % 8 === 0) {
        const recent = await getRecentMessages(convoId, 12);
        const summaryPrompt = [
          'You update a rolling summary of a customer support conversation.',
          'Keep it concise (max 800 characters).',
          '',
          `Existing summary:\n${afterAssistant.summary || '(none)'}`,
          '',
          'Recent messages:',
          ...recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
          '',
          'Return ONLY the updated summary text.',
        ].join('\n');

        const summaryCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: summaryPrompt }],
          max_tokens: 220,
          temperature: 0.2,
        });
        const newSummary = summaryCompletion.choices[0].message.content?.trim() || '';
        if (newSummary) await updateConversationSummary(convoId, newSummary);
      }

      // ─── Lead Pipeline: Automatic lead capture ───────────────────────
      // Process conversation for lead extraction (non-blocking)
      processConversationForLead({
        conversationId: convoId,
        siteId: site_id,
        userMessage: user_message,
        intent,
      }).catch((err) => {
        console.warn('[Chat] Lead pipeline failed (non-fatal):', err.message);
      });

      // Legacy: Trigger lead notification for high-value intents (backup)
      if (intent === 'booking' || intent === 'emergency' || intent === 'escalation') {
        notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent }).catch((err) => {
          console.warn('[Chat] Lead notification failed (non-fatal):', err.message);
        });
      }

      return res.json({
        answer,
        intent,
        should_capture_lead: shouldCaptureLead,
        should_offer_booking: shouldOfferBooking,
        booking_url: shouldOfferBooking ? bookingUrl : null,
        context_used: contextChunks.length,
        conversation_id: convoId,
      });
    } catch (err) {
      console.error('Chat error:', err.message, err.stack);
      return res.status(500).json({ 
        error: 'Failed to process message',
        detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
        step: err._step || 'unknown'
      });
    }
  }
);

// POST /chat/stream — SSE streaming responses (same request body as /chat)
router.post(
  '/stream',
  chatLimiter,
  domainVerify,
  [
    body('site_id').isUUID().withMessage('Valid site_id required'),
    body('user_message').isString().trim().isLength({ min: 1, max: 2000 }),
    body('conversation_id').optional({ nullable: true, checkFalsy: false }).isUUID(),
    body('visitor_id').optional().isString().trim().isLength({ max: 128 }),
    body('current_page_url').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, user_message, current_page_url, conversation_id, visitor_id } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => { closed = true; });

    try {
      const settings = await getEffectiveRaffySettings(site_id);
      if (!settings) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Site not found' })}\n\n`);
        return res.end();
      }
      const { site, raffy } = settings;
      
      console.log(`[Chat/Stream] SITE ID: ${site_id}`);
      console.log(`[Chat/Stream] Custom system_prompt exists: ${Boolean(site.system_prompt)}`);

      const convoId = await getOrCreateConversation({
        siteId: site_id,
        visitorId: visitor_id,
        conversationId: conversation_id,
        currentPageUrl: current_page_url,
      });

      await appendMessage({ conversationId: convoId, siteId: site_id, role: 'user', content: user_message });

      const emergencyKeywords = raffy?.emergency?.keywords || [];
      const emergencyResponse = raffy?.emergency?.response;
      const msgLower = String(user_message || '').toLowerCase();
      
      // More specific emergency detection - only for life-threatening emergencies
      const isLifeThreateningEmergency = Array.isArray(emergencyKeywords) && emergencyKeywords.some((k) => {
        const keyword = String(k).toLowerCase();
        const criticalKeywords = ['suicide', 'self-harm', 'harm myself', 'kill myself', '911', 'ambulance', 'overdose', 'dying'];
        return criticalKeywords.includes(keyword) && msgLower.includes(keyword);
      });

      const bookingUrl = raffy?.booking?.url ? String(raffy.booking.url) : '';
      const wantsBooking = detectBookingIntent(user_message, raffy);
      const shouldOfferBooking = Boolean(bookingUrl) && wantsBooking;

      const escalationKeywords = raffy?.escalation_triggers?.keywords || [];
      const wantsHuman = Array.isArray(escalationKeywords) && escalationKeywords.some((k) => msgLower.includes(String(k).toLowerCase()));
      const intent = isLifeThreateningEmergency ? 'emergency' : shouldOfferBooking ? 'booking' : wantsHuman ? 'escalation' : 'kb';

      // RAG: retrieve relevant chunks
      const contextChunks = await retrieveContext(site_id, user_message);
      console.log(`[Chat/Stream] Context chunks: ${contextChunks.length}`);
      
      // ALWAYS build the prompt with RAG context, even if custom system_prompt exists
      const basePrompt = buildSystemPrompt(site, contextChunks);
      
      const guardrails = raffy?.guardrails?.wont_say?.length
        ? `\n\nGuardrails (never do these):\n- ${raffy.guardrails.wont_say.join('\n- ')}`
        : '';
      const tone = raffy?.tone ? `\n\nTone: ${raffy.tone}.` : '';
      const humor = raffy?.humor?.enabled
        ? `\n\nHumor: ${raffy.humor.guidelines || 'Light, professional humor only.'}`
        : '\n\nHumor: disabled.';
      const sales = raffy?.sales_prompts?.cta
        ? `\n\nSales CTA (when relevant): ${raffy.sales_prompts.cta}`
        : '';
      const identity = `You are ${raffy?.name || 'Assistant'}, the ${raffy?.role || 'AI assistant'} for ${site.company_name}.`;
      const emergency = emergencyResponse && isLifeThreateningEmergency
        ? `\n\nCRITICAL EMERGENCY RULE: If the user mentions suicide, self-harm, or life-threatening crisis, respond with:\n"${emergencyResponse}"`
        : '';
      
      // Lead capture prompt - encourage asking for contact info when service interest detected
      const leadCapturePrompt = raffy?.lead_capture?.enabled
        ? `\n\nLEAD CAPTURE: When the user expresses interest in services (repair, inspection, quote, leak, damage, pricing), after answering their question, offer to have someone reach out. Ask for their email or phone number in a friendly, non-pushy way. Example: "${raffy?.lead_capture?.prompt || "Would you like someone from our team to reach out? I'd just need your email or phone number."}"`
        : '';

      // Consent guardrail: if user provides an email in chat, ask permission to email them.
      const contactInMessage = detectContactInfo(user_message);
      const consentPrompt = contactInMessage?.emails?.length
        ? `\n\nCONSENT (EMAIL): The user included an email address in their message. Before you confirm follow-up or say you'll email them, ask explicit permission in a simple yes/no question, e.g. "Is it okay if we email you at ${contactInMessage.emails[0]} about this?" If they say no, acknowledge and offer an alternative (phone call or booking link). If they already granted permission earlier in the conversation, you may proceed without asking again.`
        : '';

      const systemPrompt = `${identity}\n\n${basePrompt}${tone}${guardrails}${emergency}${sales}${leadCapturePrompt}${consentPrompt}${humor}`;
      
      console.log(`[Chat/Stream] SYSTEM PROMPT (first 200 chars):\n${systemPrompt.substring(0, 200)}...`);

      const userContent = current_page_url
        ? `[User is on page: ${current_page_url}]\n\n${user_message}`
        : user_message;

      // Load conversation history for context (exclude current user message)
      const recent = await getRecentMessages(convoId, 201);
      const conversationHistory = recent.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      console.log(`[Chat/Stream] Conversation history: ${conversationHistory.length} messages loaded, conversation has ${recent.length} total messages`);

      res.write(`event: meta\ndata: ${JSON.stringify({ conversation_id: convoId, intent, context_used: contextChunks.length })}\n\n`);

      if (emergencyResponse && isLifeThreateningEmergency) {
        res.write(`event: token\ndata: ${JSON.stringify({ token: emergencyResponse })}\n\n`);
        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: emergencyResponse });
        
        // Trigger lead notification for emergency (non-blocking)
        notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent }).catch((err) => {
          console.warn('[Chat/Stream] Lead notification failed (non-fatal):', err.message);
        });

        res.write(`event: done\ndata: ${JSON.stringify({ should_capture_lead: wantsHuman, should_offer_booking: shouldOfferBooking, booking_url: shouldOfferBooking ? bookingUrl : null })}\n\n`);
        return res.end();
      }

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userContent },
        ],
        max_tokens: 500,
        temperature: 0.3,
        stream: true,
      });

      let answer = '';
      for await (const chunk of stream) {
        if (closed) break;
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) {
          answer += token;
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      }

      if (!closed) {
        const shouldCaptureLead = wantsHuman || detectLeadIntent(user_message) || detectLeadIntent(answer);
        const afterAssistant = await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
        console.log(`[Chat/Stream] Assistant response saved to conversation ${convoId}. Total messages: ${afterAssistant.message_count}`);
        
        // Rolling summary update every 8 messages (≈4 turns)
        if (afterAssistant.message_count % 8 === 0) {
          const recent = await getRecentMessages(convoId, 12);
          const summaryPrompt = [
            'You update a rolling summary of a customer support conversation.',
            'Keep it concise (max 800 characters).',
            '',
            `Existing summary:\n${afterAssistant.summary || '(none)'}`,
            '',
            'Recent messages:',
            ...recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
            '',
            'Return ONLY the updated summary text.',
          ].join('\n');

          const summaryCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: summaryPrompt }],
            max_tokens: 220,
            temperature: 0.2,
          });
          const newSummary = summaryCompletion.choices[0].message.content?.trim() || '';
          if (newSummary) {
            await updateConversationSummary(convoId, newSummary);
            console.log(`[Chat/Stream] Summary updated for conversation ${convoId}`);
          }
        }
        
        // ─── Lead Pipeline: Automatic lead capture ───────────────────────
        processConversationForLead({
          conversationId: convoId,
          siteId: site_id,
          userMessage: user_message,
          intent,
        }).catch((err) => {
          console.warn('[Chat/Stream] Lead pipeline failed (non-fatal):', err.message);
        });

        // Legacy: Trigger lead notification for high-value intents (backup)
        if (intent === 'booking' || intent === 'emergency' || intent === 'escalation') {
          notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent }).catch((err) => {
            console.warn('[Chat/Stream] Lead notification failed (non-fatal):', err.message);
          });
        }

        res.write(`event: done\ndata: ${JSON.stringify({ should_capture_lead: shouldCaptureLead, should_offer_booking: shouldOfferBooking, booking_url: shouldOfferBooking ? bookingUrl : null })}\n\n`);
        return res.end();
      }

      return res.end();
    } catch (err) {
      console.error('Chat stream error:', err);
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to process message' })}\n\n`);
      return res.end();
    }
  }
);

module.exports = router;
