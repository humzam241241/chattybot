require('dotenv').config();

// Validate environment on startup
const { logEnvironmentStatus } = require('./config/env');
logEnvironmentStatus();

// Force Node.js DNS to resolve IPv4 first.
// Render's free tier only has IPv4 outbound — without this, DNS resolves
// Supabase's hostname to an IPv6 address and the connection fails with ENETUNREACH.
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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
const filesRouter = require('./routes/files');
const conversationsRouter = require('./routes/conversations');
const adminAnalyticsRouter = require('./routes/adminAnalytics');
const missedLeadsRouter = require('./routes/missedLeads');
const reportsRouter = require('./routes/reports');
const analyticsRouter = require('./routes/analytics');
const adminReconcileRouter = require('./routes/adminReconcile');
const twilioWebhookRouter = require('./routes/twilioWebhook');
const stripeRouter = require('./routes/stripe');
const adminOverviewRouter = require('./routes/adminOverview');
const adminAuth = require('./middleware/adminAuth');
const { userAuth } = require('./middleware/userAuth');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Render (and most cloud platforms) sit behind a reverse proxy.
// This tells Express to trust the X-Forwarded-For header so that
// rate limiting and IP detection work correctly.
app.set('trust proxy', 1);

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
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  uptime: process.uptime(),
  ts: new Date().toISOString() 
}));

app.use('/chat', chatRouter);
app.use('/api/chat', chatRouter);
app.use('/ingest', ingestRouter);
app.use('/lead', leadsRouter);
app.use('/api/lead', leadsRouter);
app.use('/sites', sitesRouter);
app.use('/site-config', siteConfigRouter);
app.use('/api/site-config', siteConfigRouter);
app.use('/api/sites', siteConfigRouter); // public alias: /api/sites/:siteId

// Twilio webhooks (public, no auth required)
app.use('/webhooks', twilioWebhookRouter);

// Stripe routes (webhook needs raw body, must be before json parser for that route)
app.use('/api/stripe', stripeRouter);

// Protected admin API namespace (auth required)
const adminApi = express.Router();
adminApi.use(userAuth);
adminApi.use('/sites', sitesRouter);
adminApi.use('/ingest', ingestRouter);
adminApi.use('/leads', leadsRouter);
adminApi.use('/files', filesRouter);
adminApi.use('/conversations', conversationsRouter);
adminApi.use('/conversations', adminAnalyticsRouter);
adminApi.use('/transcript', adminAnalyticsRouter);
adminApi.use('/stats', adminAnalyticsRouter);
adminApi.use('/debug', adminAnalyticsRouter);
adminApi.use('/missed-leads', missedLeadsRouter);
adminApi.use('/reports', reportsRouter);
adminApi.use('/analytics', analyticsRouter);
adminApi.use('/reconcile', adminReconcileRouter);
adminApi.use('/overview', adminOverviewRouter);
app.use('/api/admin', adminApi);

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
