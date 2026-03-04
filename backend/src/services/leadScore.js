/**
 * Lead scoring service - rule-based lead quality assessment
 * 
 * Scores leads based on intent and conversation keywords to prioritize
 * high-value leads for immediate follow-up.
 */

/**
 * Score a lead based on intent and conversation messages
 * @param {Object} params
 * @param {string} params.intent - Detected intent (booking|emergency|escalation|kb|quote)
 * @param {Array<{role: string, content: string}>} params.messages - Conversation messages
 * @returns {Object} { score: number, rating: 'HOT'|'WARM'|'COLD' }
 */
function scoreLead({ intent, messages }) {
  let score = 0;

  // Intent-based scoring
  if (intent === 'booking') score += 40;
  if (intent === 'quote') score += 30;
  if (intent === 'emergency') score += 50;
  if (intent === 'escalation') score += 25;

  // Scan all messages for value indicators
  const allText = (messages || [])
    .map((m) => String(m.content || '').toLowerCase())
    .join(' ');

  // Pricing signals
  if (/\b(price|cost|pricing|quote|estimate|budget)\b/.test(allText)) {
    score += 10;
  }

  // Urgency signals
  if (/\b(today|urgent|asap|immediately|now|right away)\b/.test(allText)) {
    score += 15;
  }

  // Service-specific signals (inspection is a strong buying signal)
  if (/\b(inspection|inspect|evaluate|assessment|check)\b/.test(allText)) {
    score += 15;
  }

  // Additional buying signals
  if (/\b(schedule|appointment|book|reserve|confirm)\b/.test(allText)) {
    score += 10;
  }

  // Return rating classification
  let rating = 'COLD';
  if (score > 60) rating = 'HOT';
  else if (score > 30) rating = 'WARM';

  return { score, rating };
}

module.exports = { scoreLead };
