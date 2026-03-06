const { sendLeadEmail: sendViaResend, isConfigured: isResendConfigured } = require('./emailService');

function isConfigured() {
  return isResendConfigured();
}

async function sendLeadEmail({ to, siteName, lead }) {
  if (!isConfigured()) return { skipped: true, reason: 'Email not configured' };
  if (!to) return { skipped: true, reason: 'No recipient' };

  const subject = `[ChattyBot] New lead for ${siteName || 'your site'}`;
  const html = `
    <h2>New lead</h2>
    <p><b>Site:</b> ${escapeHtml(siteName || '(unknown)')}</p>
    <p><b>Name:</b> ${escapeHtml(lead?.name || '(none)')}</p>
    <p><b>Email:</b> ${escapeHtml(lead?.email || '(none)')}</p>
    <p><b>Message:</b> ${escapeHtml(lead?.message || '(none)')}</p>
    <p><b>Time:</b> ${escapeHtml(new Date().toISOString())}</p>
  `;

  const result = await sendViaResend({ to, subject, html });
  return result.success ? { skipped: false } : { skipped: true, reason: result.reason || 'Email failed' };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { isConfigured, sendLeadEmail };

