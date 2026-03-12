/**
 * Twilio Webhook Route
 * 
 * Handles inbound SMS and WhatsApp messages from Twilio.
 * Processes through ChattyBot AI pipeline and responds via TwiML.
 */

const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const twilio = require('twilio');
const pool = require('../config/database');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
const { getOrCreateConversation, appendMessage, getRecentMessages } = require('../services/conversationLog');
const { processConversationForLead } = require('../services/leadPipeline');
const { validateWebhookSignature, normalizePhoneE164 } = require('../services/twilioClient');
const { trackSmsUsage } = require('../middleware/usageTracking');
const { downloadTwilioMedia } = require('../services/twilioMedia');
const { analyzeImageWithClaude } = require('../services/claudeVision');
const { formatSMSResponse } = require('../utils/formatSMSResponse');
const OpenAI = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }
    
    const userPhone = normalizePhoneE164(From);
    const baseText = String(Body || '').trim();
    
    if (!userPhone || (!baseText && numMedia <= 0)) {
      console.error('[TwilioWebhook] Missing From or message content');
      const twiml = new MessagingResponse();
      twiml.message('Sorry, I could not process your message.');
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }
    
    // Resolve site by destination number (multi-tenant)
    const mappedSiteId = await resolveSiteIdFromTo(To, 'sms');
    const fallbackSiteId = process.env.TWILIO_DEFAULT_SITE_ID || null;
    const allowFallback = shouldAllowDefaultFallback();
    const siteId = mappedSiteId || (allowFallback ? fallbackSiteId : null);
    if (!siteId) {
      if (mappedSiteId) {
        console.error('[TwilioWebhook] Site resolution failed unexpectedly');
      } else if (!allowFallback) {
        console.warn('[TwilioWebhook] No site mapping found; default fallback disabled');
      } else {
        console.error('[TwilioWebhook] No site mapping and TWILIO_DEFAULT_SITE_ID not configured');
      }
      const twiml = new MessagingResponse();
      twiml.message('This number is not configured yet. Please contact the business directly.');
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }
    if (!mappedSiteId) {
      console.warn('[TwilioWebhook] No site mapping found; using TWILIO_DEFAULT_SITE_ID fallback');
    }
    console.log(`[TwilioWebhook] resolved site: ${siteId}`);
    
    trackSmsUsage(siteId, 'inbound').catch(() => {});

    // MMS photo support (first media item only)
    let mediaAnalysis = null;
    if (numMedia > 0 && MediaUrl0) {
      try {
        const { buffer, contentType } = await downloadTwilioMedia(MediaUrl0);
        const effectiveType = String(MediaContentType0 || contentType || '').toLowerCase();
        if (effectiveType.startsWith('image/')) {
          mediaAnalysis = await analyzeImageWithClaude({
            buffer,
            contentType: effectiveType,
            prompt:
              'Analyze the image for customer-support context. Extract any visible text and describe key details that would help answer the user.',
          });
        } else {
          console.warn('[TwilioWebhook] SMS media is not an image; skipping vision analysis');
        }
      } catch (e) {
        console.warn('[TwilioWebhook] SMS media download/analyze failed (non-fatal):', e.message);
      }
    }

    const composedUserMessage = baseText || (numMedia > 0 ? '[User sent an image]' : '');
    const userMessage = mediaAnalysis
      ? `${composedUserMessage}\n\n[Image analysis]\n${mediaAnalysis}`
      : composedUserMessage;
    
    // Generate AI response
    const aiRaw = await generateChatResponse({
      siteId,
      userMessage,
      visitorId: `sms:${userPhone}`,
      conversationId: null,
    });
    const aiResponse = formatSMSResponse(aiRaw);
    console.log('[TwilioWebhook] SMS response prepared (sid=%s, chars=%s)', MessageSid || 'n/a', aiResponse.length);
    
    trackSmsUsage(siteId, 'outbound').catch(() => {});
    
    // ALWAYS return TwiML
    const twiml = new MessagingResponse();
    twiml.message(aiResponse || 'Thanks for contacting us. How can we help?');

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  } catch (err) {
    console.error('[TwilioWebhook] Error processing SMS:', err.message, err.stack);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again.');
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }
});

/**
 * POST /webhooks/twilio/whatsapp
 * Inbound WhatsApp webhook
 */
router.post('/whatsapp', async (req, res) => {
  console.log('[TwilioWebhook] WhatsApp received:', req.body.Body);
  
  const { From, To, Body, MessageSid } = req.body;
  
  // Strip "whatsapp:" prefix if present
  const fromPhone = From?.replace('whatsapp:', '');
  const toPhone = To?.replace('whatsapp:', '');
  
  console.log(`[TwilioWebhook] From: ${fromPhone}, To: ${toPhone}, MessageSid: ${MessageSid}`);
  
  try {
    // Verify Twilio signature
    if (!validateTwilioRequest(req)) {
      console.warn('[TwilioWebhook] Invalid Twilio signature (whatsapp)');
      const twiml = new MessagingResponse();
      twiml.message('Invalid request.');
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }
    
    const userPhone = normalizePhoneE164(fromPhone);
    
    if (!Body || !userPhone) {
      console.error('[TwilioWebhook] Missing From or Body');
      const twiml = new MessagingResponse();
      twiml.message('Sorry, I could not process your message.');
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }
    
    // Resolve site by destination number (multi-tenant)
    const mappedSiteId = await resolveSiteIdFromTo(To, 'whatsapp');
    const fallbackSiteId = process.env.TWILIO_DEFAULT_SITE_ID || null;
    const allowFallback = shouldAllowDefaultFallback();
    const siteId = mappedSiteId || (allowFallback ? fallbackSiteId : null);
    if (!siteId) {
      if (mappedSiteId) {
        console.error('[TwilioWebhook] Site resolution failed unexpectedly');
      } else if (!allowFallback) {
        console.warn('[TwilioWebhook] No site mapping found; default fallback disabled');
      } else {
        console.error('[TwilioWebhook] No site mapping and TWILIO_DEFAULT_SITE_ID not configured');
      }
      const twiml = new MessagingResponse();
      twiml.message('This number is not configured yet. Please contact the business directly.');
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }
    if (!mappedSiteId) {
      console.warn('[TwilioWebhook] No site mapping found; using TWILIO_DEFAULT_SITE_ID fallback');
    }
    console.log(`[TwilioWebhook] resolved site: ${siteId}`);
    
    trackSmsUsage(siteId, 'inbound').catch(() => {});
    
    // Generate AI response
    const aiResponse = await generateChatResponse({
      siteId,
      userMessage: Body,
      visitorId: `whatsapp:${userPhone}`,
      conversationId: null,
    });
    
    console.log('[TwilioWebhook] Responding with:', aiResponse);
    
    trackSmsUsage(siteId, 'outbound').catch(() => {});
    
    // ALWAYS return TwiML
    const twiml = new MessagingResponse();
    twiml.message(aiResponse || 'Thanks for contacting us. How can we help?');
    
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  } catch (err) {
    console.error('[TwilioWebhook] Error processing WhatsApp:', err.message, err.stack);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again.');
    res.set('Content-Type', 'text/xml');
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

    // Get or create conversation
    const convoId = await getOrCreateConversation({
      siteId,
      visitorId,
      conversationId,
      currentPageUrl: null,
    });
    console.log(`[TwilioWebhook] conversation id: ${convoId}`);

    // Save user message
    await appendMessage({
      conversationId: convoId,
      siteId,
      role: 'user',
      content: userMessage,
    });

    // Retrieve RAG context
    const contextChunks = await retrieveContext(siteId, userMessage);
    console.log(`[TwilioWebhook] Context chunks retrieved: ${contextChunks.length}`);

    // Build system prompt
    const basePrompt = buildSystemPrompt(site, contextChunks);
    const identity = `You are ${raffy?.name || 'Assistant'}, the ${raffy?.role || 'AI assistant'} for ${site.company_name}.`;
    const tone = raffy?.tone ? `\n\nTone: ${raffy.tone}.` : '';
    const systemPrompt = `${identity}\n\n${basePrompt}${tone}`;

    // Load recent messages
    const recent = await getRecentMessages(convoId, 11); // Last 5 turns + current
    const conversationHistory = recent.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Generate response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300, // SMS/WhatsApp have length limits
      temperature: 0.3,
    });

    const answer = completion.choices[0].message.content;

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
