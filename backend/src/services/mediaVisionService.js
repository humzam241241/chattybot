const axios = require('axios');
const OpenAI = require('openai');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOWNLOAD_TIME_MS = 5000;
const MAX_VISION_TIME_MS = 15000;
const OPENAI_VISION_ABORT_MS = 7000;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BOOKING_URL = 'https://cal.com/ryans-roofing';
const DISCLAIMER =
  'Photos give a general idea, but a professional inspection is required for an accurate assessment.';

function getOpenAiClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OpenAI API key not configured');
  return new OpenAI({ apiKey });
}

function normalizeImageContentType(type) {
  const t = String(type || '').toLowerCase().trim().split(';')[0].trim();
  if (t === 'image/jpg') return 'image/jpeg';
  return t;
}

function isAllowedTwilioMediaUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'api.twilio.com' || host.endsWith('.twilio.com');
  } catch {
    return false;
  }
}

function visionLog(prefix, meta, extra) {
  const payload = {
    requestId: meta?.requestId || undefined,
    conversationId: meta?.conversationId || undefined,
    siteId: meta?.siteId || undefined,
    channel: meta?.channel || undefined,
    ...(extra || {}),
  };
  console.log(prefix, payload);
}

function withTimeout(promise, ms, label) {
  let t = null;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    err?.code === 'ABORT_ERR' ||
    String(err?.message || '').toLowerCase().includes('aborted')
  );
}

async function downloadTwilioImageToBase64({ mediaUrl, mediaContentType, meta }) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();

  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');
  if (!mediaUrl) throw new Error('Missing MediaUrl0');
  if (!isAllowedTwilioMediaUrl(mediaUrl)) throw new Error('MediaUrl host not allowed');

  visionLog('[Vision] Media received', meta, { mediaUrlHost: new URL(mediaUrl).hostname });

  let resp;
  try {
    resp = await axios.get(mediaUrl, {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      responseType: 'arraybuffer',
      timeout: MAX_DOWNLOAD_TIME_MS,
      maxContentLength: MAX_IMAGE_BYTES,
      maxRedirects: 0,
    });
  } catch (e) {
    const status = e?.response?.status;
    if (status >= 300 && status < 400) {
      visionLog('[Vision] Media redirect blocked', meta, {
        status,
        location: e?.response?.headers?.location,
      });
      const err = new Error('Media redirect blocked');
      err.code = 'MEDIA_REDIRECT_BLOCKED';
      throw err;
    }
    throw e;
  }

  const declaredLen = Number(resp.headers?.['content-length'] || '0') || 0;
  if (declaredLen && declaredLen > MAX_IMAGE_BYTES) throw new Error(`Image too large (${declaredLen} bytes)`);

  const headerType = normalizeImageContentType(resp.headers?.['content-type']);
  const hintedType = normalizeImageContentType(mediaContentType);
  const contentType = headerType || hintedType;

  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error(`Unsupported media type: ${contentType || 'unknown'}`);
  }

  const buffer = Buffer.from(resp.data);
  if (!buffer.length) throw new Error('Empty image');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`Image too large (${buffer.length} bytes)`);

  visionLog('[Vision] Download success', meta, { bytes: buffer.length, contentType });

  return { base64: buffer.toString('base64'), contentType };
}

async function analyzeRoofImage(base64Image, contentType, meta) {
  const prompt =
    'You are an AI assistant for a professional roofing company.\n\n' +
    'Analyze the roof photo and give a short assessment.\n\n' +
    'Focus on:\n' +
    '- visible damage\n' +
    '- missing shingles\n' +
    '- storm damage\n' +
    '- wear or deterioration\n\n' +
    'Limit the response to 2–3 sentences.\n\n' +
    'Return only text.';

  const dataUrl = `data:${contentType || 'image/jpeg'};base64,${base64Image}`;

  const openai = getOpenAiClient();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_VISION_ABORT_MS);

  let response;
  try {
    response = await openai.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_output_tokens: 180,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = String(response?.output_text || '').trim();
  if (!text) throw new Error('Vision model returned empty response');

  visionLog('[Vision] Analysis success', meta, { chars: text.length });
  return text;
}

function formatRoofAssessment(responseText) {
  const raw = String(responseText || '').replace(/\s+/g, ' ').trim();

  const suffix =
    `\n\n${DISCLAIMER}\n\n` +
    `If you'd like, you can book a free inspection here:\n${BOOKING_URL}`;

  const maxTotal = 500;
  const maxAssessment = Math.max(0, maxTotal - suffix.length);
  let assessment = raw;

  if (assessment.length > maxAssessment) {
    const trimmed = assessment.slice(0, Math.max(0, maxAssessment - 1)).trim();
    assessment = trimmed ? `${trimmed}…` : '';
  }

  return `${assessment}${suffix}`.trim();
}

function getVisionFallbackMessage() {
  return (
    "I couldn't analyze that image.\n\n" +
    `You can try sending it again, or book a free roof inspection here:\n${BOOKING_URL}`
  );
}

async function buildRoofAssessmentFromTwilioMedia({
  mediaUrl,
  mediaContentType,
  requestId,
  conversationId,
  siteId,
  channel,
}) {
  const meta = { requestId, conversationId, siteId, channel };

  try {
    const { base64, contentType } = await downloadTwilioImageToBase64({ mediaUrl, mediaContentType, meta });
    const analysis = await analyzeRoofImage(base64, contentType, meta);
    return formatRoofAssessment(analysis);
  } catch (e) {
    if (e?.code === 'MEDIA_REDIRECT_BLOCKED') {
      return getVisionFallbackMessage();
    }
    if (isAbortError(e)) {
      visionLog('[Vision] Analysis aborted', meta, { timeoutMs: OPENAI_VISION_ABORT_MS });
      return getVisionFallbackMessage();
    }
    throw e;
  }
}

module.exports = {
  buildRoofAssessmentFromTwilioMedia,
  formatRoofAssessment,
  getVisionFallbackMessage,
};

