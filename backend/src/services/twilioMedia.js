const { getEnvInt } = require('../config/env');

function isAllowedTwilioMediaUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    // Accept Twilio's official hosts (api.twilio.com, mcs.us1.twilio.com, etc.)
    return host === 'api.twilio.com' || host.endsWith('.twilio.com');
  } catch {
    return false;
  }
}

function buildBasicAuthHeader(accountSid, authToken) {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

const MAX_MEDIA_BYTES = Math.max(
  256 * 1024,
  Math.min(10 * 1024 * 1024, getEnvInt('TWILIO_MEDIA_MAX_BYTES', 8 * 1024 * 1024))
);

async function downloadTwilioMedia(url) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();

  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');
  if (!url) throw new Error('Missing media URL');
  if (!isAllowedTwilioMediaUrl(url)) throw new Error('MediaUrl host not allowed');

  const timeoutMs = Math.max(1000, Math.min(30000, getEnvInt('TWILIO_MEDIA_TIMEOUT_MS', 15000)));
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(String(url), {
      method: 'GET',
      headers: {
        authorization: buildBasicAuthHeader(accountSid, authToken),
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Twilio media HTTP ${resp.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`);
    }

    const contentType = String(resp.headers.get('content-type') || '').toLowerCase().trim();
    const len = Number(resp.headers.get('content-length') || '0') || 0;
    if (len && len > MAX_MEDIA_BYTES) throw new Error(`Media too large (${len} bytes)`);

    const ab = await resp.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length > MAX_MEDIA_BYTES) throw new Error(`Media too large (${buffer.length} bytes)`);

    return { buffer, contentType };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { downloadTwilioMedia, MAX_MEDIA_BYTES };

