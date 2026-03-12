/**
 * Twilio Webhook Route
 * 
 * Handles inbound SMS and WhatsApp messages from Twilio.
 * Processes through ChattyBot AI pipeline and responds via TwiML.
 */

const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
const { appendMessage, getRecentMessages } = require('../services/conversationLog');
const { processConversationForLead } = require('../services/leadPipeline');
const { normalizePhoneE164 } = require('../utils/phone');
const { trackSmsUsage } = require('../middleware/usageTracking');
const { buildRoofAssessmentFromTwilioMedia, getVisionFallbackMessage } = require('../services/mediaVisionService');
const { formatSMSResponse } = require('../utils/formatSMSResponse');
const OpenAI = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeTwilioAddress(raw, { channel }) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const withoutPrefix = s.replace(/^whatsapp:/i, '');
  const e164 = normalizePhoneE164(withoutPrefix);
  if (!e164) return null;
  return channel === 'whatsapp' ? `whatsapp:${e164}` : e164;
}

// IMPORTANT: Do not send outbound Twilio messages from async post-processing.
// Replies to inbound messages must be returned ONLY via this webhook's TwiML response.

async function findOrCreateConversationIdForTwilio({ siteId, from }) {
  if (!siteId || !from) return null;

  // 1) Preferred lookup: site_id + visitor_id (visitor_id = Twilio "From" exactly)
  const existing = await pool.query(
    `SELECT id
     FROM conversations
     WHERE site_id = $1
       AND visitor_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [siteId, from]
  );
  const existingId = existing.rows?.[0]?.id || null;
  if (existingId) return existingId;

  // 2) Back-compat: reuse older Twilio conversations created before visitor_id was persisted
  const userPhone = String(from).replace(/^whatsapp:/, '');
  const legacy = await pool.query(
    `SELECT id
     FROM conversations
     WHERE site_id = $1
       AND user_phone = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [siteId, userPhone]
  );
  const legacyId = legacy.rows?.[0]?.id || null;
  if (legacyId) {
    await pool.query(
      `UPDATE conversations
       SET visitor_id = COALESCE(visitor_id, $2)
       WHERE id = $1`,
      [legacyId, from]
    );
    return legacyId;
  }

  // 3) Create new conversation only if none exists
  const id = uuidv4();
  await pool.query(
    `INSERT INTO conversations (id, site_id, visitor_id, user_phone)
     VALUES ($1, $2, $3, $4)`,
    [id, siteId, from, userPhone]
  );
  return id;
}

// Expose conversation creation here so no other module inserts into conversations.
router.findOrCreateConversationIdForTwilio = findOrCreateConversationIdForTwilio;

function getFullUrl(req) {
  // trust proxy is enabled in app.js so req.protocol should reflect X-Forwarded-Proto
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

function validateTwilioRequest(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  const url = getFullUrl(req);

  if (!authToken) {
    console.warn('[TwilioWebhook] TWILIO_AUTH_TOKEN not set; skipping signature validation');
    return true;
  }
  if (!signature) return false;

  try {
    return twilio.validateRequest(authToken, signature, url, req.body);
  } catch (e) {
    console.error('[TwilioWebhook] Signature validation error:', e.message);
    return false;
  }
}

function normalizeTwilioTo(to) {
  const raw = String(to || '').trim();
  if (!raw) return null;
  // Twilio WhatsApp uses "whatsapp:+E164"
  const withoutPrefix = raw.replace(/^whatsapp:/i, '');
  return normalizePhoneE164(withoutPrefix);
}

async function handleVisionMediaMessage({
  siteId,
  conversationId,
  requestId,
  baseText,
  mediaUrl,
  mediaContentType,
  channelLabel,
}) {
  console.log('[Vision] Media received', {
    requestId,
    conversationId,
    siteId,
    channel: channelLabel,
  });

  let responseText = null;
  try {
    responseText = await buildRoofAssessmentFromTwilioMedia({
      mediaUrl,
      mediaContentType,
      requestId,
      conversationId,
      siteId,
      channel: channelLabel,
    });
    console.log('[Vision] Response sent', {
      requestId,
      conversationId,
      siteId,
      channel: channelLabel,
    });
  } catch (e) {
    console.error('[Vision] Failure', {
      requestId,
      conversationId,
      siteId,
      channel: channelLabel,
      error: e?.message || String(e),
    });
    responseText = getVisionFallbackMessage();
  }

  const userMsg = String(baseText || '').trim() || '[User sent a roof photo]';
  await appendMessage({ conversationId, siteId, role: 'user', content: userMsg });
  await appendMessage({ conversationId, siteId, role: 'assistant', content: responseText });

  return responseText;
}

async function resolveSiteIdFromTo(toNumberRaw) {
  try {
    const channel = arguments.length > 1 ? arguments[1] : 'sms';

    // Extract destination number (strip whatsapp: prefix if present)
    const number = String(toNumberRaw || '').replace(/^whatsapp:/i, '').trim();
    const toE164 = normalizePhoneE164(number);
    if (!toE164) return null;

    // NEW: route via phone_numbers table (supports multiple numbers per site)
    const mapping = await pool.query(
      `SELECT site_id
       FROM phone_numbers
       WHERE phone_number = $1
         AND channel = $2
       LIMIT 1`,
      [toE164, channel]
    );
    const mappedSiteId = mapping.rows?.[0]?.site_id || null;
    if (mappedSiteId) {
      console.log('[TwilioWebhook] Routed number', toE164, 'to site', mappedSiteId);
      return mappedSiteId;
    }

    console.warn('[TwilioWebhook] No phone mapping found:', toE164);

    // Backward compatibility: fall back to legacy sites.twilio_* columns
    const legacy = await pool.query(
      `SELECT id
       FROM sites
       WHERE ($2::text = 'whatsapp' AND twilio_whatsapp = $1)
          OR ($2::text <> 'whatsapp' AND twilio_phone = $1)
       LIMIT 1`,
      [toE164, channel]
    );
    return legacy.rows?.[0]?.id || null;
  } catch (e) {
    console.warn('[TwilioWebhook] Site lookup failed (non-fatal):', e.message);
    return null;
  }
}

function shouldAllowDefaultFallback() {
  // Safety: in production, do NOT fall back to a default site unless explicitly allowed.
  // This prevents replying as the wrong client when a Twilio number isn't mapped yet.
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    return String(process.env.ALLOW_TWILIO_DEFAULT_FALLBACK || '').toLowerCase() === 'true';
  }
  // In non-prod, allow fallback to ease local/dev testing.
  return true;
}

/**
 * POST /webhooks/twilio/sms
 * Inbound SMS webhook
 */
router.post('/sms', async (req, res) => {
  const { From, To, Body, MessageSid, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
  const numMedia = Number(NumMedia || 0) || 0;
  console.log(`[TwilioWebhook] SMS received (sid=${MessageSid || 'n/a'}, media=${numMedia})`);
  
  try {
    // Verify Twilio signature
    if (!validateTwilioRequest(req)) {
      console.warn('[TwilioWebhook] Invalid Twilio signature (sms)');
      const twiml = new MessagingResponse();
      twiml.message('Invalid request.');
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }
    
    const userPhone = normalizePhoneE164(From);
    const baseText = String(Body || '').trim();
    
    if (!userPhone || (!baseText && numMedia <= 0)) {
      console.error('[TwilioWebhook] Missing From or message content');
      const twiml = new MessagingResponse();
      twiml.message('Sorry, I could not process your message.');
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }

    // Resolve site by destination number (multi-tenant)
    const mappedSiteId = await resolveSiteIdFromTo(To, 'sms');
    const fallbackSiteId = process.env.TWILIO_DEFAULT_SITE_ID || null;
    const allowFallback = shouldAllowDefaultFallback();
    const siteId = mappedSiteId || (allowFallback ? fallbackSiteId : null);

    if (!siteId) {
      const twiml = new MessagingResponse();
      twiml.message('This number is not configured yet. Please contact the business directly.');
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }

    trackSmsUsage(siteId, 'inbound').catch(() => {});

    const from = req.body.From; // e.g. "whatsapp:+19057496855"
    console.log('[Twilio] visitor:', from);
    const conversationId = await findOrCreateConversationIdForTwilio({ siteId, from });
    console.log('[Twilio] using conversation:', conversationId);

    // Media messages bypass RAG pipeline; return a formatted vision response + persist like normal chat.
    if (numMedia > 0 && MediaUrl0) {
      const responseText = await handleVisionMediaMessage({
        siteId,
        conversationId,
        requestId: MessageSid || null,
        baseText,
        mediaUrl: MediaUrl0,
        mediaContentType: MediaContentType0,
        channelLabel: 'sms',
      });

      trackSmsUsage(siteId, 'outbound').catch(() => {});

      const twiml = new MessagingResponse();
      twiml.message(responseText);
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }

    const userMessage = baseText;
    const aiRaw = await generateChatResponse({
      siteId,
      userMessage,
      visitorId: `sms:${userPhone}`,
      conversationId,
    });
    const aiResponse = formatSMSResponse(aiRaw);
    console.log('[TwilioWebhook] SMS response prepared (sid=%s, chars=%s)', MessageSid || 'n/a', aiResponse.length);

    trackSmsUsage(siteId, 'outbound').catch(() => {});

    const twiml = new MessagingResponse();
    twiml.message(aiResponse || 'Thanks for contacting us. How can we help?');
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  } catch (err) {
    console.error('[TwilioWebhook] Error processing SMS:', err.message, err.stack);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again.');
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  }
});

/**
 * POST /webhooks/twilio/whatsapp
 * Inbound WhatsApp webhook
 */
router.post('/whatsapp', async (req, res) => {
  console.log('[TwilioWebhook] WhatsApp received:', req.body.Body);
  
  const { From, To, Body, MessageSid, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
  const numMedia = Number(NumMedia || 0) || 0;
  
  // Strip "whatsapp:" prefix if present
  const fromPhone = From?.replace('whatsapp:', '');
  const toPhone = To?.replace('whatsapp:', '');
  
  console.log(`[TwilioWebhook] From: ${fromPhone}, To: ${toPhone}, MessageSid: ${MessageSid}, media=${numMedia}`);
  
  try {
    // Verify Twilio signature
    if (!validateTwilioRequest(req)) {
      console.warn('[TwilioWebhook] Invalid Twilio signature (whatsapp)');
      const twiml = new MessagingResponse();
      twiml.message('Invalid request.');
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }
    
    const userPhone = normalizePhoneE164(fromPhone);
    
    const baseText = String(Body || '').trim();

    if ((!baseText && numMedia <= 0) || !userPhone) {
      console.error('[TwilioWebhook] Missing From or Body');
      const twiml = new MessagingResponse();
      twiml.message('Sorry, I could not process your message.');
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }

    // Resolve site by destination number (multi-tenant)
    const mappedSiteId = await resolveSiteIdFromTo(To, 'whatsapp');
    const fallbackSiteId = process.env.TWILIO_DEFAULT_SITE_ID || null;
    const allowFallback = shouldAllowDefaultFallback();
    const siteId = mappedSiteId || (allowFallback ? fallbackSiteId : null);

    if (!siteId) {
      const twiml = new MessagingResponse();
      twiml.message('This number is not configured yet. Please contact the business directly.');
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }

    trackSmsUsage(siteId, 'inbound').catch(() => {});

    const from = req.body.From; // e.g. "whatsapp:+19057496855"
    console.log('[Twilio] visitor:', from);
    const conversationId = await findOrCreateConversationIdForTwilio({ siteId, from });
    console.log('[Twilio] using conversation:', conversationId);

    // Vision pipeline (WhatsApp media): short roof assessment + disclaimer + booking link
    if (numMedia > 0 && MediaUrl0) {
      const responseText = await handleVisionMediaMessage({
        siteId,
        conversationId,
        requestId: MessageSid || null,
        baseText,
        mediaUrl: MediaUrl0,
        mediaContentType: MediaContentType0,
        channelLabel: 'whatsapp',
      });

      trackSmsUsage(siteId, 'outbound').catch(() => {});

      const twiml = new MessagingResponse();
      twiml.message(responseText);
      res.type('text/xml');
      return res.status(200).send(twiml.toString());
    }

    const aiResponse = await generateChatResponse({
      siteId,
      userMessage: baseText,
      visitorId: `whatsapp:${userPhone}`,
      conversationId,
    });

    console.log('[TwilioWebhook] Responding with:', aiResponse);

    trackSmsUsage(siteId, 'outbound').catch(() => {});

    const twiml = new MessagingResponse();
    twiml.message(aiResponse || 'Thanks for contacting us. How can we help?');
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  } catch (err) {
    console.error('[TwilioWebhook] Error processing WhatsApp:', err.message, err.stack);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again.');
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  }
});

/**
 * Generate AI chat response
 * @param {Object} params
 * @param {string} params.siteId
 * @param {string} params.userMessage
 * @param {string} params.visitorId
 * @param {string|null} params.conversationId
 * @returns {Promise<string>}
 */
async function generateChatResponse({ siteId, userMessage, visitorId, conversationId }) {
  try {
    // Get site settings
    const settings = await getEffectiveRaffySettings(siteId);
    if (!settings) {
      console.error(`[TwilioWebhook] Site ${siteId} not found`);
      return 'Service unavailable.';
    }

    const { site, raffy } = settings;

    // IMPORTANT: Twilio webhook must pass conversationId; do not create here.
    if (!conversationId) {
      throw new Error('Missing conversationId (Twilio webhook must create/reuse conversation)');
    }
    const convoId = conversationId;
    console.log(`[TwilioWebhook] conversation id: ${convoId}`);

    // Verify conversation belongs to this site (safety)
    const exists = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND site_id = $2 LIMIT 1',
      [convoId, siteId]
    );
    if (!exists.rows.length) {
      throw new Error('Conversation not found for site');
    }

    console.log('[Chat] conversation:', convoId);

    const history = await pool.query(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [convoId]
    );
    console.log('[Chat] history length:', history.rows.length);

    // Retrieve RAG context
    const contextChunks = await retrieveContext(siteId, userMessage);
    console.log(`[TwilioWebhook] Context chunks retrieved: ${contextChunks.length}`);

    // Build system prompt
    const basePrompt = buildSystemPrompt(site, contextChunks);
    const identity = `You are ${raffy?.name || 'Assistant'}, the ${raffy?.role || 'AI assistant'} for ${site.company_name}.`;
    const tone = raffy?.tone ? `\n\nTone: ${raffy.tone}.` : '';
    const systemPrompt = `${identity}\n\n${basePrompt}${tone}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.rows.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300, // SMS/WhatsApp have length limits
      temperature: 0.3,
    });

    const answer = completion.choices[0].message.content;

    // Save user message
    await appendMessage({
      conversationId: convoId,
      siteId,
      role: 'user',
      content: userMessage,
    });

    // Save assistant response
    await appendMessage({
      conversationId: convoId,
      siteId,
      role: 'assistant',
      content: answer,
    });

    // Trigger lead pipeline (non-blocking)
    processConversationForLead({
      conversationId: convoId,
      siteId,
      userMessage,
      intent: 'kb',
    }).catch((err) => {
      console.warn('[TwilioWebhook] Lead pipeline failed (non-fatal):', err.message);
    });

    return answer;
  } catch (err) {
    console.error('[TwilioWebhook] Error generating chat response:', err.message);
    return 'Sorry, I encountered an error. Please try again later.';
  }
}

module.exports = router;
