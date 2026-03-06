const nodemailer = require('nodemailer');

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

function isConfigured() {
  const ok = SMTP_KEYS.every(k => {
    const v = process.env[k];
    return v != null && String(v).trim() !== '';
  });
  if (!ok) {
    const missing = SMTP_KEYS.filter(k => !process.env[k] || String(process.env[k]).trim() === '');
    if (missing.length > 0) {
      console.log(`[Mailer] SMTP not configured - missing or empty: ${missing.join(', ')}`);
    }
  }
  return ok;
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // Force IPv4 (Render often has no IPv6 egress)
    family: 4,
    // Fail fast (otherwise sendMail can appear to "hang" in logs)
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Office365 requires STARTTLS on 587; nodemailer will upgrade automatically.
    requireTLS: port === 587,
    // Some SMTP providers require relaxed TLS in certain environments.
    // (Requested for Render ENETUNREACH diagnosis / compatibility.)
    tls: { rejectUnauthorized: false },
  });
}

async function sendLeadEmail({ to, siteName, lead }) {
  if (!isConfigured()) return { skipped: true, reason: 'SMTP not configured' };
  if (!to) return { skipped: true, reason: 'No recipient' };

  const transport = getTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `[ChattyBot] New lead for ${siteName || 'your site'}`,
    text: [
      `Site: ${siteName || '(unknown)'}`,
      `Name: ${lead.name || '(none)'}`,
      `Email: ${lead.email}`,
      `Message: ${lead.message || '(none)'}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n'),
  });

  return { skipped: false };
}

module.exports = { isConfigured, getTransport, sendLeadEmail };

