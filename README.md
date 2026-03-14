# ChattyBot

ChattyBot is a **multi-tenant, white-label AI chatbot platform** for businesses and contractors. It provides an embeddable chat widget, RAG-powered answers, lead capture, **Service Intelligence** (intake, classification, estimates, quotes), and optional SMS/WhatsApp via Twilio. The backend uses **Postgres + pgvector** (Supabase) and **OpenAI** for embeddings and chat; **Supabase Auth** for admin sign-in; **Stripe** for billing.

This `README.md` is the **single source of truth** for engineers onboarding to the repository (architecture, setup, deployment, operations).

> You’ll see “raffy” in code and DB fields. That’s historical naming; it represents per-site chatbot configuration (stored primarily under `sites.raffy_overrides`).

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [System Architecture](#2-system-architecture)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Core Features](#4-core-features)
5. [Service Intelligence](#5-service-intelligence)
6. [API Reference](#6-api-reference)
7. [Multi-Tenant Model](#7-multi-tenant-model)
8. [Database Overview](#8-database-overview)
9. [Environment Variables](#9-environment-variables)
10. [Local Development Setup](#10-local-development-setup)
11. [Widget Embed](#11-widget-embed-instructions)
12. [Twilio Setup](#12-twilio-setup)
13. [File Ingestion](#13-file-ingestion-pipeline)
14. [Deployment](#14-deployment)
15. [Workers / Background Jobs](#15-workers--background-jobs)
16. [Usage Tracking](#16-usage-tracking)
17. [Tenant Onboarding](#17-tenant-onboarding-flow)
18. [Security](#18-security-checklist)
19. [Troubleshooting](#19-troubleshooting)
20. [Documentation & Client Setup](#20-documentation--client-setup)
21. [Common Development Tasks](#21-common-development-tasks)

---

## 1. Product Overview

### Core Capabilities

- **Embeddable widget** — Single `<script>` tag; configurable branding (colors, name, intro).
- **RAG chat** — Multi-turn context, streaming (SSE), retrieval from pgvector embeddings.
- **Website ingestion** — Playwright-based crawling, chunking, embedding.
- **File ingestion** — PDF/DOCX/XLSX with extracted text persisted for reprocessing.
- **Lead intelligence** — Extraction, scoring (HOT/WARM/COLD), notifications, missed-lead detection.
- **Twilio** — Inbound SMS/WhatsApp webhooks (TwiML); outbound from notification pipeline.
- **White-label** — Per-tenant branding, system prompt, suggested questions, booking URL.
- **Admin dashboard** — Next.js app: sites, ingestion, files, conversations, leads, **Service Intelligence**, analytics.
- **Service Intelligence** — Industry-agnostic contractor workflow: service requests, AI classification, estimates with line items, photo/attachment analysis, industries & protocols, historical jobs.
- **Billing** — Stripe subscriptions (Pro/Plus/Ultra), checkout, customer portal.
- **Auth** — Supabase Auth for admin; `app_users` + `is_admin` for backend authorization.
- **Public quote page** — Shareable quote view at `/quote/:quoteId` (e.g. for estimate links).

### Quick Start (Local Dev)

```bash
# 1) Backend
cd backend
npm install
copy .env.example .env
npm run dev

# 2) Admin
cd ..\admin
npm install
copy .env.example .env.local
npm run dev

# 3) Widget (build)
cd ..\widget
npm install
npm run build
```

Backend: `http://localhost:3001`. Admin: `http://localhost:3000`. Widget build output: `widget/dist/widget.js`.

---

## 2. System Architecture

End-to-end flow:

```
Customer website
  → widget (embed script)
    → backend (Express)
      → Postgres + pgvector (Supabase)
        ↔ OpenAI (embeddings + chat)
        ↔ Anthropic (optional: vision/photo analysis)
```

### Component Diagram

```
Customer Website
   │
   ▼
Widget (Vite bundle)
   │
   ▼
Backend API (Express)
   │
   ├── RAG Engine (embeddings, pgvector retrieval, prompt assembly)
   ├── Ingestion (Playwright crawler, file processors, chunk + embed → documents)
   ├── Service Intelligence (requests, classification, estimates, line items, industries)
   ├── Messaging (Twilio webhooks, outbound notifications)
   ├── Auth (Supabase JWT → app_users, checkSiteAccess)
   ├── Billing (Stripe checkout, webhooks, usage)
   └── Workers (summaries, lead extraction, missed leads, reports, reconciliation)
   ▼
Postgres (Supabase)
   ├── sites, app_users
   ├── conversations, messages (media_url for photos)
   ├── documents (pgvector)
   ├── leads, files
   ├── industries, service_protocols, service_requests, estimates, estimate_line_items
   ├── historical_jobs, attachment_analysis, ai_intents, ai_classifications
   └── api_usage, sms_usage, phone_numbers
```

### RAG Pipeline

1. User message → backend (`/chat` or `/chat/stream`).
2. Embedding generated for query (OpenAI).
3. Similarity search on `documents.embedding` (scoped by `site_id`).
4. Top K chunks + conversation history + system prompt → OpenAI completion.
5. Response persisted; returned (optionally streamed via SSE).

---

## 3. Monorepo Structure

```
chattybot/
├── backend/          Express API, workers, migrations (deploy: Render)
├── widget/           Embeddable widget (Vite → dist/widget.js)
├── admin/            Next.js admin dashboard (deploy: Vercel)
├── admin-dashboard/  Legacy analytics dashboard (React, optional)
└── docs/             Client setup guides (e.g. docs/clients/)
```

- **backend/** — Routes, services, RAG, ingestion, Twilio, Service Intelligence, Stripe, migrations.
- **widget/** — Chat bubble, streaming, lead form, image upload; single bundle for customer sites.
- **admin/** — Supabase auth, dashboard, per-site nav (Overview, Leads, Chats, Service Requests, Estimates, AI Analytics, Missed Leads, Analytics, Reports, Files, RAG Test, Industries & Protocols, Settings), embed code, delete clients.
- **docs/** — Client configuration guides (e.g. Ryan's Roofing); see [§20](#20-documentation--client-setup).

---

## 4. Core Features

- **RAG chat** — pgvector retrieval, streaming (SSE) and non-streaming, conversation logging.
- **Website crawler** — Playwright, domain-limited, chunk + embed pipeline.
- **File ingestion** — PDF/DOCX/XLSX → extracted text in `files.extracted_text` → chunks → documents.
- **Lead intelligence** — AI extraction, scoring, missed-lead detection, email/SMS notifications.
- **Twilio** — Inbound SMS/WhatsApp (TwiML); outbound via notification service.
- **White-label** — `sites` + `raffy_overrides`: name, role, tone, notifications, booking URL.
- **Message media** — User photos (widget upload or Twilio media) stored as `messages.media_url` / `media_content_type`; admin conversation view proxies and displays images.
- **Analytics** — Conversation summaries, lead extraction workers, admin dashboards.
- **Stripe** — Checkout sessions, customer portal, subscription status; plan enforcement via `requirePaidOrTrial` where applicable.
- **Supabase Auth** — Admin sign-in; JWT passed to backend; `app_users` and `is_admin` drive access.

---

## 5. Service Intelligence

Industry-agnostic contractor workflow: intake → classification → estimates → line items → send (email/SMS).

### Concepts

- **Industries** — e.g. roofing, HVAC, plumbing (table `industries`).
- **Service protocols** — Job types per industry with scope, pricing bands, risk factors (`service_protocols`).
- **Service requests** — Incoming customer requests (from chats or manual); stored in `service_requests` with optional `attachments` (e.g. photo URLs).
- **Classification** — AI assigns job type, industry, urgency; results in `ai_classifications` and on the request.
- **Estimates** — Generated from a service request (or manually); price range, confidence, optional line items (`estimates`, `estimate_line_items`).
- **Attachment/photo analysis** — Vision (e.g. Claude) on request attachments; results in `attachment_analysis` and feed into estimate confidence/risk.
- **Historical jobs** — Past job outcomes per site for pricing intelligence (`historical_jobs`).

### Admin Flows

- **Service Requests** — List/filter (new, classified, needs_assessment, estimated); extract from chats; manual request; classify; generate estimate; view detail.
- **Estimates & Quotes** — List by site (optional `lead_id`); view detail; edit line items (draft/pending_approval); approve & send (email + SMS); copy for billing.
- **Industries & Protocols** — Per-site industry; link to protocols; configure job types and service protocols.
- **AI Analytics** — Intent and classification analytics per site (from `ai_intents`, `ai_classifications`).

### Key Backend Services

- `backend/src/services/serviceIntelligence/` — intake, problemClassifier, estimateGenerator, estimateLineItems, attachmentAnalysisService.
- Routes: `serviceRequests`, `estimates`, `industries`, `historicalJobs` (under `/api/admin` or public read for industries).

### Database (Service Intelligence)

- `industries`, `service_protocols`, `service_requests`, `estimates`, `estimate_line_items`
- `historical_jobs`, `attachment_analysis`, `ai_intents`, `ai_classifications`
- Migrations: `022_service_intelligence_engine.sql`, `023_service_protocols_seed.sql`, `024_ai_intent_classification_tables.sql`, `025_estimate_line_items.sql`

---

## 6. API Reference

### Public / Widget

| Method | Path | Description |
|--------|------|-------------|
| GET | `/site-config/:site_id` | Widget config (branding, intro, suggested questions) |
| POST | `/chat` | Non-streaming chat |
| POST | `/chat/stream` | Streaming chat (SSE) |
| POST | `/lead` | Lead submission |
| GET | `/api/industries` | List industries (public) |
| GET | `/api/industries/:industry_id/protocols` | Protocols for industry |
| GET | `/api/industries/site/:site_id/config` | Site industry config (auth) |

### Admin API (prefix `/api/admin`, auth required)

| Area | Method | Path | Description |
|------|--------|------|-------------|
| Sites | GET/POST | `/sites` | List / create sites |
| | GET/PUT/DELETE | `/sites/:id` | Get, update, delete site |
| Ingest | POST | `/ingest/:site_id` | Trigger website ingestion |
| | GET | `/ingest/:site_id/status` | Ingestion status |
| Leads | GET | `/leads/:site_id` | List leads (filter, rescore) |
| | GET | `/leads/all` | All leads (admin) |
| | DELETE | `/leads/:site_id/:lead_id` | Delete lead |
| Files | GET | `/files/:site_id` | List files |
| | POST | `/files/upload` | Upload files |
| | POST | `/files/reprocess/:file_id` | Reprocess file |
| | DELETE | `/files/file/:file_id` | Delete file |
| Conversations | GET | `/conversations/site/:site_id` | List conversations |
| | GET | `/conversations/:id` | Get conversation + messages |
| | GET | `/conversations/:id/messages/:msg_id/media` | Proxy message media (image/file) |
| Service Requests | GET/POST | `/service-requests/:site_id` | List / create |
| | GET/PATCH | `/service-requests/:site_id/:request_id` | Get / update |
| | POST | `/service-requests/:site_id/:request_id/classify` | Classify request |
| | POST | `/service-requests/:site_id/extract-from-chats` | Extract from conversations |
| Estimates | GET/POST | `/estimates/:site_id` | List / create (from request) |
| | GET/PATCH | `/estimates/:site_id/:estimate_id` | Get / update (incl. line items) |
| | POST | `/estimates/:site_id/:estimate_id/approve` | Approve |
| | POST | `/estimates/:site_id/:estimate_id/reject` | Reject |
| | POST | `/estimates/:site_id/:estimate_id/send` | Send quote (email/SMS) |
| Industries | GET | `/industries/site/:site_id/config` | Site industry config |
| | POST | `/industries/site/:site_id/config` | Update site config |
| Historical Jobs | GET/POST | `/historical-jobs/:site_id` | List / create |
| | GET/DELETE | `/historical-jobs/:site_id/:job_id` | Get / delete |
| | POST | `/historical-jobs/:site_id/import` | Bulk import |
| AI Chat / Analytics | POST | `/ai-chat/:site_id/message` | Send message (test) |
| | GET | `/ai-chat/:site_id/intents` | List intents |
| | GET | `/ai-chat/:site_id/classifications` | List classifications |
| | GET | `/ai-chat/:site_id/analytics/intents` | Intent analytics |
| | GET | `/ai-chat/:site_id/analytics/classifications` | Classification analytics |
| Missed Leads | GET | `/missed-leads/:site_id` | List missed leads |
| Reports | GET | `/reports/:site_id` | Reports |
| Analytics | GET | `/analytics/:site_id` | Analytics |
| Reconcile | POST | `/reconcile` | Data reconciliation |
| Overview | GET | `/overview` | Admin overview stats |
| RAG Eval | GET/POST | `/rag-eval/:site_id` | RAG test |

### Twilio (public webhooks)

- `POST /webhooks/twilio/sms`
- `POST /webhooks/twilio/whatsapp`

### Stripe

- `POST /api/stripe/webhook` — Webhook (raw body)
- Checkout, portal, subscription: see `backend/src/routes/stripe.js`

---

## 7. Multi-Tenant Model

- **Tenant** = **Site** (`site_id` UUID).
- **Isolation**: All tenant data (conversations, messages, leads, files, documents, service_requests, estimates, usage) must filter by `site_id`.
- **Authorization**: `checkSiteAccess(user, siteId)`; admin from `app_users.is_admin` only. No frontend trust; enforce on backend.
- **Pattern**: Thin routes; business logic in `backend/src/services`. Parameterized queries only.

---

## 8. Database Overview

### Major Tables

| Table | Purpose |
|-------|---------|
| `sites` | Tenant config (domain, branding, raffy_overrides) |
| `app_users` | Auth; `is_admin` for admin API |
| `conversations` | One per visitor/session; `site_id` |
| `messages` | Chat messages; `media_url`, `media_content_type` for photos |
| `files` | Uploaded files; `extracted_text` |
| `documents` | Embedding chunks (pgvector), `site_id` |
| `leads` | Extracted leads, scoring |
| `phone_numbers` | Twilio number → `site_id` (SMS/WhatsApp) |
| `api_usage`, `sms_usage` | Metering per site |
| `industries` | Industry master list |
| `service_protocols` | Job types per industry |
| `service_requests` | Incoming requests; optional attachments |
| `estimates` | Quotes; link to request/lead |
| `estimate_line_items` | Line items per estimate |
| `historical_jobs` | Past jobs for pricing |
| `attachment_analysis` | Photo/attachment vision results |
| `ai_intents`, `ai_classifications` | Intent/classification analytics |

### Migrations

Apply in order from `backend/migrations/`:

| # | File | Summary |
|---|------|---------|
| 001 | initial | Core schema |
| 002 | files_conversations_settings | Files, conversations, settings |
| 003 | lead_scoring | Lead scoring |
| 004 | conversation_overview_view | Views |
| 005 | enhanced_leads | Lead enhancements |
| 006 | agency_features | Agency support |
| 007 | conversation_summary_jobs | Summary jobs |
| 008 | data_reconciliation | Reconciliation |
| 009 | conversation_contact_consent | Consent |
| 010 | users_ownership | Users/ownership |
| 011 | usage_tracking | Usage tables |
| 012 | usage_metering | Metering |
| 013 | saas_site_usage_and_plan | Plans |
| 014 | stripe_billing_site_subscriptions | Stripe |
| 015 | twilio_site_routing | Twilio routing |
| 016 | conversation_misunderstood_count | Misunderstood count |
| 017 | smart_quote_tool | Quote tool |
| 018 | files_extracted_text | Extracted text on files |
| 019 | phone_numbers | Multi-number Twilio |
| 020 | conversations_user_phone | User phone on conversations |
| 021 | messages_media | media_url, media_content_type on messages |
| 022 | service_intelligence_engine | Industries, protocols, requests, estimates, historical_jobs |
| 023 | service_protocols_seed | Seed protocols |
| 024 | ai_intent_classification_tables | ai_intents, ai_classifications |
| 025 | estimate_line_items | estimate_line_items |

---

## 9. Environment Variables

### Backend (`backend/.env`)

**Required:** `DATABASE_URL`, `OPENAI_API_KEY`, `ADMIN_SECRET`

**Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

**Server:** `PORT` (default 3001), `NODE_ENV`, `ALLOWED_ORIGINS`

**Anthropic (optional, vision):** `ANTHROPIC_API_KEY`, `CLAUDE_VISION_MODEL`

**Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_ULTRA`, `FRONTEND_URL`

**Email (Resend):** `RESEND_API_KEY`, `EMAIL_FROM`, `LEAD_NOTIFICATION_EMAIL`, `REPLY_TO`

**Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER` (bare E.164), `TWILIO_DEFAULT_SITE_ID`, `ALLOW_TWILIO_DEFAULT_FALLBACK`

**Ingestion:** `INGEST_MAX_PAGES`, `INGEST_CONCURRENCY`, `PLAYWRIGHT_BROWSERS_PATH=0` (Render), `NODE_OPTIONS=--max-old-space-size=512` (optional)

### Admin (`admin/.env.local`)

- `API_URL` or `NEXT_PUBLIC_API_URL` — Backend URL
- `ADMIN_SECRET` — Must match backend
- `NEXT_PUBLIC_APP_URL` — For Stripe redirects
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase Auth
- `NEXT_PUBLIC_ADMIN_EMAILS` — Comma-separated admin emails
- `NEXT_PUBLIC_WIDGET_URL`, `NEXT_PUBLIC_API_URL` — For embed code

### Widget

- `VITE_DEFAULT_API_URL` — Default backend (overridable by `data-api-url` in embed).

---

## 10. Local Development Setup

1. **Database** — Supabase (or Postgres); enable `vector`; run migrations in order.
2. **Backend** — `cd backend && npm install && copy .env.example .env && npm run dev`
3. **Admin** — `cd admin && npm install && copy .env.example .env.local && npm run dev`
4. **Widget** — `cd widget && npm install && npm run build`
5. **Admin dashboard (optional)** — `cd admin-dashboard && npm install && npm start`

---

## 11. Widget Embed Instructions

Before `</body>` on the customer site:

```html
<script
  src="https://YOUR_WIDGET_HOST/widget.js"
  data-site-id="YOUR_SITE_UUID"
  data-api-url="https://YOUR_BACKEND_HOST">
</script>
```

---

## 12. Twilio Setup

- **Inbound:** `POST /webhooks/twilio/sms`, `POST /webhooks/twilio/whatsapp`. Route by `To` → `phone_numbers` (or legacy `sites.twilio_phone` / `sites.twilio_whatsapp`).
- **Outbound:** Via `notificationService` / `twilioClient` (e.g. lead notifications).
- **WhatsApp:** Env must be **bare E.164** (e.g. `+14155238886`); code adds `whatsapp:`.

---

## 13. File Ingestion Pipeline

1. Admin uploads file → `files` row.
2. Extract text (PDF/DOCX/XLSX) → store in `files.extracted_text`.
3. Chunk → embed (OpenAI) → store in `documents` with `site_id`.

---

## 14. Deployment

- **Backend** — Render (Web Service); root `backend`; `npm start`; set env (including `PLAYWRIGHT_BROWSERS_PATH=0` for ingestion).
- **Admin** — Vercel; root `admin`; set env (API_URL, Supabase, Stripe, etc.).
- **Widget** — Vercel or CDN; serve `widget/dist/widget.js` at stable URL.

Scaling: stateless backend; Supabase Postgres; workers can be split (PM2 or queue) later.

---

## 15. Workers / Background Jobs

- Conversation summaries, lead extraction, missed-lead detection, weekly reports, data reconciliation. Run via PM2 or external cron.

---

## 16. Usage Tracking

- `api_usage`, `sms_usage` per `site_id` for metering and (optional) plan enforcement.

---

## 17. Tenant Onboarding Flow

1. Create **site** in admin (name, domain, color).
2. Configure white-label (prompt, tone, booking URL, notifications).
3. Ingest website and/or upload files.
4. Add widget embed to customer site.
5. (Optional) Configure Twilio (`phone_numbers`), industry/protocols, Service Intelligence.
6. Validate chat, leads, and (if used) Service Requests/Estimates.

---

## 18. Security Checklist

- Keep `ADMIN_SECRET` secret; rotate if leaked.
- Never commit `.env`; use platform env (Render/Vercel).
- Validate Twilio webhook signatures in production.
- All tenant data filtered by `site_id`; `checkSiteAccess`; admin from `app_users.is_admin` only.
- Parameterized queries only; no string concatenation for SQL.

---

## 19. Troubleshooting

- **Twilio 20003:** Check SID/token length; no `whatsapp:` in `TWILIO_WHATSAPP_NUMBER`; trim whitespace in secrets.
- **Playwright/OOM:** `PLAYWRIGHT_BROWSERS_PATH=0`; reduce `INGEST_MAX_PAGES`/`INGEST_CONCURRENCY`.
- **PDFs not extracting:** Check `pdf-parse`; use admin “reprocess” for files.
- **Admin build (Vercel):** Ensure API route imports use correct relative path to `_utils/backend` (e.g. `../../../_utils/backend` from `api/service-requests/[site_id]/[request_id]/route.js`).

---

## 20. Documentation & Client Setup

- **docs/clients/README.md** — Overview of client setup guides; platform is generalized (any contractor).
- **docs/clients/ryans-roofing-raffy-setup.md** — Example: Ryan's Roofing (Ontario); same features apply to plumbing, HVAC, etc.

---

## 21. Common Development Tasks

### Add a tenant setting

1. Migration: add column or JSON on `sites`.
2. Backend services: read/write.
3. Admin UI: edit; widget config if needed.

### Add an ingestion type

1. Parser in file ingestion service; normalize text.
2. Reuse chunk + embed pipeline → `documents` with `site_id`.
3. Admin upload/reprocess UI.

### Add a Service Intelligence field

1. Migration: column on `service_requests`, `estimates`, or related table (with `site_id` where applicable).
2. Service layer: read/write; keep routes thin.
3. Admin: list/detail forms and API proxies.

### Add an API route (admin)

1. Backend route under `/api/admin` (or public); auth and `checkSiteAccess` for tenant data.
2. Admin Next.js API route in `admin/src/app/api/` proxying to backend with `requireBackendAuth`; use correct relative path to `_utils/backend` (count directory depth from route file to `api/`).
