## Chatbot audit against checklist

Repo: `chattybot` (backend: Express + Postgres/Supabase + OpenAI, widget: React/Vite, admin: Next.js)

### Checklist status

#### AI-015 — knowledge base ingestion
- **Status**: **COMPLETE**
- **Evidence**:
  - Website ingestion (Playwright crawl → chunk/embed → `documents`): `backend/src/routes/ingest.js`
  - File ingestion (PDF/DOCX/XLSX upload → extract → chunk/embed → `documents`): `backend/src/routes/files.js`, `backend/src/services/fileExtract.js`

#### AI-016 — system prompt + personality
- **Status**: **COMPLETE**
- **Evidence**:
  - System prompt builder + injected KB context: `backend/src/services/rag.js`
  - Personality / guardrails / escalation / emergency behavior via merged Raffy settings: `backend/src/services/raffySettings.js`, applied in `backend/src/routes/chat.js`

#### AI-017 — chat endpoint
- **Status**: **COMPLETE**
- **Evidence**: `POST /chat` (also `/api/chat`) in `backend/src/routes/chat.js`

#### AI-018 — intent classifier
- **Status**: **COMPLETE** (rule-based MVP)
- **Implementation added**:
  - `intent` field returned by `POST /chat` (values: `kb | booking | escalation | emergency`)
  - Stream endpoint sends `intent` in `meta` event
- **Evidence**: `backend/src/routes/chat.js`

#### AI-019 — escalation fallback
- **Status**: **COMPLETE**
- **Evidence**:
  - Escalation keyword triggers + lead capture flag: `backend/src/routes/chat.js` (`should_capture_lead`)
  - Lead capture endpoint: `backend/src/routes/leads.js`

#### AI-020 — test suite
- **Status**: **COMPLETE** (minimal)
- **Implementation added**:
  - Jest config + 2 unit test files
  - `npm test` in `backend/` runs the suite
- **Evidence**: `backend/jest.config.js`, `backend/tests/*.test.js`, `backend/package.json`

#### AI-021 — floating chat widget
- **Status**: **COMPLETE**
- **Evidence**: `widget/src/components/ChatBubble.jsx`, `widget/src/App.jsx`, `widget/src/styles.js`

#### AI-022 — streaming responses (websocket or equivalent)
- **Status**: **COMPLETE** (SSE over HTTP)
- **Implementation added**:
  - `POST /chat/stream` SSE endpoint (also `/api/chat/stream` via router mount)
  - Widget consumes SSE stream and renders tokens progressively; falls back to non-streaming if unavailable
- **Evidence**: `backend/src/routes/chat.js` (`/stream`), `widget/src/components/ChatWindow.jsx`

#### AI-023 — chat UI with message history
- **Status**: **COMPLETE**
- **Evidence**:
  - Widget keeps message history in component state and displays transcript: `widget/src/components/ChatWindow.jsx`
  - Backend logs conversations/messages with rolling summaries (admin viewable): `backend/src/services/conversationLog.js`, `backend/src/routes/conversations.js`, admin pages under `admin/src/app/sites/[id]/conversations/`

#### AI-024 — quick reply chips
- **Status**: **COMPLETE**
- **Implementation added**:
  - Suggested question chips in widget (shown at start)
  - Server exposes suggested questions via public `/site-config/:site_id`
- **Evidence**: `widget/src/components/ChatWindow.jsx`, `backend/src/routes/siteConfig.js`, `widget/src/styles.js`

#### AI-025 — intro message + suggested questions
- **Status**: **COMPLETE**
- **Implementation added**:
  - `intro_message` and `suggested_questions` delivered by `/site-config/:site_id` and used by widget
  - Admin UI fields to set per-site values via `raffy_overrides.ui.*`
- **Evidence**: `backend/src/routes/siteConfig.js`, `widget/src/components/ChatWindow.jsx`, `admin/src/app/sites/[id]/page.js`

#### AI-026 — rate limiting
- **Status**: **COMPLETE**
- **Evidence**: `backend/src/middleware/rateLimiter.js` applied to chat/ingest/leads and other routes

#### AI-027 — booking link integration
- **Status**: **COMPLETE**
- **Implementation added**:
  - Booking URL exposed via `/site-config/:site_id` (`booking_url`)
  - When booking intent is detected, backend returns `should_offer_booking` + `booking_url`
  - Widget shows a “Book a call” CTA button opening the booking URL
- **Evidence**: `backend/src/routes/chat.js`, `backend/src/routes/siteConfig.js`, `widget/src/components/ChatWindow.jsx`, `admin/src/app/sites/[id]/page.js`

#### AI-028 — contact form → email notification
- **Status**: **COMPLETE** (SMTP-based; provider-agnostic)
- **Implementation added**:
  - Lead capture sends email notification when SMTP env vars are configured and `raffy_overrides.notifications.lead_email` is set
  - Lead saving remains successful even if email fails (non-fatal)
- **Evidence**: `backend/src/routes/leads.js`, `backend/src/services/mailer.js`, `backend/.env.example`, `admin/src/app/sites/[id]/page.js`

#### AI-029 — booking intent trigger
- **Status**: **COMPLETE** (keyword-based MVP)
- **Evidence**: `backend/src/routes/chat.js` (`detectBookingIntent`, `should_offer_booking`)

---

### System validation (manual)

#### chatbot can answer KB questions
- Create a site in Admin, set domain, click “Re-ingest Site”.
- Ask a question that is answered by site content.
- Expected: response references ingested content; `context_used` > 0 (in `/chat` JSON) or present in `/chat/stream` `meta`.

#### booking flow works
- In Admin → Site → set **Booking Link URL** (e.g. Cal.com).
- Ask: “Can I book a call?”.
- Expected: widget shows **Book a call** button and it opens the booking URL.

#### emergency escalation works
- Ensure site uses default emergency keywords (or set custom ones in `raffy_overrides.emergency`).
- Ask an emergency phrase.
- Expected: fixed emergency response (no LLM call) and intent `emergency`.

#### chat UI sends and receives messages
- Open the widget, send any message.
- Expected: user bubble appears; bot response streams (if `/chat/stream` available) or falls back to non-streaming `/chat`.

---

### Configuration notes (new / touched)

- Backend SMTP (optional, for AI-028): see `backend/.env.example` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- Per-site widget + booking + notifications settings are stored in `sites.raffy_overrides`:
  - `ui.intro_message`
  - `ui.suggested_questions` (array)
  - `booking.url`
  - `notifications.lead_email`

