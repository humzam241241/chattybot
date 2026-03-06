const { Resend } = require('resend');

function isConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    String(process.env.RESEND_API_KEY).trim() !== '' &&
    process.env.EMAIL_FROM &&
    String(process.env.EMAIL_FROM).trim() !== ''
  );
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendLeadEmail({ to, subject, html }) {
  try {
    if (!isConfigured()) {
      console.log('[EmailService] RESEND_API_KEY / EMAIL_FROM not set, skipping');
      return { success: false, reason: 'Email not configured' };
    }

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    console.log('[EmailService] Email sent:', response?.id);
    return { success: true };
  } catch (err) {
    console.error('[EmailService] Email failed:', err.message);
    return { success: false, reason: err.message };
  }
}

module.exports = {
  isConfigured,
  sendLeadEmail,
};

