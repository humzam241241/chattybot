## ChattyBot

ChattyBot is a **multi-tenant, white-label AI chatbot platform**. It lets you create a “site” (tenant), ingest that site’s content (website + files), then embed a branded chat widget on the customer’s website. The backend uses **RAG (retrieval-augmented generation)** over **pgvector** embeddings and generates answers via OpenAI.

This `README.md` is intended to be the **single source of truth** for engineers onboarding to the repository (architecture, setup, deployment, operations).

> You’ll see “raffy” in code and DB fields. That’s historical naming; it represents per-site chatbot configuration.

---

## 1. Product Overview

ChattyBot provides:

- **Embeddable widget** that can be installed on any customer website with a single `<script>` tag.
- **RAG chatbot** with multi-turn conversation history and streaming responses (SSE).
- **Website ingestion** via Playwright crawling (multi-page, SPA-friendly).
- **File ingestion** (PDF/DOCX/XLSX) with extracted text persisted for reprocessing/debugging.
- **Lead intelligence**: lead scoring (HOT/WARM/COLD), extraction, missed-lead detection, notifications.
- **Twilio messaging**: inbound SMS/WhatsApp webhooks and outbound notifications.
- **White-label configuration**: per-site name, tone, colors, prompts, booking link, and behavior.
- **Admin + analytics dashboards** for site management and operational monitoring.

---

## 2. System Architecture

End-to-end flow:

```
Customer website
  → widget (embed script)
    → backend (Express)
      → Postgres + pgvector (Supabase)
        ↔ OpenAI (embeddings + chat completions)
```

High-level request path for chat:

1. Widget loads and fetches **site config** from the backend.
2. Widget sends user message to backend (`/chat` or `/chat/stream`).
3. Backend retrieves relevant chunks via pgvector similarity search (tenant scoped by `site_id`).
4. Backend calls OpenAI to generate a response using retrieved context.
5. Backend persists conversation/messages and returns the assistant response (streaming for SSE endpoints).

---

## 3. Monorepo Structure

```
chattybot/
├── backend/          Express API + workers (deploy to Render)
├── widget/           Embeddable widget (Vite build → single JS bundle)
├── admin/            Admin dashboard (Next.js)
└── admin-dashboard/  Analytics dashboard (React)
```

- `backend/`: API, ingestion pipeline, RAG, Twilio webhooks, lead pipeline, workers.
- `widget/`: chat bubble + UI, bundled to a single `widget.js` for customer sites.
- `admin/`: manages sites, ingestion, files, conversations, leads, settings.
- `admin-dashboard/`: analytics UI (stats, transcripts, operational views).

---

## 4. Core Features

- **RAG chat**
  - Context retrieval from pgvector embeddings
  - Streaming responses (SSE) and non-streaming endpoints
  - Conversation logging (`conversations`, `messages`)
- **Website crawler**
  - Playwright-based crawling, domain-limited
  - Chunking + embedding pipeline for discovered content
- **File ingestion**
  - PDF/DOCX/XLSX extraction → chunking → embeddings
  - Extracted text stored in `files.extracted_text`
- **Lead intelligence**
  - AI extraction + scoring
  - Missed-lead detection and reconciliation
  - Notifications (email + optional SMS/WhatsApp)
- **Twilio messaging**
  - Inbound SMS/WhatsApp webhooks (TwiML replies)
  - Outbound sends from notification pipeline (Twilio REST API)
- **White-label configuration**
  - Per-site branding (colors, company name)
  - Per-site behavior via system prompt + “raffy overrides”
- **Analytics**
  - Conversation summaries and lead extraction workers
  - Dashboards for stats and transcripts

---

## 5. Multi-Tenant Model

Tenant = **Site**.

- **Tenant key**: `site_id` (UUID)
- **Isolation rule**: any query touching tenant data (conversations, messages, leads, files, documents, usage) must filter by `site_id`.
- **Authorization**: enforced on the backend
  - Site access must go through `checkSiteAccess(user, siteId)`
  - Admin privileges come only from `app_users.is_admin`

This repo follows a “thin routes, service layer” pattern: routes validate input and call services; business logic lives in `backend/src/services`.

---

## 6. Database Overview

Major tables you’ll interact with:

- `sites`: tenant configuration (domain, branding, prompts, overrides)
- `conversations`: one conversation thread per visitor (tenant scoped)
- `messages`: chat messages for a conversation
- `files`: uploaded files (includes `extracted_text`)
- `documents`: embedding “chunks” stored as `vector(...)` with `site_id`
- `leads`: extracted lead records + scoring metadata
- `phone_numbers`: maps inbound Twilio numbers → `site_id` (supports multiple numbers per site)
- `api_usage`: API usage metering per site
- `sms_usage`: SMS/WhatsApp usage metering per site
- `app_users`: authenticated users; `is_admin` controls admin privileges

Embeddings / pgvector:

- The repo stores chunk embeddings in `documents.embedding` (pgvector).
- Similarity search is used to retrieve context per request, always scoped by `site_id`.

Note on `file_chunks`:

- Some systems use a separate `file_chunks` table; **this repo currently uses `documents` for stored chunks/embeddings** (both web + file-sourced content ultimately becomes “documents” for retrieval).

Migrations:

- SQL migrations live in `backend/migrations/` and should be applied in order.
- Recent notable migrations include:
  - `011_usage_tracking.sql` (usage tables)
  - `018_files_extracted_text.sql` (persist extracted file text)
  - `019_phone_numbers.sql` (multi-number Twilio routing)
  - `020_conversations_user_phone.sql` (Twilio conversation persistence)

---

## 7. Environment Variables

### Backend (`backend/.env`)

**Required (core functionality):**

- `DATABASE_URL` — Postgres connection string (Supabase recommended)
- `OPENAI_API_KEY` — OpenAI API key
- `ADMIN_SECRET` — backend admin bearer token

**Common optional:**

- `PORT` — defaults to `3001`
- `NODE_ENV` — set to `production` in production
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist for admin origins

**Ingestion / Playwright (Render compatibility):**

- `INGEST_MAX_PAGES` — cap crawl size (Render-safe defaults are often `10`)
- `INGEST_CONCURRENCY` — crawler concurrency
- `PLAYWRIGHT_BROWSERS_PATH=0` — required on Render
- `NODE_OPTIONS=--max-old-space-size=512` — optional memory cap

**Supabase storage (file uploads):**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

**Twilio (optional):**

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` — **SMS sender** (E.164), e.g. `+19187719609`
- `TWILIO_WHATSAPP_NUMBER` — **WhatsApp sender** (**bare E.164**), e.g. `+14155238886`
- `TWILIO_DEFAULT_SITE_ID` — dev convenience fallback site
- `ALLOW_TWILIO_DEFAULT_FALLBACK` — set `true` to allow default fallback in production (otherwise unmapped numbers won’t respond)

**Lead notifications (optional):**

- `LEAD_NOTIFICATION_EMAIL` — fallback owner email

### Admin (`admin/.env` / `.env.local`)

The repo includes `admin/.env.example` with the definitive list. Typical keys:

- `NEXT_PUBLIC_API_URL` — backend URL (public)
- `NEXT_PUBLIC_WIDGET_URL` — widget URL used for embed code generator (public)
- `BACKEND_URL` — server-side backend URL (Next.js API routes)
- `ADMIN_SECRET` — must match backend `ADMIN_SECRET`

### Widget (`widget/.env` optional)

- `VITE_DEFAULT_API_URL` — default backend URL (can be overridden by `data-api-url` in the embed snippet)

### Analytics dashboard (`admin-dashboard/.env`)

- `REACT_APP_API_URL`
- `REACT_APP_ADMIN_SECRET`

---

## 8. Local Development Setup

### Database

1. Create a Supabase project (or Postgres).
2. Enable `vector` extension.
3. Apply migrations from `backend/migrations/` in order (Supabase SQL editor).

### Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend runs on `http://localhost:3001`.

### Admin (Next.js)

```bash
cd admin
npm install
copy .env.example .env
npm run dev
```

Admin runs on `http://localhost:3000`.

### Widget

```bash
cd widget
npm install
npm run build
```

Build output: `widget/dist/widget.js`.

### Analytics dashboard (optional)

```bash
cd admin-dashboard
npm install
npm start
```

---

## 9. Widget Embed Instructions

Paste the following before `</body>` on the customer site:

```html
<script
  src="https://YOUR_WIDGET_HOST/widget.js"
  data-site-id="YOUR_SITE_UUID"
  data-api-url="https://YOUR_BACKEND_HOST">
</script>
```

---

## 10. Twilio Setup

### Inbound webhook routing

Inbound webhooks are public endpoints:

- `POST /webhooks/twilio/sms`
- `POST /webhooks/twilio/whatsapp`

Inbound messages route to a tenant using the destination number (`To`):

- Primary mapping: `phone_numbers(phone_number, channel, site_id)`
- Backward compatibility: `sites.twilio_phone` and `sites.twilio_whatsapp`

### `phone_numbers` table

The `phone_numbers` table exists to support **multiple numbers per site**:

- `phone_number` (E.164)
- `channel` (`sms` or `whatsapp`)
- `site_id` (tenant)

### Outbound notifications

Outbound sends are only performed by the notification pipeline (not the Twilio webhook reply flow).

Code path:

- shared client: `backend/src/services/twilioClient.js`
- outbound send wrapper: `backend/src/services/notificationService.js`

### WhatsApp formatting rules (critical)

- Twilio WhatsApp addressing uses `whatsapp:+E164`.
- **Environment variable must be bare E.164**:

```bash
TWILIO_WHATSAPP_NUMBER=+14155238886
```

The code adds the `whatsapp:` prefix when sending.

---

## 11. File Ingestion Pipeline

At a high level:

1. Admin uploads a file (`files` row created).
2. Backend extracts text based on MIME type:
   - PDF → `pdf-parse`
   - DOCX → docx extraction
   - XLSX → sheet-to-text extraction
3. Extracted text is persisted to `files.extracted_text`.
4. Text is chunked and embedded via OpenAI embeddings.
5. Embeddings are stored in `documents` (pgvector) and scoped by `site_id`.

---

## 12. Deployment

### Backend (Render)

- Service type: Web Service
- Root directory: `backend`
- Build: `npm install`
- Start: `npm start`
- Set env vars in Render dashboard (see section 7)

Render notes for ingestion:

- Set `PLAYWRIGHT_BROWSERS_PATH=0`
- Consider setting `NODE_OPTIONS=--max-old-space-size=512`
- Consider lowering `INGEST_MAX_PAGES` (free-tier memory)

### Admin (Vercel)

- Deploy `admin/`
- Configure environment variables in Vercel project settings

### Widget (Vercel or CDN)

- Deploy `widget/` build output (`dist/`)
- Ensure `widget.js` is accessible at a stable URL for customer embed snippets

### Analytics dashboard (Vercel, optional)

- Deploy `admin-dashboard/`
- Set `REACT_APP_API_URL` + `REACT_APP_ADMIN_SECRET`

---

## 13. Workers / Background Jobs

The backend includes scheduled/background workers for:

- **Conversation summaries** — generates summaries for idle/eligible conversations
- **Lead extraction** — extracts structured lead data from conversation history
- **Missed lead detection** — flags conversations with lead intent but missing contact info
- **Weekly reports** — aggregates weekly stats and sends site reports
- **Data reconciliation** — periodic recovery of missed/partial lead data

Operational options:

- **PM2** using `ecosystem.config.js`
- **External cron** running worker scripts on a schedule

---

## 14. Usage Tracking

Usage tracking is stored in:

- `api_usage` — tracks API usage per `site_id` (metering)
- `sms_usage` — tracks inbound/outbound SMS/WhatsApp usage per `site_id`

These tables are used for monitoring, reporting, and (if enabled) plan enforcement.

---

## 15. Tenant Onboarding Flow

Typical steps to onboard a new customer:

1. Create a **site** in the admin dashboard (company name, domain, brand color).
2. Configure **white-label settings** (tone, system prompt, suggested questions, booking URL).
3. Set up content:
   - Run **website ingestion** (Playwright crawl), and/or
   - Upload **files** (PDF/DOCX/XLSX)
4. Copy/paste the **widget embed snippet** into the customer’s website.
5. Validate:
   - widget loads
   - chat responds
   - conversation appears in admin dashboards
6. (Optional) Configure communications:
   - owner notification email
   - Twilio phone routing (`phone_numbers`) for SMS/WhatsApp

---

## 16. Security Checklist

- **Admin auth**
  - Keep `ADMIN_SECRET` secret and rotate if leaked
  - Ensure admin routes require backend authentication
- **Secrets management**
  - Never commit `.env`
  - Store secrets in Render/Vercel env settings
- **Twilio validation**
  - Validate webhook signatures in production
  - Route inbound numbers only through `phone_numbers` (avoid ambiguous fallbacks)
- **Tenant isolation**
  - Every customer query must include `site_id` filtering
  - No frontend-based permission trust; enforce on backend
- **SQL safety**
  - Parameterized queries only; no string concatenation

---

## 17. Troubleshooting

### Twilio outbound `20003 Authenticate`

Check backend logs for:

- `[Twilio] SID length: 34`
- `[Twilio] TOKEN length: 32`

Common causes:

- Render env vars not matching what you tested locally
- Hidden whitespace in secrets (trimmed in code, but still validate lengths)
- `TWILIO_WHATSAPP_NUMBER` incorrectly includes `whatsapp:` (should be **bare E.164**)

### Playwright ingestion failures / OOM on Render

- Ensure `PLAYWRIGHT_BROWSERS_PATH=0`
- Reduce `INGEST_MAX_PAGES` and/or `INGEST_CONCURRENCY`
- Increase memory plan if ingestion workload is large

### PDFs not extracting

- Confirm `pdf-parse` is installed and the backend logs show non-zero extracted text length.
- Use the admin “reprocess” action for files to regenerate embeddings after fixes.

