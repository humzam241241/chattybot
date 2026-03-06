/**
 * Lead Extractor Service
 * 
 * Uses OpenAI to extract structured lead information from conversation transcripts.
 * Extracts: name, email, phone, issue, location, urgency
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_PROMPT = `You are a lead extraction assistant. Analyze the conversation and extract any lead information the customer has shared.

Return a JSON object with these fields (use null if not found):
{
  "name": "Customer's name if mentioned",
  "email": "Email address if provided",
  "phone": "Phone number if provided",
  "issue": "Brief description of their problem/need (max 100 chars)",
  "location": "City, address, or area if mentioned",
  "urgency": "today|this_week|soon|not_urgent based on their timeline"
}

IMPORTANT:
- Only extract information explicitly stated by the customer (USER messages)
- Do not infer or guess information
- Phone numbers can be in various formats: (555) 123-4567, 555-123-4567, 5551234567
- For urgency, look for words like: today, tomorrow, urgent, ASAP, emergency, this week, soon
- Return ONLY valid JSON, no markdown or explanation`;

/**
 * Extract lead information from conversation messages
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @returns {Promise<Object>} Extracted lead data
 */
async function extractLeadFromConversation(messages) {
  if (!messages || messages.length === 0) {
    console.log('[LeadExtractor] No messages to extract from');
    return null;
  }

  const transcript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  try {
    console.log('[LeadExtractor] Extracting lead info from conversation...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `Conversation:\n\n${transcript}` },
      ],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    let extracted;
    try {
      extracted = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[LeadExtractor] Failed to parse JSON response:', responseText);
      return null;
    }

    // Normalize and validate extracted data
    const normalized = {
      name: extracted.name || null,
      email: normalizeEmail(extracted.email),
      phone: normalizePhone(extracted.phone),
      issue: extracted.issue ? String(extracted.issue).substring(0, 200) : null,
      location: extracted.location || null,
      urgency: normalizeUrgency(extracted.urgency),
    };

    // Check if we actually extracted anything useful
    const hasData = normalized.email || normalized.phone || normalized.name;
    
    if (hasData) {
      console.log(`[LeadExtractor] Extracted: email=${normalized.email}, phone=${normalized.phone}, name=${normalized.name}`);
    } else {
      console.log('[LeadExtractor] No contact info extracted');
    }

    return normalized;
  } catch (err) {
    console.error('[LeadExtractor] Extraction failed:', err.message);
    return null;
  }
}

/**
 * Normalize email address
 * @param {string|null} email 
 * @returns {string|null}
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Normalize phone number (strip non-digits, keep country code)
 * @param {string|null} phone 
 * @returns {string|null}
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits.substring(0, 11);
}

/**
 * Normalize urgency level
 * @param {string|null} urgency 
 * @returns {string}
 */
function normalizeUrgency(urgency) {
  if (!urgency) return 'not_urgent';
  const lower = String(urgency).toLowerCase();
  if (lower.includes('today') || lower.includes('immediate') || lower.includes('emergency') || lower.includes('asap')) {
    return 'today';
  }
  if (lower.includes('week') || lower.includes('soon')) {
    return 'this_week';
  }
  if (lower.includes('not') || lower.includes('later')) {
    return 'not_urgent';
  }
  return 'soon';
}

module.exports = {
  extractLeadFromConversation,
  normalizeEmail,
  normalizePhone,
  normalizeUrgency,
};
