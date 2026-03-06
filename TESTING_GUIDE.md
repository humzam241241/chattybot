# ChattyBot — Complete Testing Guide

**Use this document to test every feature of the ChattyBot platform.** Paste sections into ChatGPT or follow manually.

---

## Prerequisites

Before testing, ensure:
- **Backend** running (e.g. `http://localhost:3001` or your Render URL)
- **Admin dashboard** running (e.g. `http://localhost:3000` or your Vercel URL)
- **Widget** built and served (e.g. `http://localhost:5173` or your Vercel URL)
- **Database** (Supabase) with all migrations applied
- **Environment variables** set: `DATABASE_URL`, `OPENAI_API_KEY`, `ADMIN_SECRET`

Replace placeholders in examples:
- `{API_URL}` → your backend URL (e.g. `https://chattybot-backend.onrender.com`)
- `{ADMIN_URL}` → your admin URL (e.g. `https://chattybot-admin.vercel.app`)
- `{WIDGET_URL}` → your widget URL (e.g. `https://chattybot-widget.vercel.app`)
- `{SITE_ID}` → a valid site UUID from your database
- `{ADMIN_SECRET}` → your `ADMIN_SECRET` env var

---

## 1. Backend API — Health & Public Endpoints

### 1.1 Health Check
```
GET {API_URL}/health
```
**Expected:** `200` with JSON: `{ "status": "ok", "uptime": <number>, "ts": "<ISO date>" }`

### 1.2 Site Config (Public)
```
GET {API_URL}/site-config/{SITE_ID}
```
**Expected:** `200` with JSON containing `company_name`, `primary_color`, `tone`, `system_prompt`, etc. No auth required.

### 1.3 Chat (Public)
```
POST {API_URL}/chat
Content-Type: application/json

{
  "site_id": "{SITE_ID}",
  "message": "What services do you offer?",
  "visitor_id": "test-visitor-123",
  "conversation_id": null
}
```
**Expected:** `200` with `{ "reply": "<AI response>", "conversation_id": "<uuid>", ... }`

### 1.4 Chat Stream (Public)
```
POST {API_URL}/chat/stream
Content-Type: application/json

{
  "site_id": "{SITE_ID}",
  "message": "Tell me about pricing",
  "visitor_id": "test-visitor-456",
  "conversation_id": null
}
```
**Expected:** `200` with `Content-Type: text/event-stream` — SSE events with `data:` chunks containing the streamed reply.

### 1.5 Lead Capture (Public)
```
POST {API_URL}/lead
Content-Type: application/json

{
  "site_id": "{SITE_ID}",
  "email": "test@example.com",
  "name": "Test User",
  "message": "Interested in roof repair"
}
```
**Expected:** `200` with `{ "success": true }`. Lead should appear in admin Leads page.

---

## 2. Backend API — Admin Endpoints (Bearer Auth)

All admin requests require: `Authorization: Bearer {ADMIN_SECRET}`

### 2.1 List Sites
```
GET {API_URL}/api/admin/sites
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with `{ "sites": [...] }`

### 2.2 Create Site
```
POST {API_URL}/api/admin/sites
Authorization: Bearer {ADMIN_SECRET}
Content-Type: application/json

{
  "company_name": "Test Roofing Co",
  "domain": "example.com",
  "primary_color": "#6366f1",
  "tone": "friendly"
}
```
**Expected:** `200` with created site object including `id`.

### 2.3 Get Site
```
GET {API_URL}/api/admin/sites/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with site object.

### 2.4 Update Site
```
PUT {API_URL}/api/admin/sites/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
Content-Type: application/json

{
  "company_name": "Updated Name",
  "tone": "professional"
}
```
**Expected:** `200` with updated site.

### 2.5 Trigger Ingestion
```
POST {API_URL}/api/admin/ingest/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` — starts website crawl. Check admin for ingest status.

### 2.6 List Conversations
```
GET {API_URL}/api/admin/conversations/site/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with `{ "conversations": [...] }`

### 2.7 Get Conversation + Messages
```
GET {API_URL}/api/admin/conversations/{CONVERSATION_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with conversation and `messages` array.

### 2.8 List Leads
```
GET {API_URL}/api/admin/leads/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with `{ "leads": [...], "counts": { "hot", "warm", "cold", "total" } }`

### 2.9 Missed Leads
```
GET {API_URL}/api/admin/missed-leads/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with missed lead records.

### 2.10 Missed Lead Stats
```
GET {API_URL}/api/admin/missed-leads/{SITE_ID}/stats
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with stats (total, keywords, daily breakdown).

### 2.11 Weekly Reports
```
GET {API_URL}/api/admin/reports/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with `{ "reports": [...] }`

### 2.12 Analytics
```
GET {API_URL}/api/admin/analytics/{SITE_ID}?days=30
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with `conversations`, `leads`, `missed_leads`, `daily_breakdown`, `top_intents`, etc.

### 2.13 List Files
```
GET {API_URL}/api/admin/files/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `200` with files array.

### 2.14 RAG Evaluation
```
POST {API_URL}/api/admin/rag-eval/{SITE_ID}
Authorization: Bearer {ADMIN_SECRET}
Content-Type: application/json

{
  "queries": ["What services do you offer?", "How much does a roof repair cost?"]
}
```
**Expected:** `200` with evaluation results.

### 2.15 Unauthorized Access
```
GET {API_URL}/api/admin/sites
(no Authorization header)
```
**Expected:** `401` Unauthorized.

---

## 3. Admin Dashboard — UI Testing

### 3.1 Login / Access
- Open `{ADMIN_URL}` — if auth is required, enter credentials.
- Navigate to **Sites** — should see list of sites.

### 3.2 Sites
- **Create:** Click "+ New Site", fill form, submit. Site appears in list.
- **Edit:** Click a site → Chatbot Settings → change name/color/tone → Save.
- **Delete:** Delete a test site (optional).

### 3.3 Ingest
- Open a site → **Re-ingest Site** (or Ingest). Wait for completion. Verify documents in DB or that chat answers use ingested content.

### 3.4 Conversations
- Open **Conversations** for a site.
- **Left panel:** List of conversations (visitor_id, message count, date).
- **Right panel:** Click a conversation → full chat transcript.
- Verify summaries appear under visitor IDs (after worker runs).

### 3.5 Leads
- Open **Leads** for a site.
- Verify leads from POST /lead and from chat (lead extraction worker).
- **CSV Export:** Click Export CSV — file downloads with lead data.
- Verify HOT/WARM/COLD badges, phone, issue, "View Chat" link.

### 3.6 Missed Leads
- Open **Missed Leads** for a site.
- Verify list of potential missed opportunities (conversations with lead keywords but no contact).
- Check stats (total, top keywords, daily breakdown).

### 3.7 Analytics
- Open **Analytics** for a site.
- Verify: conversation stats, lead breakdown, conversion rate, daily activity, top intents.

### 3.8 Reports
- Open **Reports** for a site.
- Verify weekly reports list (may be empty until worker runs).
- Expand a report — see conversations, leads, top questions.

### 3.9 Files
- Open **Files** for a site.
- **Upload:** Upload a PDF/DOCX/XLSX. Verify it appears and processes.
- **Reprocess:** Click reprocess on a file.
- **Delete:** Delete a test file.

### 3.10 RAG Evaluation
- Open **RAG Evaluation** for a site.
- Run evaluation with sample queries. Verify accuracy scores and responses.

### 3.11 Settings
- Open **Settings** (or Chatbot Settings) for a site.
- Update intro message, suggested questions, booking URL, lead email. Save. Verify widget reflects changes.

---

## 4. Widget Testing

### 4.1 Embed
Create a test HTML file:
```html
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
  <h1>Test Page</h1>
  <script 
    src="{WIDGET_URL}/widget.js" 
    data-site-id="{SITE_ID}"
    data-api-url="{API_URL}">
  </script>
</body>
</html>
```
Open in browser. Chat bubble should appear.

### 4.2 Chat
- Click bubble → chat opens.
- Send: "Hello" — bot responds.
- Send: "What do you offer?" — RAG-powered answer (if ingested).
- Verify streaming (text appears gradually).

### 4.3 Lead Capture
- In chat, express interest: "I need a roof repair quote" or "Can someone call me?"
- Bot may prompt for email/phone.
- Provide email/phone in chat — verify lead appears in admin Leads.

### 4.4 Lead Form
- If widget has lead form CTA, fill and submit. Verify lead in admin.

### 4.5 Branding
- Verify widget uses site's `primary_color` and company name.

---

## 5. Background Workers

### 5.1 Run Scheduler
```bash
cd backend
node workers/index.js
```
**Expected:** Logs `[WorkerScheduler] initialized` and schedules for each worker.

### 5.2 Lead Extractor (Manual)
```bash
cd backend
node workers/leadExtractor.js
```
**Expected:** Logs polling, processes conversations with 4+ messages, extracts leads. Exits with code 0.

### 5.3 Summarize Worker (Manual)
```bash
cd backend
node workers/summarizeWorker.js
```
**Expected:** Processes pending summary jobs and idle conversations. Exits with code 0.

### 5.4 Missed Lead Worker (Manual)
```bash
cd backend
node workers/missedLeadWorker.js
```
**Expected:** Scans for missed opportunities, logs findings. Exits with code 0.

### 5.5 Weekly Report Worker (Manual)
```bash
cd backend
node workers/weeklyReportWorker.js
```
**Expected:** Generates reports per site, sends emails if SMTP configured. Exits with code 0.

---

## 6. End-to-End Flow

### 6.1 Full Chat → Lead → Admin Flow
1. Create a site in admin.
2. Ingest the site (or upload a file).
3. Embed widget on test page.
4. Chat: "I have a roof leak, email me at test@example.com"
5. Wait for lead extractor (or run manually).
6. In admin: Leads → verify lead with email, HOT/WARM rating.
7. In admin: Conversations → verify full transcript and summary.

### 6.2 Missed Lead Flow
1. Chat without providing email/phone: "I need a repair quote" (3+ messages).
2. Wait 5+ minutes (or adjust worker logic for testing).
3. Run missed lead worker.
4. In admin: Missed Leads → verify entry.

### 6.3 Weekly Report Flow
1. Ensure site has `report_email` or `LEAD_NOTIFICATION_EMAIL`.
2. Run weekly report worker (or wait for Sunday).
3. Check email for report.
4. In admin: Reports → verify report stored.

---

## 7. Error Cases

### 7.1 Invalid Site ID
```
GET {API_URL}/site-config/00000000-0000-0000-0000-000000000000
```
**Expected:** `404` or empty/error response.

### 7.2 Invalid Conversation ID
```
GET {API_URL}/api/admin/conversations/00000000-0000-0000-0000-000000000000
Authorization: Bearer {ADMIN_SECRET}
```
**Expected:** `404` or appropriate error.

### 7.3 Rate Limiting
- Send 35+ chat requests in 1 minute from same IP.
- **Expected:** `429` Too Many Requests (if rate limit enforced).

### 7.4 Large Payload
```
POST {API_URL}/chat
Body: { "site_id": "...", "message": "<2MB of text>" }
```
**Expected:** Rejected (1MB limit).

---

## 8. Database Verification

Run in Supabase SQL Editor:

```sql
-- Tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sites', 'conversations', 'messages', 'leads', 'documents', 'missed_leads', 'weekly_reports', 'conversation_summary_jobs', 'files', 'global_settings');
-- Expected: 10 rows

-- Sample data
SELECT COUNT(*) FROM sites;
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM leads;
```

---

## 9. Checklist Summary

| Area | Test | Pass? |
|------|------|-------|
| Backend | Health check | ☐ |
| Backend | Site config (public) | ☐ |
| Backend | Chat (non-stream) | ☐ |
| Backend | Chat (stream) | ☐ |
| Backend | Lead capture | ☐ |
| Backend | Admin sites CRUD | ☐ |
| Backend | Admin ingest | ☐ |
| Backend | Admin conversations | ☐ |
| Backend | Admin leads | ☐ |
| Backend | Admin missed leads | ☐ |
| Backend | Admin reports | ☐ |
| Backend | Admin analytics | ☐ |
| Backend | Admin files | ☐ |
| Backend | Admin RAG eval | ☐ |
| Admin UI | All pages load | ☐ |
| Admin UI | Create/edit site | ☐ |
| Admin UI | Conversations two-panel | ☐ |
| Admin UI | Leads + CSV export | ☐ |
| Admin UI | Missed leads, analytics, reports | ☐ |
| Widget | Embed + chat | ☐ |
| Widget | Streaming + lead capture | ☐ |
| Workers | All 4 workers run without error | ☐ |
| E2E | Chat → lead → admin | ☐ |

---

## ChatGPT Prompt (Paste This)

```
You are testing the ChattyBot platform. Use the TESTING_GUIDE.md instructions.

Given:
- API_URL: [your backend URL]
- ADMIN_URL: [your admin URL]
- WIDGET_URL: [your widget URL]
- SITE_ID: [your site UUID]
- ADMIN_SECRET: [your secret]

Perform these tests in order:
1. Health check (GET /health)
2. Site config (GET /site-config/:site_id)
3. Chat (POST /chat) and Chat stream (POST /chat/stream)
4. Lead capture (POST /lead)
5. Admin endpoints with Bearer token (sites, conversations, leads, missed-leads, reports, analytics)
6. Report any failures with status code and response body.

For each test, state: PASS or FAIL, and if FAIL, the error details.
```
