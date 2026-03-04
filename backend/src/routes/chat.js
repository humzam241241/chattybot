const express = require('express');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const pool = require('../config/database');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
const { getEffectiveRaffySettings } = require('../services/raffySettings');
const { getOrCreateConversation, appendMessage, getRecentMessages, updateConversationSummary } = require('../services/conversationLog');
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

router.post(
  '/',
  chatLimiter,
  domainVerify,
  [
    body('site_id').isUUID().withMessage('Valid site_id required'),
    body('user_message').isString().trim().isLength({ min: 1, max: 2000 }),
    body('conversation_id').optional().isUUID(),
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
      const settings = await getEffectiveRaffySettings(site_id);
      if (!settings) return res.status(404).json({ error: 'Site not found' });
      const { site, raffy } = settings;

      const convoId = await getOrCreateConversation({
        siteId: site_id,
        visitorId: visitor_id,
        conversationId: conversation_id,
        currentPageUrl: current_page_url,
      });

      await appendMessage({ conversationId: convoId, siteId: site_id, role: 'user', content: user_message });

      // Emergency handling (keyword-based MVP)
      const emergencyKeywords = raffy?.emergency?.keywords || [];
      const emergencyResponse = raffy?.emergency?.response;
      const msgLower = user_message.toLowerCase();
      const isEmergency = Array.isArray(emergencyKeywords) && emergencyKeywords.some((k) => msgLower.includes(String(k).toLowerCase()));

      // RAG: retrieve relevant chunks
      const contextChunks = await retrieveContext(site_id, user_message);

      const basePrompt = site.system_prompt || buildSystemPrompt(site, contextChunks);
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
      const identity = `You are ${raffy?.name || 'Raffy'}, the ${raffy?.role || 'AI assistant'} for ${site.company_name}.`;
      const emergency = emergencyResponse
        ? `\n\nEmergency rule: If the user describes an emergency, respond with:\n"${emergencyResponse}"`
        : '';

      const systemPrompt = `${identity}\n\n${basePrompt}${tone}${guardrails}${emergency}${sales}${humor}`;

      // Build messages array; optionally hint on the current page for context
      const userContent = current_page_url
        ? `[User is on page: ${current_page_url}]\n\n${user_message}`
        : user_message;

      let answer = emergencyResponse && isEmergency
        ? emergencyResponse
        : null;

      if (!answer) {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Fast, cheap, good enough for RAG answers
          messages: [
            { role: 'system', content: systemPrompt },
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

      const afterAssistant = await appendMessage({ conversationId: convoId, siteId: site_id, role: 'assistant', content: answer });

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

      return res.json({
        answer,
        should_capture_lead: shouldCaptureLead,
        context_used: contextChunks.length,
        conversation_id: convoId,
      });
    } catch (err) {
      console.error('Chat error:', err);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  }
);

module.exports = router;
