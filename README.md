# ChattyBot — White-Label AI Chatbot Platform

A production-ready, **white-label** SaaS platform for embedding customizable AI chatbots on any website. Powered by RAG (Retrieval Augmented Generation), pgvector, and OpenAI.

**Perfect For:**
- 🏢 **Agencies** — Deploy custom-branded chatbots for multiple clients
- 💼 **SaaS Businesses** — Embed AI chat on customer websites
- 🎨 **White-Label Solutions** — Each client gets their own bot name, personality, and branding

> **Note**: "Raffy" in code variable names is historical naming. The actual chatbot name, personality, and behavior are 100% configurable per site.

---

## Current State & Capabilities

**Status:** Production-ready, fully functional multi-tenant platform.

### What's Implemented

| Area | Capabilities |
|------|--------------|
| **Chat** | RAG-powered responses, streaming (SSE), multi-turn context, intent classification (kb/booking/escalation/emergency) |
| **Knowledge Base** | Website ingestion (Playwright), file upload (PDF/DOCX/XLSX), pgvector embeddings, chunking |
| **Lead Intelligence** | Automatic scoring (HOT/WARM/COLD), owner email notifications, lead capture form, CSV export |
| **Admin Dashboard** | Site CRUD, conversations list with two-panel chat viewer, leads, files, RAG evaluation, widget settings |
| **Analytics** | AI summaries, lead extraction worker, stats dashboard (React app), transcript viewer |
| **Widget** | Floating bubble, streaming responses, quick reply chips, booking CTA, lead form, Shadow DOM isolation |
| **Security** | Domain verification, rate limiting, tenant isolation, Bearer auth, input validation |

### Admin Dashboard Features

- **Sites** — Create, edit, delete sites; configure color, tone, domain, system prompt
- **Conversations** — Two-panel layout: left = conversation list (visitor_id, message count, timestamp, lead rating); right = full chat transcript
- **Leads** — List, export CSV
- **Files** — Upload PDF/DOCX/XLSX, reprocess, delete
- **RAG Evaluation** — Run accuracy tests on knowledge base
- **Settings** — Intro message, suggested questions, booking URL, lead email

### Tech Stack

| Component | Stack |
|-----------|-------|
| Backend | Node.js, Express, pg, OpenAI, Playwright |
| Widget | React, Vite (IIFE bundle) |
| Admin | Next.js 14, React |
| Analytics | React, Chart.js, Tailwind |
| Database | Supabase (PostgreSQL + pgvector) |

---

## Architecture Overview

```
chattybot/
├── backend/          Node.js + Express API (deploy to Render)
├── widget/           React chat widget → single widget.js (deploy to Vercel)
├── admin/            Next.js admin dashboard (deploy to Vercel)
└── admin-dashboard/  React analytics dashboard (deploy to Vercel)
```

**Data flow:**
```
Customer site
  └── <script data-site-id="...">
        └── widget.js fetches /site-config → renders branded chat
              └── POST /chat or /chat/stream → backend embeds query → pgvector search → GPT-4o-mini → answer
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- Supabase project with pgvector enabled
- OpenAI API key

### 1. Database Setup

Run migrations in Supabase SQL editor (in order):
- `backend/migrations/001_initial.sql`
- `backend/migrations/002_files_conversations_settings.sql`
- `backend/migrations/003_lead_scoring.sql`
- `backend/migrations/004_conversation_overview_view.sql`

Enable pgvector: Dashboard → Database → Extensions → search "vector" → Enable

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, OPENAI_API_KEY, ADMIN_SECRET
npm run dev
# Runs on http://localhost:3001
```

### 3. Widget

```bash
cd widget
npm install
npm run build
# Output: dist/widget.js
npx serve widget/dist   # Local testing
```

### 4. Admin Dashboard

```bash
cd admin
npm install
cp .env.example .env
# Set API_URL, ADMIN_SECRET, NEXT_PUBLIC_WIDGET_URL, NEXT_PUBLIC_API_URL
npm run dev
# Runs on http://localhost:3000
```

### 5. Analytics Dashboard (Optional)

```bash
cd admin-dashboard
npm install
# Set REACT_APP_API_URL, REACT_APP_ADMIN_SECRET in .env
npm start
```

---

## Deployment

### Backend → Render

1. Create Web Service on [render.com](https://render.com)
2. Root directory: `backend`
3. Build: `npm install`
4. Start: `npm start`
5. Add env vars from `backend/.env.example`

Render notes for Playwright ingestion:
- `PLAYWRIGHT_BROWSERS_PATH=0`
- `NODE_OPTIONS=--max-old-space-size=512`
- `INGEST_MAX_PAGES=10` (optional, cap crawl size)

### Widget → Vercel

```bash
cd widget && npm run build
npx vercel --prod
# Set output directory: dist
```

### Admin → Vercel

```bash
cd admin
npx vercel --prod
```

Env vars: `API_URL`, `ADMIN_SECRET`, `NEXT_PUBLIC_WIDGET_URL`, `NEXT_PUBLIC_API_URL`

---

## Usage Guide

### Creating Your First Site

1. Admin → **+ New Site**
2. Fill company name, domain, color, tone
3. **Create Site** → **Re-ingest Site** (crawl website)
4. Copy **Embed Code** → paste before `</body>` on your site

### Embed Code

```html
<script 
  src="https://your-widget.vercel.app/widget.js" 
  data-site-id="YOUR_SITE_ID"
  data-api-url="https://your-backend.onrender.com">
</script>
```

### Viewing Conversations & Leads

- **Conversations:** Sites → [Site] → Conversations → click any row to view full transcript
- **Leads:** Sites → [Site] → Leads → Export CSV

---

## API Reference

### Public Endpoints (Widget)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/site-config/:site_id` | Widget branding config |
| POST | `/chat` | Send message, get AI response |
| POST | `/chat/stream` | Streaming response (SSE) |
| POST | `/lead` | Lead capture form |

### Admin Endpoints (Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sites` | List sites |
| POST | `/sites` | Create site |
| GET | `/sites/:id` | Get site |
| PUT | `/sites/:id` | Update site |
| DELETE | `/sites/:id` | Delete site |
| POST | `/ingest/:site_id` | Trigger ingestion |
| GET | `/lead/:site_id` | List leads |
| GET | `/api/admin/conversations/site/:site_id` | List conversations |
| GET | `/api/admin/conversations/:conversation_id` | Conversation + messages |
| GET | `/api/admin/files/:site_id` | List files |
| POST | `/api/admin/files/upload` | Upload file |
| POST | `/api/admin/rag-eval/:site_id` | Run RAG evaluation |

---

## Security

- **Domain verification** — Widget validated against registered domain
- **Rate limiting** — Chat 30/min, Ingest 10/hr, API 60/min
- **Tenant isolation** — All queries scoped by `site_id`
- **Input sanitization** — `express-validator` on endpoints
- **Admin auth** — Bearer token (API_URL + ADMIN_SECRET server-side only in Next.js)

---

## Conversation Analytics

- **AI Summaries** — `summarizeWorker.js` (run every 5 min)
- **Lead Extraction** — `leadExtractor.js` (run every 10 min)
- **Analytics Dashboard** — `admin-dashboard/` (React + Chart.js)

Deploy workers with PM2:
```bash
pm2 start ecosystem.config.js
```

**Docs:** [ANALYTICS_SETUP.md](./ANALYTICS_SETUP.md), [README_ANALYTICS.md](./README_ANALYTICS.md), [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `ADMIN_SECRET` | Bearer token for admin |
| `INGEST_MAX_PAGES` | Max pages to crawl (default 150) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | File storage |
| `SMTP_*` | Optional email notifications |

### Admin (Next.js)

| Variable | Description |
|----------|-------------|
| `API_URL` | Backend URL (server-side) |
| `ADMIN_SECRET` | Must match backend |
| `NEXT_PUBLIC_WIDGET_URL` | Widget JS URL for embed code |
| `NEXT_PUBLIC_API_URL` | Backend URL for embed code |

---

## Tech Decisions

| Decision | Reasoning |
|----------|-----------|
| `gpt-4o-mini` | Fast, cheap, sufficient for RAG |
| `text-embedding-3-small` | Best cost/quality for embeddings |
| pgvector on Supabase | Simple production vector search |
| Shadow DOM | Widget CSS isolation |
| IIFE bundle | Single `<script>` tag, no module system |
| SSE streaming | Real-time response feel |

---

## Roadmap

- [x] Streaming responses (SSE)
- [x] Conversation history
- [x] Two-panel conversation viewer
- [x] AI summaries & lead extraction
- [x] RAG evaluation
- [ ] JWT auth for admin
- [ ] Webhook on lead capture
- [ ] Multi-language support
