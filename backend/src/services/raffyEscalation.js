function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectRyanTrigger(userMessage) {
  const t = normalizeText(userMessage);
  if (!t) return false;

  // Explicit phrases only (avoid accidental matches like "ryanair")
  if (t === 'i need ryan') return true;
  if (t === 'talk to owner') return true;
  if (t === 'speak to ryan') return true;

  // Allow minor punctuation/extra words but keep it strict
  if (/\b(i need ryan)\b/.test(t)) return true;
  if (/\b(talk to (the )?owner)\b/.test(t)) return true;
  if (/\b(speak to ryan)\b/.test(t)) return true;

  return false;
}

function buildRyanEscalationMessage(ownerPhone) {
  const phone = ownerPhone && String(ownerPhone).trim() ? String(ownerPhone).trim() : '[phone]';
  return [
    `I can connect you with Ryan. You can call him directly at ${phone} or leave your contact and he'll get back to you.`,
    '',
    'Please reply with your name, phone number, and a quick description of the issue.',
  ].join('\n');
}

function buildMisunderstoodFallbackMessage() {
  return `I might not be the best person for this. Want me to connect you with Ryan?`;
}

function isUncertainAnswer(answer) {
  const t = normalizeText(answer);
  if (!t) return true;

  const patterns = [
    /\bim not sure\b/,
    /\bi m not sure\b/,
    /\bi am not sure\b/,
    /\bi dont know\b/,
    /\bi don t know\b/,
    /\bi do not know\b/,
    /\bnot sure about that\b/,
    /\bi cant help\b/,
    /\bi can t help\b/,
    /\bi cannot help\b/,
    /\bno relevant company information\b/,
    /\bnot found in the context\b/,
    /\bconnect you with (the )?team\b/,
  ];

  return patterns.some((re) => re.test(t));
}

function clampMisunderstoodCount(n) {
  const x = Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(2, Math.trunc(x)));
}

function nextMisunderstoodCount(prevCount, { answer }) {
  const prev = clampMisunderstoodCount(prevCount);
  const uncertain = isUncertainAnswer(answer);
  return uncertain ? clampMisunderstoodCount(prev + 1) : 0;
}

module.exports = {
  detectRyanTrigger,
  buildRyanEscalationMessage,
  buildMisunderstoodFallbackMessage,
  isUncertainAnswer,
  nextMisunderstoodCount,
  clampMisunderstoodCount,
};

