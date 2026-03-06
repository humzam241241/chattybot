/**
 * Lead Scoring Service
 * 
 * Rule-based lead quality assessment. Scores leads based on:
 * - Intent signals (booking, emergency, escalation)
 * - Contact info provided (email, phone)
 * - Issue keywords (leak, storm, repair)
 * - Urgency signals (today, ASAP, emergency)
 */

/**
 * Score a lead based on extracted data and conversation context
 * @param {Object} params
 * @param {string} [params.intent] - Detected intent
 * @param {Array<{role: string, content: string}>} [params.messages] - Conversation messages
 * @param {Object} [params.extracted] - Extracted lead data from leadExtractor
 * @returns {Object} { score: number, rating: 'HOT'|'WARM'|'COLD', factors: string[] }
 */
function scoreLead({ intent, messages, extracted }) {
  let score = 0;
  const factors = [];

  // ─── Intent-based scoring ───────────────────────────────────────────
  if (intent === 'booking') {
    score += 40;
    factors.push('booking_intent');
  }
  if (intent === 'quote') {
    score += 30;
    factors.push('quote_intent');
  }
  if (intent === 'emergency') {
    score += 50;
    factors.push('emergency_intent');
  }
  if (intent === 'escalation') {
    score += 25;
    factors.push('escalation_intent');
  }

  // ─── Contact info scoring ───────────────────────────────────────────
  if (extracted?.email) {
    score += 20;
    factors.push('has_email');
  }
  if (extracted?.phone) {
    score += 30;
    factors.push('has_phone');
  }

  // ─── Urgency scoring (from extraction) ──────────────────────────────
  if (extracted?.urgency === 'today') {
    score += 30;
    factors.push('urgency_today');
  } else if (extracted?.urgency === 'this_week') {
    score += 15;
    factors.push('urgency_this_week');
  } else if (extracted?.urgency === 'soon') {
    score += 10;
    factors.push('urgency_soon');
  }

  // ─── Issue-based scoring ────────────────────────────────────────────
  const issue = String(extracted?.issue || '').toLowerCase();
  
  if (/\b(leak|leaking|water damage)\b/.test(issue)) {
    score += 50;
    factors.push('issue_leak');
  }
  if (/\b(storm|hail|wind|hurricane|tornado)\b/.test(issue)) {
    score += 40;
    factors.push('issue_storm');
  }
  if (/\b(repair|fix|broken|damaged)\b/.test(issue)) {
    score += 20;
    factors.push('issue_repair');
  }
  if (/\b(replace|replacement|new roof|install)\b/.test(issue)) {
    score += 25;
    factors.push('issue_replacement');
  }
  if (/\b(inspection|inspect|evaluate|assess)\b/.test(issue)) {
    score += 15;
    factors.push('issue_inspection');
  }

  // ─── Message content scoring (fallback) ─────────────────────────────
  const allText = (messages || [])
    .map((m) => String(m.content || '').toLowerCase())
    .join(' ');

  // Pricing signals (only if not already scored via intent)
  if (!factors.includes('quote_intent') && /\b(price|cost|pricing|quote|estimate|budget)\b/.test(allText)) {
    score += 10;
    factors.push('pricing_mention');
  }

  // Urgency signals from messages (only if not from extraction)
  if (!factors.some(f => f.startsWith('urgency_')) && /\b(today|urgent|asap|immediately|now|right away)\b/.test(allText)) {
    score += 15;
    factors.push('urgency_keywords');
  }

  // Service/inspection signals from messages (only if not from extraction)
  if (!factors.includes('issue_inspection') && /\b(inspection|inspect|evaluate|assessment|check)\b/.test(allText)) {
    score += 15;
    factors.push('inspection_mention');
  }

  // Booking signals
  if (!factors.includes('booking_intent') && /\b(schedule|appointment|book|reserve|confirm)\b/.test(allText)) {
    score += 10;
    factors.push('booking_mention');
  }

  // ─── Calculate rating ───────────────────────────────────────────────
  let rating = 'COLD';
  if (score >= 80) rating = 'HOT';
  else if (score >= 40) rating = 'WARM';

  console.log(`[LeadScorer] Score: ${score}, Rating: ${rating}, Factors: ${factors.join(', ')}`);

  return { score, rating, factors };
}

module.exports = { scoreLead };
