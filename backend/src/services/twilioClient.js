/**
 * Twilio Client Service
 * 
 * Centralized Twilio client for SMS and WhatsApp messaging.
 * Used by both inbound webhooks and outbound notifications.
 */

const twilio = require('twilio');

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn('[TwilioClient] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured');
    return null;
  }

  return twilio(accountSid, authToken);
}

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

function normalizePhoneE164(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  
  // Already E.164
  if (raw.startsWith('+')) return raw;
  
  // Remove all non-digits
  const digits = raw.replace(/[^\d]/g, '');
  
  // Assume US/CA if 10 digits
  if (digits.length === 10) return `+1${digits}`;
  
  // If > 10, assume country code included
  if (digits.length > 10) return `+${digits}`;
  
  return raw; // fallback
}

/**
 * Send SMS via Twilio
 * @param {string} to - Phone number (will be normalized to E.164)
 * @param {string} message - Message body
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendSMS(to, message) {
  try {
    const client = getTwilioClient();
    if (!client) {
      console.log('[TwilioClient] SMS skipped - Twilio not configured');
      return { success: false, error: 'Twilio not configured' };
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      console.log('[TwilioClient] SMS skipped - TWILIO_PHONE_NUMBER not set');
      return { success: false, error: 'TWILIO_PHONE_NUMBER not set' };
    }

    const e164To = normalizePhoneE164(to);
    if (!e164To) {
      console.log('[TwilioClient] SMS skipped - invalid recipient phone');
      return { success: false, error: 'Invalid phone number' };
    }

    console.log(`[TwilioOutbound] Sending SMS to ${e164To}`);
    
    const result = await client.messages.create({
      body: message,
      from,
      to: e164To,
    });

    console.log(`[TwilioOutbound] SMS sent successfully (SID: ${result.sid})`);
    return { success: true, sid: result.sid };
  } catch (err) {
    console.error('[TwilioOutbound] SMS send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send WhatsApp message via Twilio
 * @param {string} to - Phone number (will be normalized to E.164 and prefixed with whatsapp:)
 * @param {string} message - Message body
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendWhatsApp(to, message) {
  try {
    const client = getTwilioClient();
    if (!client) {
      console.log('[TwilioClient] WhatsApp skipped - Twilio not configured');
      return { success: false, error: 'Twilio not configured' };
    }

    const from = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!from) {
      console.log('[TwilioClient] WhatsApp skipped - TWILIO_WHATSAPP_NUMBER not set');
      return { success: false, error: 'TWILIO_WHATSAPP_NUMBER not set' };
    }

    const e164To = normalizePhoneE164(to);
    if (!e164To) {
      console.log('[TwilioClient] WhatsApp skipped - invalid recipient phone');
      return { success: false, error: 'Invalid phone number' };
    }

    const whatsappFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    const whatsappTo = `whatsapp:${e164To}`;

    console.log(`[TwilioOutbound] Sending WhatsApp to ${whatsappTo}`);
    
    const result = await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo,
    });

    console.log(`[TwilioOutbound] WhatsApp sent successfully (SID: ${result.sid})`);
    return { success: true, sid: result.sid };
  } catch (err) {
    console.error('[TwilioOutbound] WhatsApp send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Validate Twilio webhook signature
 * @param {string} signature - X-Twilio-Signature header
 * @param {string} url - Full URL of the webhook
 * @param {Object} params - Request body params
 * @returns {boolean}
 */
function validateWebhookSignature(signature, url, params) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('[TwilioClient] Cannot validate webhook - TWILIO_AUTH_TOKEN not set');
    return false;
  }

  try {
    return twilio.validateRequest(authToken, signature, url, params);
  } catch (err) {
    console.error('[TwilioClient] Webhook validation error:', err.message);
    return false;
  }
}

module.exports = {
  getTwilioClient,
  isConfigured,
  sendSMS,
  sendWhatsApp,
  validateWebhookSignature,
  normalizePhoneE164,
};
