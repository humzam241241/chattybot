/**
 * Bearer token auth for admin endpoints.
 * Token must be set via ADMIN_SECRET env var (min 16 chars).
 *
 * Uses a constant-time comparison to prevent timing attacks where an
 * attacker could measure response times to guess the token byte-by-byte.
 */
const { timingSafeEqual } = require('crypto');

const secret = process.env.ADMIN_SECRET || '';

// Fail fast at startup if the secret is missing or too short
if (!secret || secret.length < 16) {
  console.error(
    '[FATAL] ADMIN_SECRET must be set and at least 16 characters long. ' +
    'Set it in your .env file and restart.'
  );
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const provided = authHeader.slice(7);

  // Constant-time comparison prevents timing-based token enumeration
  try {
    const a = Buffer.from(provided.padEnd(secret.length));
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

module.exports = adminAuth;
