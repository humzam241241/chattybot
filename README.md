# ChattyBot — White-Label AI Chatbot Platform

A production-ready, **white-label** SaaS platform for embedding customizable AI chatbots on any website. Powered by RAG (Retrieval Augmented Generation), pgvector, and OpenAI.

**Perfect For:**
- 🏢 **Agencies** — Deploy custom-branded chatbots for multiple clients
- 💼 **SaaS Businesses** — Embed AI chat on customer websites
- 🎨 **White-Label Solutions** — Each client gets their own bot name, personality, and branding

**Key Features:**
- 🎨 **Fully Customizable** — Each site configures its own bot name (Sarah, Alex, etc.), personality, tone, and visual branding
- 🏢 **Multi-Tenant** — Manage unlimited client sites from a single dashboard
- 🧠 **RAG-Powered** — Automatic website ingestion + vector search for accurate, contextual responses
- 📊 **Lead Intelligence** — Automatic lead scoring and owner notifications
- 🎯 **RAG Evaluation** — Built-in accuracy testing system
- 📈 **Conversation Analytics** — Complete analytics dashboard with AI summaries and lead extraction
- 🚀 **Production-Ready** — Full deployment guides for Render + Vercel

> **Note**: "Raffy" in code variable names is just historical naming. The actual chatbot name, personality, and behavior are 100% configurable per site.

---

## Architecture Overview

```
chattybot/
├── backend/          Node.js + Express API (deploy to Render)
├── widget/           React chat widget, built as single JS file (deploy to Vercel)
├── admin/            Next.js admin dashboard (deploy to Vercel)
└── admin-dashboard/  React analytics dashboard (NEW - deploy to Vercel)
```

**Data flow:**
```
Customer site
  └── <script data-site-id="...">
        └── widget.js fetches /site-config → renders branded chat
              └── POST /chat → backend embeds query → pgvector search → GPT-4o-mini → answer
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- A Supabase project with pgvector enabled
- OpenAI API key

### 1. Database Setup

In your Supabase SQL editor, run:
```sql
-- contents of backend/migrations/001_initial.sql
```

Enable the pgvector extension in Supabase:
> Dashboard → Database → Extensions → search "vector" → Enable

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL, OPENAI_API_KEY, ADMIN_SECRET
npm run dev
# Runs on http://localhost:3001
```

### 3. Widget

```bash
cd widget
npm install
npm run build
# Output: dist/widget.js
# Serve dist/ folder statically
```

For local testing, serve the dist folder:
```bash
npx serve widget/dist
```

### 4. Admin Dashboard

```bash
cd admin
npm install
cp .env.example .env
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
# Set NEXT_PUBLIC_ADMIN_SECRET=same-as-backend-ADMIN_SECRET
npm run dev
# Runs on http://localhost:3000
```

---

## Deployment

### Backend → Render

1. Push code to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Settings:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add environment variables (from `backend/.env.example`)
5. Deploy

Render-specific notes for ingestion (Playwright):
- Set `PLAYWRIGHT_BROWSERS_PATH=0` (ensures browsers install into `node_modules`)
- Set `NODE_OPTIONS=--max-old-space-size=512` (matches Render's memory limits and avoids unexpected heap growth)
- Optional: set `INGEST_MAX_PAGES=10` (or lower) to cap crawl size per ingestion job

Note: Free Render tier spins down after 15 min idle. Upgrade to Starter ($7/mo) for production.

### Widget → Vercel (Static)

1. Build the widget: `cd widget && npm run build`
2. Deploy `widget/dist/` as a static site on Vercel:
   ```bash
   cd widget
   npx vercel --prod
   # Set output directory to: dist
   ```
3. Note the deployed URL (e.g. `https://chattybot-widget.vercel.app`)
4. Update the embed code in your admin dashboard to point to this URL

### Admin Dashboard → Vercel

1. ```bash
   cd admin
   npx vercel --prod
   ```
2. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` → your Render backend URL
   - `NEXT_PUBLIC_ADMIN_SECRET` → your admin secret

---

## Usage Guide

### Creating Your First Site

1. Open the admin dashboard
2. Click **+ New Site**
3. Fill in company name, domain, color, tone
4. Click **Create Site**
5. Click **Re-ingest Site** to crawl and embed your website content
6. Copy the **Embed Code** and paste it before `</body>` on your website

### Embed Code

```html
<script 
  src="https://your-widget.vercel.app/widget.js" 
  data-site-id="YOUR_SITE_ID"
  data-api-url="https://your-backend.onrender.com">
</script>
```

### Viewing Leads

Admin Dashboard → Sites → [Site Name] → View Leads → Export CSV

---

## API Reference

### Public Endpoints (Widget)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/site-config/:site_id` | Fetch widget branding config |
| POST | `/chat` | Send message, get AI response |
| POST | `/lead` | Submit a lead capture form |

### Admin Endpoints (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sites` | List all sites |
| POST | `/sites` | Create site |
| GET | `/sites/:id` | Get site |
| PUT | `/sites/:id` | Update site |
| DELETE | `/sites/:id` | Delete site |
| POST | `/ingest/:site_id` | Trigger content ingestion |
| GET | `/lead/:site_id` | List leads for a site |

---

## Security

- **Domain verification:** Widget requests validated against registered domain in production
- **Rate limiting:** Chat (30/min), Ingest (10/hr), API (60/min)
- **Tenant isolation:** Every DB query is scoped by `site_id`
- **Input sanitization:** `express-validator` on all endpoints
- **Admin auth:** Bearer token (swap for proper JWT auth in v2)

---

## 📊 Conversation Analytics System (NEW)

ChattyBot now includes a **complete conversation analytics dashboard** with AI-powered insights.

### Features
- 🤖 **AI Summaries** — Automatic 1-sentence conversation summaries
- 📇 **Lead Extraction** — Structured data extraction (name, phone, email, service, urgency)
- 📈 **Analytics Dashboard** — Real-time metrics, charts, and conversation tracking
- 💬 **Transcript Viewer** — Chat-style message display with full context
- 🎯 **Lead Intelligence** — Emergency detection, quote tracking, conversion rates

### Quick Setup

**Automated:**
```bash
# Windows
setup-analytics.bat

# Linux/Mac
chmod +x setup-analytics.sh
./setup-analytics.sh
```

**Manual:**
```bash
cd backend && npm install
cd ../admin-dashboard && npm install
node backend/scripts/createIndexes.js
```

### Documentation
- **[ANALYTICS_SETUP.md](./ANALYTICS_SETUP.md)** — Complete deployment guide
- **[ANALYTICS_IMPLEMENTATION.md](./ANALYTICS_IMPLEMENTATION.md)** — Technical overview
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** — Pre-launch verification
- **[README_ANALYTICS.md](./README_ANALYTICS.md)** — Full feature documentation

### Background Workers
- `summarizeWorker.js` — Generates AI summaries (run every 5 min)
- `leadExtractor.js` — Extracts structured leads (run every 10 min)

Deploy with cron jobs or PM2:
```bash
pm2 start ecosystem.config.js
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` or `development` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `ADMIN_SECRET` | Bearer token for admin endpoints |

### Admin (`admin/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_ADMIN_SECRET` | Must match backend `ADMIN_SECRET` |

### Analytics Dashboard (`admin-dashboard/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend API URL |
| `REACT_APP_ADMIN_SECRET` | Must match backend `ADMIN_SECRET` |

---

## Tech Decisions

| Decision | Reasoning |
|----------|-----------|
| `gpt-4o-mini` for chat | Fast, cheap, sufficient quality for RAG answers |
| `text-embedding-3-small` | Best cost/quality for embeddings |
| `pgvector` on Supabase | Simplest path to production vector search |
| Shadow DOM for widget | CSS isolation — won't conflict with host site styles |
| IIFE bundle | One `<script>` tag, no module system required on host site |
| No streaming | Simpler for MVP; add SSE streaming in v2 |

---

## Next Steps (Post-MVP)

- [x] Streaming responses (SSE) ✅
- [x] Conversation history (multi-turn context) ✅
- [x] Conversation analytics dashboard ✅
- [x] AI-powered lead extraction ✅
- [ ] Proper JWT auth for admin
- [ ] Webhook on lead capture
- [ ] Multi-language support
- [ ] White-label reseller mode
