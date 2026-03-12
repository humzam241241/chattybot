const { Resend } = require('resend');
const twilio = require('twilio');

const resend = new Resend(process.env.RESEND_API_KEY);

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

console.log('[Twilio] SID loaded:', process.env.TWILIO_ACCOUNT_SID?.slice(0, 6));
console.log('[Twilio] WhatsApp sender:', process.env.TWILIO_WHATSAPP_NUMBER);
console.log('[Twilio] SMS sender:', process.env.TWILIO_PHONE_NUMBER);

const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER || null;

function normalizeE164(to) {
  const raw = String(to || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`; // default US/CA
  if (digits.length > 10) return `+${digits}`;
  return raw; // last resort
}

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      console.log('[Notify] Email skipped (RESEND_API_KEY/EMAIL_FROM missing)');
      return;
    }

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log('[Notify] Email sent');
  } catch (err) {
    console.error('[Notify] Email failed', err.message);
  }
}

async function sendSMS(to, message, options = {}) {
  const fromOverride = options && typeof options === 'object' ? options.from : null;
  const from = normalizeE164(String(fromOverride || '').replace(/^whatsapp:/i, '')) || FROM_PHONE;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !from) {
    console.log('[Notify] SMS skipped (Twilio env missing)');
    return;
  }
  const phone = normalizeE164(to);
  if (!phone) {
    console.log('[Notify] SMS skipped (missing recipient)');
    return;
  }

  try {
    await client.messages.create({
      from: from,
      to: phone,
      body: message,
    });
    console.log('[Notify] SMS sent');
  } catch (err) {
    console.error('[Notify] SMS error:', err.message);
    if (err && typeof err === 'object') {
      console.error('[Notify] SMS details:', {
        code: err.code,
        status: err.status,
        moreInfo: err.moreInfo,
      });
    }
  }
}

async function sendWhatsApp(to, message, options = {}) {
  const fromOverride = options && typeof options === 'object' ? options.from : null;
  const overrideE164 = normalizeE164(String(fromOverride || '').replace(/^whatsapp:/i, '')) || null;
  const from = overrideE164 ? `whatsapp:${overrideE164}` : WHATSAPP_FROM;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !from) {
    console.log('[Notify] WhatsApp skipped (Twilio env missing)');
    return;
  }
  const phone = normalizeE164(to);
  if (!phone) {
    console.log('[Notify] WhatsApp skipped (missing recipient)');
    return;
  }

  try {
    await client.messages.create({
      from: from,
      to: `whatsapp:${phone}`,
      body: message,
    });
    console.log('[Notify] WhatsApp sent');
  } catch (err) {
    console.error('[Notify] WhatsApp error:', err.message);
    if (err && typeof err === 'object') {
      console.error('[Notify] WhatsApp details:', {
        code: err.code,
        status: err.status,
        moreInfo: err.moreInfo,
      });
    }
  }
}

module.exports = {
  sendEmail,
  sendSMS,
  sendWhatsApp,
};

