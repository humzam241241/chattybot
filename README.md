# ChattyBot

Multi-tenant, white-label AI chatbot platform (backend + embeddable widget + admin UI + analytics UI).

This README replaces all prior project documentation. It is intended to be the **single source of truth** for setup, configuration, deployment, and operations.

---

## Monorepo layout

```
chattybot/
├── backend/          Express API + workers (Render)
├── widget/           Embeddable chat widget (Vite → single JS bundle; Vercel/CDN)
├── admin/            Admin dashboard (Next.js; Vercel)
└── admin-dashboard/  Analytics dashboard (React; Vercel)
```

---

## What the platform does

- **Website + file knowledge base** per tenant (`site_id`)
  - Website crawling via Playwright
  - File ingestion (PDF/DOCX/XLSX) → text extraction → chunking → embeddings → pgvector retrieval
- **Chat**: normal and streaming responses (SSE) using RAG context
- **Lead intelligence**: scoring, extraction, notifications, missed-lead detection, reconciliation
- **Twilio**: inbound SMS/WhatsApp webhooks + outbound notification pipeline
- **White-label**: per-site branding + behavior via site configuration (historically named “raffy” in code)

---

## Prerequisites

- **Node.js 18+**
- **PostgreSQL** (Supabase recommended) with **pgvector** enabled
- **OpenAI API key**
- (Optional) **Twilio** account for SMS/WhatsApp
- (Optional) **Supabase Storage** for file uploads

---

## Local development (Windows/PowerShell friendly)

### 1) Database

- Create a Supabase project (or any Postgres).
- Enable pgvector (Supabase: Database → Extensions → enable `vector`).
- Run SQL migrations in order from `backend/migrations/` (Supabase SQL editor).

### 2) Backend (API + workers)

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend default: `http://localhost:3001`

### 3) Admin dashboard (Next.js)

```bash
cd admin
npm install
copy .env.example .env
npm run dev
```

Admin default: `http://localhost:3000`

### 4) Widget (embeddable)

```bash
cd widget
npm install
npm run build
```

Output: `widget/dist/widget.js`

### 5) Analytics dashboard (optional)

```bash
cd admin-dashboard
npm install
npm start
```

---

## Embed snippet (customer site)

```html
<script
  src="https://YOUR_WIDGET_HOST/widget.js"
  data-site-id="YOUR_SITE_UUID"
  data-api-url="https://YOUR_BACKEND_HOST">
</script>
```

The widget fetches site branding/config from the backend and then sends chat messages to the backend API.

---

## Environment variables

### Backend (`backend/.env`)

**Required (core):**

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `ADMIN_SECRET`

**Common optional:**

- `ALLOWED_ORIGINS` (comma separated; admin origins)
- `INGEST_MAX_PAGES` (Render-safe default is often `10`)
- `INGEST_CONCURRENCY`
- `PLAYWRIGHT_BROWSERS_PATH=0` (Render)
- `NODE_OPTIONS=--max-old-space-size=512` (Render memory)

**Supabase storage (file uploads):**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

**Twilio (inbound webhooks + outbound notifications):**

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (SMS sender, e.g. `+19187719609`)
- `TWILIO_WHATSAPP_NUMBER` (WhatsApp sender, **bare E.164**, e.g. `+14155238886`)
- `TWILIO_DEFAULT_SITE_ID` (dev convenience; production fallback is gated)
- `ALLOW_TWILIO_DEFAULT_FALLBACK` (`true` to allow default fallback in production; otherwise unmapped numbers will not respond)

**Lead notifications:**

- `LEAD_NOTIFICATION_EMAIL` (fallback owner email)

### Admin (`admin/.env`)

You’ll see an `.env.example` in `admin/` with the exact keys expected by this repo. Typical:

- `NEXT_PUBLIC_API_URL` (backend URL)
- `NEXT_PUBLIC_WIDGET_URL` (widget URL used for embed code generator)
- `BACKEND_URL` (server-side API proxy base)
- `ADMIN_SECRET` (must match backend)
- Supabase public env (if enabled in your admin build)

### Analytics dashboard (`admin-dashboard/.env`)

- `REACT_APP_API_URL`
- `REACT_APP_ADMIN_SECRET`

---

## Multi-tenant model (critical)

- Customer data is tenant isolated by **`site_id`**
- Any query for leads/conversations/files/analytics must filter by `site_id`
- Backend authorization uses `checkSiteAccess(user, siteId)` and admin privileges only from `app_users.is_admin`

---

## Twilio setup (SMS + WhatsApp)

### Inbound (webhooks)

- Webhook base path: `/webhooks/twilio`
- Endpoints:
  - `POST /webhooks/twilio/sms`
  - `POST /webhooks/twilio/whatsapp`

### Routing inbound numbers to tenants

Inbound messages are routed by the destination number (`To`) to a tenant (`site_id`).

- Primary routing table: `phone_numbers(phone_number, channel, site_id)`
- Backward-compat: `sites.twilio_phone` and `sites.twilio_whatsapp`

### Outbound (notifications)

Outbound messages are sent from `backend/src/services/notificationService.js` using the shared Twilio client in `backend/src/services/twilioClient.js`.

**Important WhatsApp rule:** `TWILIO_WHATSAPP_NUMBER` must be **bare E.164** (no `whatsapp:` prefix). The code adds the prefix.

---

## File ingestion

- Uploads are handled by backend admin routes.
- Extracted text is persisted to `files.extracted_text` (used for debugging and reprocessing).

Supported types:
- PDF
- DOCX
- XLSX

---

## Deployment (recommended)

### Backend → Render

- Render Web Service
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Set env vars in Render dashboard (see “Environment variables” above)

Notes for ingestion on Render:
- Set `PLAYWRIGHT_BROWSERS_PATH=0`
- Consider `NODE_OPTIONS=--max-old-space-size=512`
- Consider lowering `INGEST_MAX_PAGES` for free-tier memory

### Admin → Vercel

- Deploy `admin/`
- Set env vars in Vercel project settings

### Widget → Vercel / CDN

- Deploy `widget/` build output (dist)

### Analytics dashboard → Vercel (optional)

- Deploy `admin-dashboard/`
- Set `REACT_APP_API_URL` and `REACT_APP_ADMIN_SECRET`

---

## Operations / workers

The backend includes scheduled workers (summaries, lead extraction, missed lead detection, weekly reports, reconciliation).

Production options:
- **PM2** using `ecosystem.config.js`
- **External cron** calling node scripts on a schedule
- **Always-on scheduler** (if enabled in `backend/workers/index.js` for your deployment)

---

## Troubleshooting

### Twilio outbound `20003 Authenticate`

Check backend logs for:
- `[Twilio] SID length: 34`
- `[Twilio] TOKEN length: 32`

Common causes:
- Wrong credentials in the runtime environment (Render env vs local env)
- Hidden whitespace (now trimmed)
- WhatsApp sender env includes `whatsapp:` (must be bare E.164)

### Playwright failures / OOM on Render

- Ensure `PLAYWRIGHT_BROWSERS_PATH=0`
- Reduce `INGEST_MAX_PAGES` and/or `INGEST_CONCURRENCY`
- Increase memory plan if needed

---

## Security notes

- Never commit secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `ADMIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Twilio token)
- Admin auth is backend-enforced
- Tenant isolation is backend-enforced

