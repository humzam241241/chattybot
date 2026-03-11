const { getEnvInt } = require('../config/env');

function pickFirstTextContent(content) {
  if (!Array.isArray(content)) return null;
  const t = content.find((c) => c && c.type === 'text' && typeof c.text === 'string');
  return t ? t.text : null;
}

function pickMediaType(contentType) {
  const ct = String(contentType || '').toLowerCase().trim();
  if (ct.startsWith('image/')) return ct;
  return 'image/jpeg';
}

async function describeImageWithClaude({ buffer, contentType, prompt }) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not configured' };

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'Invalid image buffer' };
  }

  const model = String(process.env.CLAUDE_VISION_MODEL || '').trim() || 'claude-3-5-sonnet-latest';
  const maxTokens = Math.max(50, Math.min(800, getEnvInt('CLAUDE_VISION_MAX_TOKENS', 250) || 250));
  const mediaType = pickMediaType(contentType);

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: buffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text:
              String(prompt || '').trim() ||
              'Briefly describe the image for a customer support conversation. If there is visible text, include it.',
          },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeoutMs = Math.max(2000, Math.min(30000, getEnvInt('CLAUDE_VISION_TIMEOUT_MS', 20000) || 20000));
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return {
        ok: false,
        error: `Claude Vision HTTP ${resp.status}${txt ? `: ${txt.slice(0, 300)}` : ''}`,
      };
    }

    const data = await resp.json();
    const text = pickFirstTextContent(data?.content);
    if (!text) return { ok: false, error: 'Claude Vision returned no text content' };

    return { ok: true, text: String(text).trim() };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    clearTimeout(t);
  }
}

// Back-compat: existing webhook code expects a string (or null) here.
async function analyzeImageWithClaude({ buffer, contentType, prompt }) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[ClaudeVision] ANTHROPIC_API_KEY not set; skipping image analysis');
    return null;
  }

  const r = await describeImageWithClaude({ buffer, contentType, prompt });
  if (!r.ok) {
    console.warn('[ClaudeVision] Image analysis failed (non-fatal):', r.error);
    return null;
  }
  return r.text || null;
}

module.exports = { describeImageWithClaude, analyzeImageWithClaude };

