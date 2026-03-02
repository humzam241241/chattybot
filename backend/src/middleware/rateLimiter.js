const rateLimit = require('express-rate-limit');

// Public chat endpoint: generous but still protects against abuse
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Ingestion is admin-only and expensive — very tight limit
const ingestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Ingestion rate limit reached.' },
});

// General API limiter for other routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests.' },
});

module.exports = { chatLimiter, ingestLimiter, apiLimiter };
