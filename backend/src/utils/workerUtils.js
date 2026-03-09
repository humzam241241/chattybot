/**
 * Shared Worker Utilities
 * 
 * Common functions used across all background workers.
 * Workers should import from here instead of duplicating logic.
 */

const { sendLeadEmail, isConfigured } = require('../services/emailService');

/**
 * Check if SMTP is configured
 * @returns {boolean}
 */
function isSmtpConfigured() {
  // Back-compat name; now checks Resend configuration.
  return isConfigured();
}

function getTransport() {
  // Back-compat shim; nodemailer transport no longer exists.
  return null;
}

/**
 * Send email with error handling
 * @param {Object} options - nodemailer send options
 * @returns {Promise<boolean>} success
 */
async function sendEmail(options) {
  if (!isSmtpConfigured()) {
    console.log('[Email] Email not configured, skipping');
    return false;
  }

  try {
    const res = await sendLeadEmail({
      to: options.to,
      subject: options.subject,
      html: options.html || (options.text ? `<pre style="white-space:pre-wrap;">${escapeHtml(options.text)}</pre>` : ''),
    });
    return Boolean(res?.success);
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return false;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get admin dashboard URL for a resource
 * @param {string} path - path after base URL
 * @returns {string|null}
 */
function getAdminUrl(path) {
  const base = process.env.ADMIN_DASHBOARD_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/**
 * Validate required environment variables
 * @param {string[]} required - list of required env vars
 * @returns {boolean}
 */
function validateEnv(required) {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ENV] Missing required variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

/**
 * Structured log with timestamp and worker name
 * @param {string} worker - worker name
 * @param {string} message - log message
 * @param {Object} data - optional data
 */
function log(worker, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${worker}]`;
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Structured error log
 * @param {string} worker - worker name
 * @param {string} message - error message
 * @param {Error} err - error object
 */
function logError(worker, message, err) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${worker}] ERROR: ${message}`, err.message || err);
}

/**
 * Common lead keywords for detection
 */
const LEAD_KEYWORDS = [
  'leak', 'leaking', 'repair', 'fix', 'broken',
  'quote', 'estimate', 'price', 'cost', 'pricing',
  'inspection', 'inspect', 'evaluate', 'assess',
  'damage', 'damaged', 'storm', 'hail', 'wind',
  'replace', 'replacement', 'new roof', 'install',
  'emergency', 'urgent', 'asap', 'today',
  'appointment', 'schedule', 'book', 'visit',
];

/**
 * Contact detection regex patterns
 */
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /\b(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

/**
 * Detect contact info in text
 * @param {string} text
 * @returns {Object} { hasEmail, hasPhone, emails, phones }
 */
function detectContactInfo(text) {
  if (!text) return { hasEmail: false, hasPhone: false, emails: [], phones: [] };
  
  const emails = text.match(EMAIL_REGEX) || [];
  const phones = text.match(PHONE_REGEX) || [];
  
  return {
    hasEmail: emails.length > 0,
    hasPhone: phones.length > 0,
    emails: [...new Set(emails.map(e => e.toLowerCase()))],
    phones: [...new Set(phones)],
  };
}

/**
 * Detect lead keywords in text
 * @param {string} text
 * @returns {string[]} found keywords
 */
function detectLeadKeywords(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return LEAD_KEYWORDS.filter(kw => lower.includes(kw));
}

module.exports = {
  isSmtpConfigured,
  getTransport,
  sendEmail,
  getAdminUrl,
  validateEnv,
  log,
  logError,
  LEAD_KEYWORDS,
  EMAIL_REGEX,
  PHONE_REGEX,
  detectContactInfo,
  detectLeadKeywords,
};
