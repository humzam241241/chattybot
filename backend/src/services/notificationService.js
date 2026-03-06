const { Resend } = require('resend');
const twilio = require('twilio');

const resend = new Resend(process.env.RESEND_API_KEY);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER
  ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`
  : null;

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

async function sendSMS(to, message) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !FROM_PHONE) {
      console.log('[Notify] SMS skipped (Twilio env missing)');
      return;
    }
    const e164 = normalizeE164(to);
    if (!e164) {
      console.log('[Notify] SMS skipped (missing recipient)');
      return;
    }
    await twilioClient.messages.create({
      body: message,
      from: FROM_PHONE,
      to: e164,
    });
    console.log('[Notify] SMS sent');
  } catch (err) {
    console.error('[Notify] SMS failed', err.message);
  }
}

async function sendWhatsApp(to, message) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !WHATSAPP_FROM) {
      console.log('[Notify] WhatsApp skipped (Twilio env missing)');
      return;
    }
    const e164 = normalizeE164(to);
    if (!e164) {
      console.log('[Notify] WhatsApp skipped (missing recipient)');
      return;
    }
    await twilioClient.messages.create({
      body: message,
      from: WHATSAPP_FROM,
      to: `whatsapp:${e164}`,
    });
    console.log('[Notify] WhatsApp sent');
  } catch (err) {
    console.error('[Notify] WhatsApp failed', err.message);
  }
}

module.exports = {
  sendEmail,
  sendSMS,
  sendWhatsApp,
};

