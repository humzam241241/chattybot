# ChattyBot Analytics - Pre-Deployment Checklist

## Backend Verification

### Environment Variables
- [ ] `DATABASE_URL` set and tested
- [ ] `OPENAI_API_KEY` valid
- [ ] `ADMIN_SECRET` generated (use: `openssl rand -base64 32`)
- [ ] `NODE_ENV` set to `production`
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` configured

### Database
- [ ] Indexes created (`node scripts/createIndexes.js`)
- [ ] Tables exist: `conversations`, `messages`, `leads`, `conversation_summary_jobs`
- [ ] Views created (if using): `conversation_transcripts`, `conversation_overview`, `potential_leads`
- [ ] Test query: `SELECT COUNT(*) FROM conversations`

### API Endpoints
- [ ] `GET /api/admin/conversations` returns 200
- [ ] `GET /api/admin/transcript/:id` returns 200 for valid ID
- [ ] `GET /api/admin/leads` returns 200
- [ ] `GET /api/admin/stats` returns 200
- [ ] `GET /api/admin/debug` returns system health
- [ ] All endpoints reject requests without `Authorization` header

### Workers
- [ ] `summarizeWorker.js` runs without errors
- [ ] `leadExtractor.js` runs without errors
- [ ] Test: Create a conversation with 8+ messages, verify summary is generated
- [ ] Test: Verify lead is extracted from conversation

### Security
- [ ] Admin routes require authentication
- [ ] CORS configured for dashboard URL
- [ ] Rate limiting active on public endpoints
- [ ] Error messages don't leak sensitive info in production

## Dashboard Verification

### Environment Variables
- [ ] `REACT_APP_API_URL` points to backend (no trailing slash)
- [ ] `REACT_APP_ADMIN_SECRET` matches backend

### Build & Deploy
- [ ] `npm run build` completes without errors
- [ ] No TypeScript/ESLint errors
- [ ] Test build locally: `serve -s build`

### Pages
- [ ] `/conversations` loads and displays data
- [ ] Click conversation row opens `/transcript/:id`
- [ ] `/leads` shows extracted leads
- [ ] `/stats` displays charts and metrics
- [ ] Site filter dropdown works

### Mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Cards stack properly on small screens
- [ ] Buttons are touch-friendly (44px+)
- [ ] No horizontal overflow

### API Integration
- [ ] Fetch calls include `Authorization` header
- [ ] Error handling displays user-friendly messages
- [ ] Loading states show during data fetch
- [ ] Pagination works (if implemented)

## Worker Deployment

### Cron Jobs
- [ ] Cron syntax validated: `*/5 * * * *` for summary worker
- [ ] Cron syntax validated: `*/10 * * * *` for lead extractor
- [ ] Test cron: `node workers/summarizeWorker.js`
- [ ] Check cron logs after first execution

### PM2 (Alternative)
- [ ] PM2 installed globally: `npm install -g pm2`
- [ ] `pm2 start ecosystem.config.js` works
- [ ] Verify workers running: `pm2 list`
- [ ] Set up PM2 startup: `pm2 startup && pm2 save`

## Performance

### Database
- [ ] Indexes created on all foreign keys
- [ ] Query execution time < 100ms for conversations list
- [ ] No N+1 queries in API endpoints

### Frontend
- [ ] First contentful paint < 2s
- [ ] Charts render smoothly
- [ ] No console errors in production build

## Monitoring

### Logs
- [ ] Backend logs accessible (Render dashboard)
- [ ] Worker execution logged
- [ ] Error tracking configured (optional: Sentry)

### Health Checks
- [ ] `/api/admin/debug` endpoint monitored
- [ ] Orphan message count checked weekly
- [ ] Job queue size monitored
- [ ] Database connection pooling optimal

## Documentation

- [ ] `ANALYTICS_SETUP.md` reviewed
- [ ] `ANALYTICS_IMPLEMENTATION.md` reviewed
- [ ] Team trained on dashboard usage
- [ ] Backup/recovery procedures documented

## Final Tests

### End-to-End
- [ ] User sends message via widget
- [ ] Message appears in `messages` table
- [ ] Conversation appears in dashboard
- [ ] Summary generated after 8 messages
- [ ] Lead extracted for conversations with contact info
- [ ] Lead visible in dashboard `/leads` page

### Data Flow
- [ ] Widget → Backend → Database → Workers → Dashboard
- [ ] Real-time updates work (if Supabase subscriptions enabled)
- [ ] Site filtering works correctly
- [ ] Transcript viewer displays all messages

### Edge Cases
- [ ] Empty conversations handled gracefully
- [ ] Orphan messages don't crash queries
- [ ] Missing summaries show "—" placeholder
- [ ] Invalid conversation ID returns 404

## Production Deployment

### Backend (Render)
- [ ] Environment variables set in Render dashboard
- [ ] Health check endpoint configured
- [ ] Auto-deploy from main branch enabled
- [ ] Logs monitored for first 24 hours

### Dashboard (Vercel)
- [ ] Environment variables set in Vercel project settings
- [ ] Production domain configured
- [ ] Preview deployments enabled
- [ ] CORS origin added to backend

### Workers
- [ ] Cron jobs scheduled on server
- [ ] First execution verified
- [ ] Error alerting configured

## Post-Deployment

### Week 1
- [ ] Monitor worker execution daily
- [ ] Check for failed jobs in `conversation_summary_jobs`
- [ ] Verify lead extraction accuracy
- [ ] Review dashboard usage logs

### Week 2
- [ ] Run `rebuildConversationCounts.js` to verify data integrity
- [ ] Check database query performance
- [ ] Optimize slow queries if needed
- [ ] Gather user feedback on dashboard

### Monthly
- [ ] Review analytics metrics
- [ ] Clean up orphan messages
- [ ] Update dependencies
- [ ] Backup database

---

**Sign-off:**

- [ ] Backend tested and deployed by: ________________
- [ ] Dashboard tested and deployed by: ________________
- [ ] Workers configured and monitored by: ________________
- [ ] Documentation reviewed by: ________________

Date: ____________
