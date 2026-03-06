/**
 * Lead Detector Service
 * 
 * Detects contact information (email, phone) in conversation messages
 * using regex patterns. Triggers lead extraction when contact info is found.
 */

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /\b(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

/**
 * Detect contact information in a message
 * @param {string} message - Message content to scan
 * @returns {Object} { hasContact, emails, phones }
 */
function detectContactInfo(message) {
  if (!message || typeof message !== 'string') {
    return { hasContact: false, emails: [], phones: [] };
  }

  const emails = message.match(EMAIL_REGEX) || [];
  const phones = message.match(PHONE_REGEX) || [];

  if (emails.length > 0) {
    console.log(`[LeadDetector] Email detected: ${emails.join(', ')}`);
  }
  if (phones.length > 0) {
    console.log(`[LeadDetector] Phone detected: ${phones.join(', ')}`);
  }

  return {
    hasContact: emails.length > 0 || phones.length > 0,
    emails: [...new Set(emails.map(e => e.toLowerCase()))],
    phones: [...new Set(phones)],
  };
}

/**
 * Scan all messages in a conversation for contact info
 * @param {Array<{role: string, content: string}>} messages 
 * @returns {Object} { hasContact, emails, phones }
 */
function scanConversationForContact(messages) {
  const allEmails = [];
  const allPhones = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const { emails, phones } = detectContactInfo(msg.content);
      allEmails.push(...emails);
      allPhones.push(...phones);
    }
  }

  const uniqueEmails = [...new Set(allEmails)];
  const uniquePhones = [...new Set(allPhones)];
  const hasContact = uniqueEmails.length > 0 || uniquePhones.length > 0;

  if (hasContact) {
    console.log(`[LeadDetector] Conversation scan complete - Emails: ${uniqueEmails.length}, Phones: ${uniquePhones.length}`);
  }

  return {
    hasContact,
    emails: uniqueEmails,
    phones: uniquePhones,
  };
}

/**
 * Detect lead capture intent keywords
 * @param {string} message 
 * @returns {boolean}
 */
function detectLeadIntent(message) {
  if (!message) return false;
  
  const lower = message.toLowerCase();
  const intentKeywords = [
    'contact me', 'reach out', 'call me', 'email me', 'text me',
    'get in touch', 'speak to someone', 'talk to', 'my number is',
    'my email is', 'you can reach me', 'call back', 'phone number',
  ];
  
  return intentKeywords.some(kw => lower.includes(kw));
}

/**
 * Detect service-related keywords that indicate a lead
 * @param {string} message 
 * @returns {boolean}
 */
function detectServiceIntent(message) {
  if (!message) return false;
  
  const lower = message.toLowerCase();
  const serviceKeywords = [
    'roof', 'leak', 'repair', 'inspection', 'quote', 'estimate',
    'price', 'cost', 'storm', 'damage', 'replace', 'install',
    'emergency', 'urgent', 'asap', 'today', 'appointment', 'schedule',
  ];
  
  return serviceKeywords.some(kw => lower.includes(kw));
}

module.exports = {
  detectContactInfo,
  scanConversationForContact,
  detectLeadIntent,
  detectServiceIntent,
  EMAIL_REGEX,
  PHONE_REGEX,
};
