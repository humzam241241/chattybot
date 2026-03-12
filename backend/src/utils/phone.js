function normalizePhoneE164(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;

  if (raw.startsWith('+')) return raw;

  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`; // default US/CA
  if (digits.length > 10) return `+${digits}`;
  return raw; // fallback
}

module.exports = { normalizePhoneE164 };

