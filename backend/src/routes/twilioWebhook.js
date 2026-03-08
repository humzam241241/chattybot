/**
 * Twilio Webhook Route
 * 
 * Handles inbound SMS and WhatsApp messages from Twilio.
 * Processes through ChattyBot AI pipeline and responds via TwiML.
 */

const express = require('express');
const twilio = require('twilio');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
const { getOrCreateConversation, appendMessage, getRecentMessages } = require('../services/conversationLog');
const { processConversationForLead } = require('../services/leadPipeline');
const { validateWebhookSignature, normalizePhoneE164 } = require('../services/twilioClient');
const { trackSmsUsage } = require('../middleware/usageTracking');
const OpenAI = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * POST /webhooks/twilio/sms
 * Inbound SMS webhook
 */
router.post('/twilio/sms', async (req, res) => {
  console.log('[TwilioWebhook] Incoming SMS message');
  
  const { From, To, Body, MessageSid } = req.body;
  
  console.log(`[TwilioWebhook] From: ${From}, Body: ${Body?.substring(0, 50)}...`);
  
  try {
    // TODO: Add webhook signature validation if needed
    // const signature = req.headers['x-twilio-signature'];
    // const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    // if (!validateWebhookSignature(signature, url, req.body)) {
    //   console.error('[TwilioWebhook] Invalid signature');
    //   return res.status(403).send('Forbidden');
    // }
    
    const userPhone = normalizePhoneE164(From);
    const botPhone = normalizePhoneE164(To);
    
    if (!Body || !userPhone) {
      console.error('[TwilioWebhook] Missing From or Body');
      const twiml = new MessagingResponse();
      twiml.message('Sorry, I could not process your message.');
      return res.type('text/xml').send(twiml.toString());
    }
    
    // Get default site (you may want to map phone numbers to sites)
    const defaultSiteId = process.env.TWILIO_DEFAULT_SITE_ID;
    if (!defaultSiteId) {
      console.error('[TwilioWebhook] TWILIO_DEFAULT_SITE_ID not configured');
      const twiml = new MessagingResponse();
      twiml.message('Service unavailable.');
      return res.type('text/xml').send(twiml.toString());
    }
    
    trackSmsUsage(defaultSiteId, 'inbound').catch(() => {});
    
    // Generate AI response
    const aiResponse = await generateChatResponse({
      siteId: defaultSiteId,
      userMessage: Body,
      visitorId: `sms:${userPhone}`,
      conversationId: null,
    });
    
    trackSmsUsage(defaultSiteId, 'outbound').catch(() => {});
    
    // Respond via TwiML
    const twiml = new MessagingResponse();
    twiml.message(aiResponse);
    
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('[TwilioWebhook] Error processing SMS:', err.message);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again.');
    res.type('text/xml').send(twiml.toString());
  }
});

/**
 * POST /webhooks/twilio/whatsapp
 * Inbound WhatsApp webhook
 */
router.post('/twilio/whatsapp', async (req, res) => {
  console.log('[TwilioWebhook] Incoming WhatsApp message');
  
  const { From, To, Body, MessageSid } = req.body;
  
  // Strip "whatsapp:" prefix if present
  const fromPhone = From?.replace('whatsapp:', '');
  const toPhone = To?.replace('whatsapp:', '');
  
  console.log(`[TwilioWebhook] From: ${fromPhone}, Body: ${Body?.substring(0, 50)}...`);
  
  try {
    // TODO: Add webhook signature validation if needed
    // const signature = req.headers['x-twilio-signature'];
    // const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    // if (!validateWebhookSignature(signature, url, req.body)) {
    //   console.error('[TwilioWebhook] Invalid signature');
    //   return res.status(403).send('Forbidden');
    // }
    
    const userPhone = normalizePhoneE164(fromPhone);
    
    if (!Body || !userPhone) {
      console.error('[TwilioWebhook] Missing From or Body');
      const twiml = new MessagingResponse();
      twiml.message('Sorry, I could not process your message.');
      return res.type('text/xml').send(twiml.toString());
    }
    
    // Get default site (you may want to map phone numbers to sites)
    const defaultSiteId = process.env.TWILIO_DEFAULT_SITE_ID;
    if (!defaultSiteId) {
      console.error('[TwilioWebhook] TWILIO_DEFAULT_SITE_ID not configured');
      const twiml = new MessagingResponse();
      twiml.message('Service unavailable.');
      return res.type('text/xml').send(twiml.toString());
    }
    
    trackSmsUsage(defaultSiteId, 'inbound').catch(() => {});
    
    // Generate AI response
    const aiResponse = await generateChatResponse({
      siteId: defaultSiteId,
      userMessage: Body,
      visitorId: `whatsapp:${userPhone}`,
      conversationId: null,
    });
    
    trackSmsUsage(defaultSiteId, 'outbound').catch(() => {});
    
    // Respond via TwiML
    const twiml = new MessagingResponse();
    twiml.message(aiResponse);
    
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('[TwilioWebhook] Error processing WhatsApp:', err.message);
    const twiml = new MessagingResponse();
    twiml.message('Sorry, something went wrong. Please try again.');
    res.type('text/xml').send(twiml.toString());
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
