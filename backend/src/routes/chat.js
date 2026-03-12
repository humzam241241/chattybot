const express = require('express');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const pool = require('../config/database');
const twilioWebhookRouter = require('./twilioWebhook');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const {
  getOrCreateConversation,
  appendMessage,
  getRecentMessages,
  updateConversationSummary,
  getMisunderstoodCount,
  setMisunderstoodCount,
} = require('../services/conversationLog');
const { notifyOwnerOfLead } = require('../services/leadNotifier');
const { processConversationForLead } = require('../services/leadPipeline');
const { detectContactInfo } = require('../services/leadDetector');
const { chatLimiter } = require('../middleware/rateLimiter');
const domainVerify = require('../middleware/domainVerify');
const { trackApiUsage } = require('../middleware/usageTracking');
const { checkLimit, recordUsage } = require('../services/usageService');
const { generateQuote } = require('../services/quoteGenerator');
const {
  detectRyanTrigger,
  buildRyanEscalationMessage,
  buildMisunderstoodFallbackMessage,
  nextMisunderstoodCount,
  clampMisunderstoodCount,
} = require('../services/raffyEscalation');
const { isLifeThreateningEmergency } = require('../services/emergencyDetection');
const { getSupabaseClient, getUploadsBucket } = require('../services/supabaseStorage');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BASE64_SIZE = 6 * 1024 * 1024; // ~6MB decoded

function getImageExt(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

async function uploadChatImage({ siteId, conversationId, base64, contentType }) {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type)) throw new Error('Unsupported image type');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_IMAGE_BASE64_SIZE) throw new Error('Image too large');
  const supabase = getSupabaseClient();
  const bucket = getUploadsBucket();
  const fileId = uuidv4();
  const ext = getImageExt(type);
  const path = `chat-media/${siteId}/${conversationId}/${fileId}.${ext}`;
  await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: type,
    upsert: false,
  });
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

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

function detectEstimateIntent(message) {
  const lower = String(message || '').toLowerCase();
  const keywords = ['how much', 'price', 'pricing', 'quote', 'estimate'];
  return keywords.some((kw) => lower.includes(kw));
}

function inferServiceType(message) {
  const t = String(message || '').toLowerCase();
  if (t.includes('flat')) return 'flat roof repair';
  if (t.includes('vent')) return 'attic ventilation';
  if (t.includes('inspect')) return 'roof inspection';
  if (t.includes('emergency') || t.includes('urgent')) return 'emergency repair';
  if (t.includes('replace') || t.includes('replacement') || t.includes('new roof') || t.includes('shingle')) {
    return 'shingle roof replacement';
  }
  return 'roof inspection';
}

function parseYesNo(message) {
  const t = String(message || '').trim().toLowerCase();
  if (!t) return null;
  if (/^(y|yes|yeah|yep|ok|okay|sure|sounds good|please do)\b/.test(t)) return 'yes';
  if (/^(n|no|nope|nah|dont|don't|do not)\b/.test(t)) return 'no';
  return null;
}

async function getConversationConsent(conversationId) {
  const r = await pool.query(
    `SELECT email_consent_status, email_consent_email
     FROM conversations
     WHERE id = $1`,
    [conversationId]
  );
  return r.rows?.[0] || { email_consent_status: 'unknown', email_consent_email: null };
}

async function setConversationConsent(conversationId, status, email = null) {
  await pool.query(
    `UPDATE conversations
     SET email_consent_status = $2::text,
         email_consent_email = $3::text,
         email_consent_updated_at = NOW(),
         email_consent_requested_at = CASE WHEN $2::text = 'pending' THEN NOW() ELSE email_consent_requested_at END,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [conversationId, status, email]
  );
}

router.post(
  '/',
  chatLimiter,
  domainVerify,
  [
    body('site_id').isUUID().withMessage('Valid site_id required'),
    body('user_message').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 2000 }),
    body('user_image_base64').optional({ nullable: true, checkFalsy: true }).isString(),
    body('user_image_content_type').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 64 }),
    body('conversation_id').optional({ nullable: true, checkFalsy: false }).isUUID(),
    body('visitor_id').optional().isString().trim().isLength({ max: 128 }),
    body('current_page_url').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, user_message, user_image_base64, user_image_content_type, current_page_url, conversation_id, visitor_id } = req.body;
    const text = (user_message && String(user_message).trim()) || '';
    const hasImage = user_image_base64 && String(user_image_base64).trim().length > 0;
    if (!text && !hasImage) {
      return res.status(400).json({ error: 'Provide a message or an image' });
    }

    trackApiUsage(site_id, 'chat').catch(() => {});

    try {
      console.log(`[Chat] Processing message for site ${site_id}`);
      
      const settings = await getEffectiveRaffySettings(site_id);
      if (!settings) return res.status(404).json({ error: 'Site not found' });
      const { site, raffy } = settings;
      console.log(`[Chat] Settings loaded for ${site.company_name}`);

      // Server-side usage enforcement (before AI call)
      await checkLimit(site.id);
      console.log(`[Chat] SITE ID: ${site_id}`);
      console.log(`[Chat] Custom system_prompt exists: ${Boolean(site.system_prompt)}`);
      if (site.system_prompt) {
        console.log(`[Chat] Custom system_prompt (first 100 chars): ${site.system_prompt.substring(0, 100)}...`);
      }

      let convoId = await getOrCreateConversation({
        siteId: site_id,
        visitorId: visitor_id,
        conversationId: conversation_id,
        currentPageUrl: current_page_url,
      });
      if (!convoId) {
        convoId = await twilioWebhookRouter.findOrCreateConversationIdForTwilio({ siteId: site_id, from: visitor_id });
      }
      console.log(`[Chat] Conversation: ${convoId}, Site: ${site_id}, Visitor: ${visitor_id}`);

      let mediaUrl = null;
      let mediaContentType = null;
      if (hasImage) {
        try {
          mediaUrl = await uploadChatImage({
            siteId: site_id,
            conversationId: convoId,
            base64: String(user_image_base64).trim(),
            contentType: (user_image_content_type && String(user_image_content_type).trim()) || 'image/jpeg',
          });
          mediaContentType = (user_image_content_type && String(user_image_content_type).trim()) || 'image/jpeg';
        } catch (err) {
          console.warn('[Chat] Image upload failed:', err.message);
          return res.status(400).json({ error: err.message || 'Image upload failed' });
        }
      }
      await appendMessage({
        conversationId: convoId,
        siteId: site_id,
        role: 'user',
        content: text || 'Image shared',
        mediaUrl: mediaUrl || undefined,
        mediaContentType: mediaContentType || undefined,
      });

      // Track consecutive misunderstood turns per conversation
      const prevMisunderstoodCount = clampMisunderstoodCount(
        await getMisunderstoodCount({ conversationId: convoId, siteId: site_id })
      );

      // ─── Smart Quote Tool trigger ─────────────────────────────────────
      if (detectEstimateIntent(text)) {
        const inferredServiceType = inferServiceType(text);
        const urgency = /emergency|urgent|asap|right now|today/.test(String(text || '').toLowerCase())
          ? 'emergency'
          : 'standard';

        const quote = await generateQuote({
          serviceType: inferredServiceType,
          roofSize: null,
          roofType: null,
          urgency,
          notes: text,
          siteId: site_id,
        });

        const bookingUrl = raffy?.booking?.url ? String(raffy.booking.url) : '';
        const quoteUrl = process.env.QUOTE_PAGE_BASE_URL
          ? `${String(process.env.QUOTE_PAGE_BASE_URL).replace(/\/$/, '')}/quote/${quote.quote_id}`
          : null;

        const answerLines = [];
        answerLines.push(`Here’s a quick estimate for **${inferredServiceType}** (Ontario):`);
        answerLines.push(`- **Price range**: $${Math.round(quote.price_low).toLocaleString('en-CA')}–$${Math.round(quote.price_high).toLocaleString('en-CA')} CAD`);
        if (quote.timeline_estimate) answerLines.push(`- **Timeline**: ${quote.timeline_estimate}`);
        if (quote.recommended_service) answerLines.push(`- **Recommended**: ${quote.recommended_service}`);
        answerLines.push('');
        answerLines.push('If you can share your approximate roof size (sq ft) and roof type, I can narrow this down.');
        if (quoteUrl) answerLines.push(`View this quote: ${quoteUrl}`);

        const answer = answerLines.join('\n');
        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
        await setMisunderstoodCount({ conversationId: convoId, siteId: site_id, misunderstoodCount: 0 });

        recordUsage(site.id).catch(() => {});

        return res.json({
          answer,
          intent: 'estimate',
          quote,
          quote_url: quoteUrl,
          should_capture_lead: false,
          should_offer_booking: Boolean(bookingUrl),
          booking_url: bookingUrl || null,
          booking_embed: Boolean(raffy?.booking?.embed),
          booking_button_text: raffy?.booking?.button_text ? String(raffy.booking.button_text) : null,
          context_used: 0,
          conversation_id: convoId,
        });
      }

      // ─── Ryan escalation (explicit trigger) ───────────────────────────
      if (detectRyanTrigger(text)) {
        const ownerPhone = raffy?.owner?.phone || raffy?.owner_phone || null;
        const answer = buildRyanEscalationMessage(ownerPhone);
        const intent = 'escalation';

        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
        await setMisunderstoodCount({ conversationId: convoId, siteId: site_id, misunderstoodCount: 0 });

        recordUsage(site.id).catch(() => {});

        processConversationForLead({
          conversationId: convoId,
          siteId: site_id,
          userMessage: text,
          intent,
        }).catch((err) => console.warn('[Chat] Lead pipeline failed (non-fatal):', err.message));

        notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent }).catch((err) => {
          console.warn('[Chat] Lead notification failed (non-fatal):', err.message);
        });

        return res.json({
          answer,
          intent,
          should_capture_lead: true,
          should_offer_booking: false,
          booking_url: null,
          booking_embed: false,
          booking_button_text: null,
          context_used: 0,
          conversation_id: convoId,
        });
      }

      // ─── Consent handling ────────────────────────────────────────────────
      // If the user provided an email in chat, we must ask explicit permission
      // before claiming we will email them. We track consent per-conversation.
      let consentState = await getConversationConsent(convoId);

      // Resolve pending consent if user replied yes/no
      if (consentState.email_consent_status === 'pending' && consentState.email_consent_email) {
        const yn = parseYesNo(text);
        if (yn === 'yes') {
          await setConversationConsent(convoId, 'granted', consentState.email_consent_email);
          console.log(`[Consent] Email consent granted for ${consentState.email_consent_email} (conversation ${convoId})`);
          consentState = { email_consent_status: 'granted', email_consent_email: consentState.email_consent_email };
        } else if (yn === 'no') {
          await setConversationConsent(convoId, 'denied', consentState.email_consent_email);
          console.log(`[Consent] Email consent denied for ${consentState.email_consent_email} (conversation ${convoId})`);
          consentState = { email_consent_status: 'denied', email_consent_email: consentState.email_consent_email };
        }
      }

      const contactInMessage = detectContactInfo(text);
      const emailInMessage = contactInMessage?.emails?.[0] || null;
      let mustAskConsentNow = false;
      if (emailInMessage) {
        const isNewEmailForConversation = consentState.email_consent_email !== emailInMessage;
        const alreadyGrantedForThisEmail =
          consentState.email_consent_status === 'granted' && consentState.email_consent_email === emailInMessage;

        if (!alreadyGrantedForThisEmail || isNewEmailForConversation) {
          // New email typed in chat → log + mark consent pending (so the bot asks).
          await setConversationConsent(convoId, 'pending', emailInMessage);
          console.log(`[Consent] New email provided in chat: ${emailInMessage} (conversation ${convoId}) → consent pending`);
          mustAskConsentNow = true;
        }
      }

      // Emergency handling (keyword-based MVP) - only for life-threatening emergencies
      const emergencyKeywords = raffy?.emergency?.keywords || [];
      const emergencyResponse = raffy?.emergency?.response;
      const msgLower = (text || '').toLowerCase();
      const lifeThreatening = isLifeThreateningEmergency({ message: text, raffy });

      // RAG: retrieve relevant chunks
      console.log(`[Chat] Retrieving context...`);
      const contextChunks = await retrieveContext(site_id, text);
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
      const emergency = emergencyResponse && lifeThreatening
        ? `\n\nCRITICAL EMERGENCY RULE: If the user mentions suicide, self-harm, or life-threatening crisis, respond with:\n"${emergencyResponse}"`
        : '';
      
      // Lead capture prompt - encourage asking for contact info when service interest detected
      const leadCapturePrompt = raffy?.lead_capture?.enabled
        ? `\n\nLEAD CAPTURE: When the user expresses interest in services (repair, inspection, quote, leak, damage, pricing), after answering their question, offer to have someone reach out. Ask for their email or phone number in a friendly, non-pushy way. Example: "${raffy?.lead_capture?.prompt || "Would you like someone from our team to reach out? I'd just need your email or phone number."}"`
        : '';

      // Consent guardrail for the model (we ALSO enforce by appending a consent question below when needed).
      const consentPrompt = emailInMessage
        ? `\n\nCONSENT (EMAIL): The user included an email address in their message. Do not promise you will email them without explicit permission. Ask a clear yes/no question first.`
        : '';

      const systemPrompt = `${identity}\n\n${basePrompt}${tone}${guardrails}${emergency}${sales}${leadCapturePrompt}${consentPrompt}${humor}`;
      
      console.log(`[Chat] SYSTEM PROMPT USED (first 200 chars):\n${systemPrompt.substring(0, 200)}...`);

      // Build messages array; optionally hint on the current page for context; support vision when image present
      const textWithPage = current_page_url
        ? `[User is on page: ${current_page_url}]\n\n${text || ''}`
        : (text || '');
      const userContent = hasImage
        ? [
            { type: 'text', text: textWithPage || 'What do you see in this image?' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${(user_image_content_type && String(user_image_content_type).trim()) || 'image/jpeg'};base64,${String(user_image_base64).trim()}`,
              },
            },
          ]
        : textWithPage;

      // Load conversation history for context (exclude current user message - we add it with page context)
      const recent = await getRecentMessages(convoId, 201); // 201 = up to 100 turns + current
      const conversationHistory = recent.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      console.log(`[Chat] Conversation history: ${conversationHistory.length} messages loaded, conversation has ${recent.length} total messages`);

      let answer = emergencyResponse && lifeThreatening
        ? emergencyResponse
        : null;

      if (!answer) {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Vision-capable; good for RAG and images
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

      // ─── Fallback handler: escalate after 2 misunderstood turns ─────────
      const newMisunderstoodCount = nextMisunderstoodCount(prevMisunderstoodCount, { answer });
      await setMisunderstoodCount({
        conversationId: convoId,
        siteId: site_id,
        misunderstoodCount: newMisunderstoodCount,
      });

      if (newMisunderstoodCount >= 2) {
        answer = buildMisunderstoodFallbackMessage();
      }

      if (mustAskConsentNow && emailInMessage) {
        const consentLine = `\n\nBefore we reach out, is it okay if we email you at ${emailInMessage}? Reply YES or NO.`;
        if (!answer.toLowerCase().includes('reply yes or no') && !answer.toLowerCase().includes('is it okay if we email')) {
          answer += consentLine;
        }
      }

      const escalationKeywords = raffy?.escalation_triggers?.keywords || [];
      const wantsHuman = Array.isArray(escalationKeywords) && escalationKeywords.some((k) => msgLower.includes(String(k).toLowerCase()));
      const shouldCaptureLead = wantsHuman || detectLeadIntent(text) || detectLeadIntent(answer) || newMisunderstoodCount >= 2;

      const bookingUrl = raffy?.booking?.url ? String(raffy.booking.url) : '';
      const wantsBooking = detectBookingIntent(text, raffy);
      const shouldOfferBooking = Boolean(bookingUrl) && wantsBooking;
      const bookingEmbed = Boolean(raffy?.booking?.embed);
      const bookingButtonText = raffy?.booking?.button_text ? String(raffy.booking.button_text) : null;

      const intent = lifeThreatening
        ? 'emergency'
        : shouldOfferBooking
          ? 'booking'
          : shouldCaptureLead
            ? 'escalation'
            : 'kb';

      const afterAssistant = await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
      console.log(`[Chat] Assistant response saved. Total messages in conversation: ${afterAssistant.message_count}`);

      // Count 1 API request per completed chatbot response (metered billing)
      recordUsage(site.id).catch(() => {});

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
        userMessage: text,
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
        quote: null,
        quote_url: null,
        should_capture_lead: shouldCaptureLead,
        should_offer_booking: shouldOfferBooking,
        booking_url: shouldOfferBooking ? bookingUrl : null,
        booking_embed: bookingEmbed,
        booking_button_text: bookingButtonText,
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
    body('user_message').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 2000 }),
    body('user_image_base64').optional({ nullable: true, checkFalsy: true }).isString(),
    body('user_image_content_type').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 64 }),
    body('conversation_id').optional({ nullable: true, checkFalsy: false }).isUUID(),
    body('visitor_id').optional().isString().trim().isLength({ max: 128 }),
    body('current_page_url').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, user_message, user_image_base64, user_image_content_type, current_page_url, conversation_id, visitor_id } = req.body;
    const text = (user_message && String(user_message).trim()) || '';
    const hasImage = user_image_base64 && String(user_image_base64).trim().length > 0;
    if (!text && !hasImage) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Provide a message or an image' });
    }

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

      // Server-side usage enforcement (before AI call)
      await checkLimit(site.id);
      
      console.log(`[Chat/Stream] SITE ID: ${site_id}`);
      console.log(`[Chat/Stream] Custom system_prompt exists: ${Boolean(site.system_prompt)}`);

      let convoId = await getOrCreateConversation({
        siteId: site_id,
        visitorId: visitor_id,
        conversationId: conversation_id,
        currentPageUrl: current_page_url,
      });
      if (!convoId) {
        convoId = await twilioWebhookRouter.findOrCreateConversationIdForTwilio({ siteId: site_id, from: visitor_id });
      }

      let mediaUrl = null;
      let mediaContentType = null;
      if (hasImage) {
        try {
          mediaUrl = await uploadChatImage({
            siteId: site_id,
            conversationId: convoId,
            base64: String(user_image_base64).trim(),
            contentType: (user_image_content_type && String(user_image_content_type).trim()) || 'image/jpeg',
          });
          mediaContentType = (user_image_content_type && String(user_image_content_type).trim()) || 'image/jpeg';
        } catch (err) {
          console.warn('[Chat/Stream] Image upload failed:', err.message);
          res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || 'Image upload failed' })}\n\n`);
          return res.end();
        }
      }
      await appendMessage({
        conversationId: convoId,
        siteId: site_id,
        role: 'user',
        content: text || 'Image shared',
        mediaUrl: mediaUrl || undefined,
        mediaContentType: mediaContentType || undefined,
      });

      const prevMisunderstoodCount = clampMisunderstoodCount(
        await getMisunderstoodCount({ conversationId: convoId, siteId: site_id })
      );

      // ─── Smart Quote Tool trigger ─────────────────────────────────────
      if (detectEstimateIntent(text)) {
        const inferredServiceType = inferServiceType(text);
        const urgency = /emergency|urgent|asap|right now|today/.test(String(text || '').toLowerCase())
          ? 'emergency'
          : 'standard';

        const quote = await generateQuote({
          serviceType: inferredServiceType,
          roofSize: null,
          roofType: null,
          urgency,
          notes: text,
          siteId: site_id,
        });

        const bookingUrl = raffy?.booking?.url ? String(raffy.booking.url) : '';
        const quoteUrl = process.env.QUOTE_PAGE_BASE_URL
          ? `${String(process.env.QUOTE_PAGE_BASE_URL).replace(/\/$/, '')}/quote/${quote.quote_id}`
          : null;

        const answerLines = [];
        answerLines.push(`Here’s a quick estimate for **${inferredServiceType}** (Ontario):`);
        answerLines.push(`- **Price range**: $${Math.round(quote.price_low).toLocaleString('en-CA')}–$${Math.round(quote.price_high).toLocaleString('en-CA')} CAD`);
        if (quote.timeline_estimate) answerLines.push(`- **Timeline**: ${quote.timeline_estimate}`);
        if (quote.recommended_service) answerLines.push(`- **Recommended**: ${quote.recommended_service}`);
        answerLines.push('');
        answerLines.push('If you can share your approximate roof size (sq ft) and roof type, I can narrow this down.');
        if (quoteUrl) answerLines.push(`View this quote: ${quoteUrl}`);

        const answer = answerLines.join('\n');

        res.write(`event: meta\ndata: ${JSON.stringify({ conversation_id: convoId, intent: 'estimate', context_used: 0 })}\n\n`);
        res.write(`event: token\ndata: ${JSON.stringify({ token: answer })}\n\n`);

        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
        await setMisunderstoodCount({ conversationId: convoId, siteId: site_id, misunderstoodCount: 0 });

        recordUsage(site.id).catch(() => {});

        res.write(
          `event: done\ndata: ${JSON.stringify({
            should_capture_lead: false,
            should_offer_booking: Boolean(bookingUrl),
            booking_url: bookingUrl || null,
            booking_embed: Boolean(raffy?.booking?.embed),
            booking_button_text: raffy?.booking?.button_text ? String(raffy.booking.button_text) : null,
            quote,
            quote_url: quoteUrl,
          })}\n\n`
        );
        return res.end();
      }

      // ─── Ryan escalation (explicit trigger) ───────────────────────────
      if (detectRyanTrigger(text)) {
        const ownerPhone = raffy?.owner?.phone || raffy?.owner_phone || null;
        const answer = buildRyanEscalationMessage(ownerPhone);
        const intent = 'escalation';

        res.write(`event: meta\ndata: ${JSON.stringify({ conversation_id: convoId, intent, context_used: 0 })}\n\n`);
        res.write(`event: token\ndata: ${JSON.stringify({ token: answer })}\n\n`);

        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
        await setMisunderstoodCount({ conversationId: convoId, siteId: site_id, misunderstoodCount: 0 });

        recordUsage(site.id).catch(() => {});

        processConversationForLead({
          conversationId: convoId,
          siteId: site_id,
          userMessage: text,
          intent,
        }).catch((err) => console.warn('[Chat/Stream] Lead pipeline failed (non-fatal):', err.message));

        notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent }).catch((err) => {
          console.warn('[Chat/Stream] Lead notification failed (non-fatal):', err.message);
        });

        res.write(
          `event: done\ndata: ${JSON.stringify({
            should_capture_lead: true,
            should_offer_booking: false,
            booking_url: null,
            booking_embed: false,
            booking_button_text: null,
          })}\n\n`
        );
        return res.end();
      }

      // ─── Consent handling (stream) ────────────────────────────────────────
      let consentState = await getConversationConsent(convoId);
      if (consentState.email_consent_status === 'pending' && consentState.email_consent_email) {
        const yn = parseYesNo(text);
        if (yn === 'yes') {
          await setConversationConsent(convoId, 'granted', consentState.email_consent_email);
          console.log(`[Consent] Email consent granted for ${consentState.email_consent_email} (conversation ${convoId})`);
          consentState = { email_consent_status: 'granted', email_consent_email: consentState.email_consent_email };
        } else if (yn === 'no') {
          await setConversationConsent(convoId, 'denied', consentState.email_consent_email);
          console.log(`[Consent] Email consent denied for ${consentState.email_consent_email} (conversation ${convoId})`);
          consentState = { email_consent_status: 'denied', email_consent_email: consentState.email_consent_email };
        }
      }

      const contactInMessage = detectContactInfo(text);
      const emailInMessage = contactInMessage?.emails?.[0] || null;
      let mustAskConsentNow = false;
      if (emailInMessage) {
        const isNewEmailForConversation = consentState.email_consent_email !== emailInMessage;
        const alreadyGrantedForThisEmail =
          consentState.email_consent_status === 'granted' && consentState.email_consent_email === emailInMessage;
        if (!alreadyGrantedForThisEmail || isNewEmailForConversation) {
          await setConversationConsent(convoId, 'pending', emailInMessage);
          console.log(`[Consent] New email provided in chat: ${emailInMessage} (conversation ${convoId}) → consent pending`);
          mustAskConsentNow = true;
        }
      }

      const emergencyKeywords = raffy?.emergency?.keywords || [];
      const emergencyResponse = raffy?.emergency?.response;
      const msgLower = String(text || '').toLowerCase();
      const lifeThreatening = isLifeThreateningEmergency({ message: text, raffy });

      const bookingUrl = raffy?.booking?.url ? String(raffy.booking.url) : '';
      const wantsBooking = detectBookingIntent(text, raffy);
      const shouldOfferBooking = Boolean(bookingUrl) && wantsBooking;
      const bookingEmbed = Boolean(raffy?.booking?.embed);
      const bookingButtonText = raffy?.booking?.button_text ? String(raffy.booking.button_text) : null;

      const escalationKeywords = raffy?.escalation_triggers?.keywords || [];
      const wantsHuman = Array.isArray(escalationKeywords) && escalationKeywords.some((k) => msgLower.includes(String(k).toLowerCase()));
      const intent = lifeThreatening ? 'emergency' : shouldOfferBooking ? 'booking' : wantsHuman ? 'escalation' : 'kb';

      // RAG: retrieve relevant chunks
      const contextChunks = await retrieveContext(site_id, text);
      console.log(`[Chat/Stream] Context chunks: ${contextChunks.length}`);

      // ─── Fallback handler (stream): second misunderstood turn ────────────
      // If we already had one misunderstood turn and we still find no KB context,
      // proactively offer escalation without calling the LLM.
      if (prevMisunderstoodCount >= 1 && contextChunks.length === 0 && intent === 'kb') {
        const answer = buildMisunderstoodFallbackMessage();
        await setMisunderstoodCount({ conversationId: convoId, siteId: site_id, misunderstoodCount: 2 });

        res.write(`event: meta\ndata: ${JSON.stringify({ conversation_id: convoId, intent: 'escalation', context_used: 0 })}\n\n`);
        res.write(`event: token\ndata: ${JSON.stringify({ token: answer })}\n\n`);
        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });

        recordUsage(site.id).catch(() => {});

        notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent: 'escalation' }).catch((err) => {
          console.warn('[Chat/Stream] Lead notification failed (non-fatal):', err.message);
        });

        res.write(
          `event: done\ndata: ${JSON.stringify({
            should_capture_lead: true,
            should_offer_booking: false,
            booking_url: null,
            booking_embed: false,
            booking_button_text: null,
          })}\n\n`
        );
        return res.end();
      }
      
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
      const emergency = emergencyResponse && lifeThreatening
        ? `\n\nCRITICAL EMERGENCY RULE: If the user mentions suicide, self-harm, or life-threatening crisis, respond with:\n"${emergencyResponse}"`
        : '';
      
      // Lead capture prompt - encourage asking for contact info when service interest detected
      const leadCapturePrompt = raffy?.lead_capture?.enabled
        ? `\n\nLEAD CAPTURE: When the user expresses interest in services (repair, inspection, quote, leak, damage, pricing), after answering their question, offer to have someone reach out. Ask for their email or phone number in a friendly, non-pushy way. Example: "${raffy?.lead_capture?.prompt || "Would you like someone from our team to reach out? I'd just need your email or phone number."}"`
        : '';

      const consentPrompt = emailInMessage
        ? `\n\nCONSENT (EMAIL): The user included an email address in their message. Do not promise you will email them without explicit permission. Ask a clear yes/no question first.`
        : '';

      const systemPrompt = `${identity}\n\n${basePrompt}${tone}${guardrails}${emergency}${sales}${leadCapturePrompt}${consentPrompt}${humor}`;
      
      console.log(`[Chat/Stream] SYSTEM PROMPT (first 200 chars):\n${systemPrompt.substring(0, 200)}...`);

      const textWithPage = current_page_url
        ? `[User is on page: ${current_page_url}]\n\n${text || ''}`
        : (text || '');
      const userContent = hasImage
        ? [
            { type: 'text', text: textWithPage || 'What do you see in this image?' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${(user_image_content_type && String(user_image_content_type).trim()) || 'image/jpeg'};base64,${String(user_image_base64).trim()}`,
              },
            },
          ]
        : textWithPage;

      // Load conversation history for context (exclude current user message)
      const recent = await getRecentMessages(convoId, 201);
      const conversationHistory = recent.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      console.log(`[Chat/Stream] Conversation history: ${conversationHistory.length} messages loaded, conversation has ${recent.length} total messages`);

      res.write(`event: meta\ndata: ${JSON.stringify({ conversation_id: convoId, intent, context_used: contextChunks.length })}\n\n`);

      if (emergencyResponse && lifeThreatening) {
        res.write(`event: token\ndata: ${JSON.stringify({ token: emergencyResponse })}\n\n`);
        await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: emergencyResponse });

        // Count usage for emergency response too
        recordUsage(site.id).catch(() => {});
        
        // Trigger lead notification for emergency (non-blocking)
        notifyOwnerOfLead({ conversationId: convoId, siteId: site_id, intent }).catch((err) => {
          console.warn('[Chat/Stream] Lead notification failed (non-fatal):', err.message);
        });

        res.write(`event: done\ndata: ${JSON.stringify({ should_capture_lead: wantsHuman, should_offer_booking: shouldOfferBooking, booking_url: shouldOfferBooking ? bookingUrl : null, booking_embed: bookingEmbed, booking_button_text: bookingButtonText })}\n\n`);
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
        let newMisunderstoodCount = nextMisunderstoodCount(prevMisunderstoodCount, { answer });
        await setMisunderstoodCount({
          conversationId: convoId,
          siteId: site_id,
          misunderstoodCount: newMisunderstoodCount,
        });

        if (newMisunderstoodCount >= 2) {
          const extra = `\n\n${buildMisunderstoodFallbackMessage()}`;
          answer += extra;
          res.write(`event: token\ndata: ${JSON.stringify({ token: extra })}\n\n`);
        }

        if (mustAskConsentNow && emailInMessage) {
          const consentLine = `\n\nBefore we reach out, is it okay if we email you at ${emailInMessage}? Reply YES or NO.`;
          if (!answer.toLowerCase().includes('reply yes or no') && !answer.toLowerCase().includes('is it okay if we email')) {
            answer += consentLine;
            res.write(`event: token\ndata: ${JSON.stringify({ token: consentLine })}\n\n`);
          }
        }

        const shouldCaptureLead = wantsHuman || detectLeadIntent(text) || detectLeadIntent(answer) || newMisunderstoodCount >= 2;
        const afterAssistant = await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });
        console.log(`[Chat/Stream] Assistant response saved to conversation ${convoId}. Total messages: ${afterAssistant.message_count}`);

        // Count 1 API request per completed streamed response
        recordUsage(site.id).catch(() => {});
        
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
          userMessage: text,
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

        res.write(`event: done\ndata: ${JSON.stringify({ should_capture_lead: shouldCaptureLead, should_offer_booking: shouldOfferBooking, booking_url: shouldOfferBooking ? bookingUrl : null, booking_embed: bookingEmbed, booking_button_text: bookingButtonText })}\n\n`);
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
