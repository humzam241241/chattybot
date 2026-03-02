const express = require('express');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const pool = require('../config/database');
const { retrieveContext, buildSystemPrompt } = require('../services/rag');
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
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, user_message, current_page_url } = req.body;

    try {
      // Fetch site config — also validates it exists
      const siteResult = await pool.query(
        'SELECT id, company_name, tone, system_prompt FROM sites WHERE id = $1',
        [site_id]
      );

      if (siteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Site not found' });
      }

      const site = siteResult.rows[0];

      // RAG: retrieve relevant chunks
      const contextChunks = await retrieveContext(site_id, user_message);
      const systemPrompt = buildSystemPrompt(site, contextChunks);

      // Build messages array; optionally hint on the current page for context
      const userContent = current_page_url
        ? `[User is on page: ${current_page_url}]\n\n${user_message}`
        : user_message;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast, cheap, good enough for RAG answers
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 500,
        temperature: 0.3, // Low temp = more factual, less hallucination
      });

      const answer = completion.choices[0].message.content;
      const shouldCaptureLead = detectLeadIntent(user_message) || detectLeadIntent(answer);

      return res.json({
        answer,
        should_capture_lead: shouldCaptureLead,
        context_used: contextChunks.length,
      });
    } catch (err) {
      console.error('Chat error:', err);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  }
);

module.exports = router;
