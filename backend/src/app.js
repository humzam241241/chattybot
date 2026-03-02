require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');

const chatRouter = require('./routes/chat');
const ingestRouter = require('./routes/ingest');
const leadsRouter = require('./routes/leads');
const sitesRouter = require('./routes/sites');
const siteConfigRouter = require('./routes/siteConfig');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ── Security headers ──────────────────────────────────────────────────────────
// helmet sets X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.
// crossOriginResourcePolicy: false is required so the widget JS can be loaded
// cross-origin by customer sites.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProd ? undefined : false, // Relax CSP in dev
}));

// Prevent HTTP Parameter Pollution attacks
app.use(hpp());

// Gzip responses — reduces bandwidth, no security downside here
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Admin routes carry a Bearer token so CORS is safe to open.
// The widget is embedded on arbitrary third-party sites — must allow all origins
// on public endpoints (/chat, /lead, /site-config).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-to-server / same-origin
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, true); // widget can be embedded anywhere
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Hard cap at 1 MB — prevents request body bomb attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Remove fingerprinting headers ─────────────────────────────────────────────
app.disable('x-powered-by'); // helmet also does this, belt-and-suspenders

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/chat', chatRouter);
app.use('/ingest', ingestRouter);
app.use('/lead', leadsRouter);
app.use('/sites', sitesRouter);
app.use('/site-config', siteConfigRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
// Never leak stack traces or internal details to the client in production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}`, err);
  res.status(status).json({
    error: isProd ? 'Internal server error' : err.message,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ChattyBot backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
