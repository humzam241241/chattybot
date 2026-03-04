# Environment Variables — Complete Reference

## Backend Environment Variables

### Required (Core Functionality)

```bash
# Database (Supabase PostgreSQL with pgvector)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Admin Authentication
ADMIN_SECRET=generate-a-strong-random-secret-here
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Must be minimum 16 characters

# Server Port
PORT=3001

# Environment
NODE_ENV=production
```

### Optional (Enhanced Features)

```bash
# CORS — comma-separated list of allowed origins
ALLOWED_ORIGINS=https://your-admin.vercel.app,https://your-widget.vercel.app

# Ingestion Limits (Render-safe defaults)
INGEST_MAX_PAGES=10

# Supabase Storage (for file-based knowledge base)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=site-uploads

# SMTP Email Notifications (for lead capture emails)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="ChattyBot <no-reply@yourdomain.com>"

# Lead Intelligence Notifications (business owner alerts)
LEAD_NOTIFICATION_EMAIL=owner@yourcompany.com

# RAG Evaluation Debug Mode
DEBUG_RAG=false
```

### Render-Specific (Deployment)

```bash
# Playwright browser path (Render compatibility)
PLAYWRIGHT_BROWSERS_PATH=0

# Memory limit (optional, for tight memory environments)
NODE_OPTIONS=--max-old-space-size=512
```

---

## Admin Dashboard Environment Variables

### Required

```bash
# Backend API URL (no trailing slash)
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com

# Widget URL (for embed code generation)
NEXT_PUBLIC_WIDGET_URL=https://your-widget.vercel.app/widget.js
```

### Server-Side Only (Next.js API Routes)

```bash
# Backend URL (used by server-side API routes, can be same as NEXT_PUBLIC_API_URL)
BACKEND_URL=https://your-backend.onrender.com

# Admin Secret (used by server-side API routes to authenticate with backend)
ADMIN_SECRET=same-as-backend-ADMIN_SECRET
```

---

## Widget Environment Variables

### Build-Time (Optional)

```bash
# Default API URL (can be overridden by data-api-url attribute)
VITE_DEFAULT_API_URL=https://your-backend.onrender.com
```

> **Note**: Widget typically gets API URL from the `data-api-url` attribute on the `<script>` tag, so build-time env vars are optional.

---

## Complete `.env` File Templates

### Backend `.env`

```bash
# === REQUIRED ===

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
OPENAI_API_KEY=sk-proj-...
ADMIN_SECRET=your-generated-secret-here
PORT=3001
NODE_ENV=production

# === OPTIONAL ===

ALLOWED_ORIGINS=https://your-admin.vercel.app
INGEST_MAX_PAGES=10

# Supabase Storage
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=site-uploads

# SMTP (lead form notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="ChattyBot <no-reply@yourdomain.com>"

# Lead Intelligence (business owner alerts)
LEAD_NOTIFICATION_EMAIL=owner@yourcompany.com

# Render-specific
PLAYWRIGHT_BROWSERS_PATH=0
```

### Admin `.env.local`

```bash
# === PUBLIC (exposed to browser) ===

NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_WIDGET_URL=https://your-widget.vercel.app/widget.js

# === SERVER-SIDE ONLY (not exposed) ===

BACKEND_URL=https://your-backend.onrender.com
ADMIN_SECRET=same-as-backend-ADMIN_SECRET
```

### Widget `.env` (optional)

```bash
VITE_DEFAULT_API_URL=https://your-backend.onrender.com
```

---

## Deployment Checklist

### Render (Backend)

Set these in Render Dashboard → Web Service → Environment:

- [x] `DATABASE_URL`
- [x] `OPENAI_API_KEY`
- [x] `ADMIN_SECRET`
- [x] `NODE_ENV=production`
- [x] `ALLOWED_ORIGINS`
- [x] `INGEST_MAX_PAGES`
- [x] `PLAYWRIGHT_BROWSERS_PATH=0`
- [ ] `SUPABASE_URL` (if using file uploads)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (if using file uploads)
- [ ] `SUPABASE_STORAGE_BUCKET` (if using file uploads)
- [ ] `SMTP_*` variables (if using email notifications)
- [ ] `LEAD_NOTIFICATION_EMAIL` (if using lead intelligence alerts)

### Vercel (Admin Dashboard)

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

- [x] `NEXT_PUBLIC_API_URL`
- [x] `NEXT_PUBLIC_WIDGET_URL`
- [x] `BACKEND_URL`
- [x] `ADMIN_SECRET`

### Vercel (Widget - Static)

No environment variables needed at runtime (API URL is passed via `data-api-url` on the `<script>` tag).

---

## Security Notes

### ⚠️ Never Commit These to Git

- `DATABASE_URL` — contains password
- `OPENAI_API_KEY` — billable API key
- `ADMIN_SECRET` — authentication token
- `SUPABASE_SERVICE_ROLE_KEY` — full database access
- `SMTP_PASS` — email password
- Any `*_SECRET` or `*_KEY` variables

### ✅ Safe to Commit

- `.env.example` files (with placeholder values)
- `NEXT_PUBLIC_*` variables (exposed to browser anyway)
- `PORT`, `NODE_ENV`, `INGEST_MAX_PAGES`

### 🔒 Generate Strong Secrets

```bash
# Generate ADMIN_SECRET (32-byte hex = 64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

---

## Troubleshooting

### "Missing environment variable" errors

1. Check spelling (case-sensitive)
2. Restart server after adding variables
3. For Render: redeploy after adding variables
4. For Vercel: redeploy after adding variables

### "SMTP not configured" (non-fatal)

If you see this warning but don't need email notifications, it's safe to ignore. Lead capture still works, just without email alerts.

### "Playwright browsers not found" on Render

Make sure `PLAYWRIGHT_BROWSERS_PATH=0` is set in Render environment variables.

---

## Quick Copy Commands

### Backend (local dev)

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm start
```

### Admin (local dev)

```bash
cd admin
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
```
