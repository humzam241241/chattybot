const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
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

