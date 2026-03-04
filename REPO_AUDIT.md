# Repository Audit — ChattyBot Platform

**Date**: March 4, 2026  
**Scope**: Full stack audit (backend, widget, admin)

---

## Current System Status

### ✅ Core Features (Complete)

#### Backend
- [x] Multi-tenant chat API (`POST /chat`, `POST /chat/stream`)
- [x] RAG pipeline (chunk → embed → pgvector → retrieve → GPT)
- [x] Website ingestion (Playwright headless crawler)
- [x] File ingestion (PDF/DOCX/XLSX → extract → embed)
- [x] Conversation logging + rolling summaries
- [x] Lead capture with optional SMTP notifications
- [x] Lead intelligence (scoring + auto-notify business owner)
- [x] Raffy settings (personality/guardrails/emergency/escalation)
- [x] Rate limiting, domain verification, tenant isolation
- [x] Admin authentication (Bearer token)
- [x] Streaming responses (SSE)
- [x] Intent classification (kb|booking|escalation|emergency)
- [x] Booking link integration
- [x] Quick reply chips + suggested questions
- [x] Database migrations (001, 002, 003)
- [x] Test suite (Jest + chunker/settings unit tests)
- [x] **NEW**: RAG evaluation system (`test:rag`)

#### Widget
- [x] Floating chat bubble
- [x] Chat window with message history
- [x] Lead capture form (inline)
- [x] Streaming response support (SSE)
- [x] Quick reply chips
- [x] Booking CTA button
- [x] Shadow DOM CSS isolation
- [x] IIFE bundle (single `<script>` tag)
- [x] Branded (company name, color, intro message)

#### Admin Dashboard
- [x] Site CRUD (create, edit, delete)
- [x] Site config (color, tone, system prompt, domain)
- [x] Content ingestion trigger (manual)
- [x] Leads list + export
- [x] Files upload/list/reprocess/delete
- [x] Conversations list + transcript viewer
- [x] Widget settings (intro, suggested questions, booking URL, lead email)
- [x] Embed code generator

---

## Missing Features (Identified in Audit)

### High Priority (User Experience)

#### Admin Dashboard UI Gaps
1. **RAG Evaluation Results Viewer**
   - [ ] View past evaluation reports
   - [ ] Display accuracy trends over time
   - [ ] Show failing questions for debugging
   - [ ] Trigger new evaluation from UI

2. **Lead Intelligence Dashboard**
   - [ ] View lead score/rating in conversations list
   - [ ] Filter by HOT/WARM/COLD rating
   - [ ] Lead summary email preview
   - [ ] Lead analytics (score distribution, response time)

3. **Settings Management UI**
   - [ ] Global Raffy settings editor (currently DB-only)
   - [ ] Per-site override UI (currently manual JSON edit)
   - [ ] Emergency keywords + response editor
   - [ ] Escalation triggers editor
   - [ ] Guardrails editor

4. **Knowledge Base Management**
   - [ ] View ingested chunks per site
   - [ ] Search/filter chunks by content
   - [ ] Delete/edit individual chunks
   - [ ] Chunk quality metrics (embedding coverage, duplicates)
   - [ ] Re-embed specific documents

5. **Analytics Dashboard**
   - [ ] Chat volume over time
   - [ ] Intent distribution chart
   - [ ] Average response time
   - [ ] Lead conversion funnel
   - [ ] Top questions asked

6. **Notification Settings**
   - [ ] UI for SMTP configuration test
   - [ ] Preview email templates
   - [ ] Email delivery status/logs

7. **User Management** (currently no multi-user support)
   - [ ] Admin user accounts
   - [ ] Role-based access (owner, editor, viewer)
   - [ ] Audit log (who changed what, when)

### Medium Priority (Developer Experience)

8. **Debug Tools**
   - [ ] Live chat testing from admin panel
   - [ ] Vector search debugger (show retrieved chunks)
   - [ ] Prompt debugger (show full system prompt)
   - [ ] Embedding visualizer

9. **Deployment Health**
   - [ ] Backend health dashboard (uptime, response time)
   - [ ] Database connection status
   - [ ] OpenAI API status
   - [ ] SMTP connection test

10. **Documentation**
    - [ ] Interactive API docs (Swagger/OpenAPI)
    - [ ] Video tutorials for setup
    - [ ] Troubleshooting guide

### Low Priority (Future Enhancements)

11. **Monetization**
    - [ ] Billing/subscription management
    - [ ] Usage metering (messages/month)
    - [ ] Plan tiers (Basic/Pro/Enterprise)

12. **Collaboration**
    - [ ] Team workspaces
    - [ ] Shared sites
    - [ ] Comments on conversations

13. **Integrations**
    - [ ] Zapier webhook on lead capture
    - [ ] Slack notifications
    - [ ] CRM sync (HubSpot, Salesforce)

---

## Technical Debt

### Code Quality
- [ ] Move adminAuth from simple Bearer to JWT
- [ ] Add API versioning (`/v1/chat`)
- [ ] Refactor routes into route groups
- [ ] Add OpenAPI spec generation
- [ ] Add more comprehensive tests (integration, E2E)

### Performance
- [ ] Add Redis caching for site configs
- [ ] Implement connection pooling optimization
- [ ] Add CDN for widget.js
- [ ] Optimize embedding batch size dynamically

### Security
- [ ] Add CSRF tokens for admin mutations
- [ ] Implement rate limit per tenant
- [ ] Add webhook signature verification
- [ ] SQL injection audit (prepared statements used, but worth review)
- [ ] Add security headers audit tool

### Scalability
- [ ] Move ingestion locks from in-memory to Redis
- [ ] Add horizontal scaling support (stateless backend)
- [ ] Implement job queue for ingestion (Bull/BullMQ)
- [ ] Add database read replicas support

---

## Immediate Action Items (This Session)

We will implement:

1. ✅ RAG evaluation system (complete)
2. 🚧 Admin UI for RAG evaluation results
3. 🚧 Admin UI for lead intelligence (score/rating display)
4. 🚧 Admin UI for Raffy settings management
5. 🚧 Admin UI for knowledge base browsing

---

## Files Modified/Created This Session

### RAG Evaluation System
- `backend/tests/loadKnowledgeChunks.js` (new)
- `backend/tests/generateTestQuestions.js` (new)
- `backend/tests/runRagEvaluation.js` (new)
- `backend/package.json` (added `test:rag` script)

### Lead Intelligence
- `backend/src/services/leadScore.js` (new)
- `backend/src/services/transcript.js` (new)
- `backend/src/services/leadNotifier.js` (new)
- `backend/src/routes/chat.js` (integrated leadNotifier)
- `backend/migrations/003_lead_scoring.sql` (new, optional)
- `backend/.env.example` (added LEAD_NOTIFICATION_EMAIL)

### Previous Sessions
- Audit gaps closure (streaming, booking, chips, email, tests)
- Files KB + chat logs + Raffy settings
- OOM fixes + security hardening
