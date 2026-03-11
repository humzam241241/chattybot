const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// sessions[whatsapp_number] -> { conversationId, lastMessage, lastActivityAt, siteId }
const sessions = new Map();

function isExpired(session, now = Date.now()) {
  if (!session?.lastActivityAt) return true;
  return now - session.lastActivityAt > SESSION_TTL_MS;
}

function getSession(whatsappNumber, siteId = null) {
  const key = String(whatsappNumber || '').trim();
  if (!key) return null;

  const session = sessions.get(key);
  if (!session) return null;

  const now = Date.now();
  if (isExpired(session, now)) {
    sessions.delete(key);
    return null;
  }

  // Safety: if the same number hits multiple sites, start a fresh session.
  if (siteId && session.siteId && session.siteId !== siteId) {
    sessions.delete(key);
    return null;
  }

  return session;
}

function upsertSession(whatsappNumber, patch) {
  const key = String(whatsappNumber || '').trim();
  if (!key) return null;

  const prev = sessions.get(key) || {};
  const next = {
    ...prev,
    ...patch,
    lastActivityAt: Date.now(),
  };
  sessions.set(key, next);
  return next;
}

function expireOldSessions() {
  const now = Date.now();
  let expired = 0;
  for (const [key, session] of sessions.entries()) {
    if (isExpired(session, now)) {
      sessions.delete(key);
      expired += 1;
    }
  }
  return expired;
}

// Best-effort periodic cleanup
setInterval(() => {
  try {
    expireOldSessions();
  } catch (e) {
    // non-fatal
  }
}, 60 * 1000).unref?.();

module.exports = {
  SESSION_TTL_MS,
  getSession,
  upsertSession,
  expireOldSessions,
};

