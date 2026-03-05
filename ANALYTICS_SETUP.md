# ChattyBot Analytics Dashboard

Complete conversation analytics system with AI-powered lead extraction and real-time monitoring.

## 📊 Features

### 1. Conversation Analytics
- Full conversation history with message counts
- AI-generated summaries
- Lead scoring
- Real-time conversation tracking

### 2. Lead Intelligence
- Automatic lead extraction from conversations
- Structured data: name, phone, email, service requests
- Urgency classification (emergency/high/medium/low)
- Service request categorization

### 3. Analytics Dashboard
- Total conversations and lead counts
- Average messages per conversation
- Lead conversion rate
- Daily conversation volume charts
- System health monitoring

### 4. Transcript Viewer
- Chat-style message display
- Full conversation context
- Timestamp tracking
- Easy navigation

## 🏗️ Architecture

```
/backend
  /workers
    summarizeWorker.js    # AI summary generation
    leadExtractor.js      # Structured lead extraction
  /scripts
    rebuildConversationCounts.js  # Data recovery tool
    createIndexes.js              # Performance indexes
  /src/routes
    adminAnalytics.js    # Analytics API endpoints

/admin-dashboard
  /src
    /pages
      ConversationsPage.js   # Conversation list
      TranscriptViewer.js    # Individual transcript
      LeadDashboard.js       # Lead management
      StatsPage.js           # Analytics charts
```

## 🚀 Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Dashboard:**
```bash
cd admin-dashboard
npm install
```

### 2. Environment Variables

**Backend (.env):**
```
DATABASE_URL=your_supabase_connection_string
OPENAI_API_KEY=your_openai_key
ADMIN_SECRET=your_admin_token
NODE_ENV=production
```

**Dashboard (.env):**
```
REACT_APP_API_URL=https://your-backend.onrender.com
REACT_APP_ADMIN_SECRET=your_admin_token
```

### 3. Database Setup

Run the index creation script:
```bash
cd backend
node scripts/createIndexes.js
```

This creates performance indexes on:
- `messages(conversation_id)`
- `conversations(site_id, created_at)`
- `leads(site_id, conversation_id, extracted_at)`
- `conversation_summary_jobs(status)`

### 4. Deploy Workers

**Option A: Cron Jobs (Recommended)**

Set up cron jobs to run workers every 5-10 minutes:

```bash
# On your server or Render cron job
*/5 * * * * cd /path/to/backend && node workers/summarizeWorker.js
*/10 * * * * cd /path/to/backend && node workers/leadExtractor.js
```

**Option B: Continuous Process**

Uncomment the `setInterval` lines in each worker file and run as background processes.

### 5. Deploy Dashboard

**Vercel Deployment:**
```bash
cd admin-dashboard
vercel --prod
```

**Environment Variables in Vercel:**
- `REACT_APP_API_URL`
- `REACT_APP_ADMIN_SECRET`

## 🔧 API Endpoints

### Analytics Endpoints

**GET /api/admin/conversations**
- Returns: List of conversations with summaries
- Query params: `site_id`, `limit`, `offset`

**GET /api/admin/transcript/:id**
- Returns: Full conversation transcript

**GET /api/admin/leads**
- Returns: Extracted leads with conversation context
- Query params: `site_id`, `limit`, `offset`

**GET /api/admin/stats**
- Returns: Aggregate analytics
  - Total conversations
  - Total leads
  - Average messages per chat
  - Daily volume (last 7 days)

**GET /api/admin/debug**
- Returns: System health metrics
  - Conversation count
  - Message count
  - Orphan messages
  - Pending jobs

## 🤖 Background Workers

### Summary Worker

Processes the `conversation_summary_jobs` queue and generates AI summaries.

**Features:**
- Batches 10 jobs at a time
- Generates 1-sentence summaries
- Updates conversations table
- Handles errors gracefully

**Run manually:**
```bash
node workers/summarizeWorker.js
```

### Lead Extractor

Analyzes conversations with 4+ messages and extracts structured lead data.

**Features:**
- Extracts: name, phone, email, service type, urgency, address
- JSON schema validation
- Avoids re-processing conversations
- Stores results in leads table

**Run manually:**
```bash
node workers/leadExtractor.js
```

## 🔍 Recovery Tools

### Rebuild Conversation Counts

If message counts become inaccurate, run:

```bash
node scripts/rebuildConversationCounts.js
```

This recalculates `message_count` for all conversations by counting actual messages.

## 📱 Mobile Optimization

The dashboard is fully responsive:
- Tables scroll horizontally on mobile
- Cards stack vertically
- Touch-friendly buttons
- Optimized viewport

## ⚡ Performance

### Database Indexes
All analytics queries use indexed columns for fast lookups.

### Caching Strategy
- Site configs cached in memory (5min TTL)
- Real-time updates via Supabase subscriptions (optional)

### Query Optimization
- Paginated results (default: 50 items)
- Efficient JOIN queries
- Aggregate functions for stats

## 🔒 Security

- All admin routes require `Authorization: Bearer <ADMIN_SECRET>`
- CORS configured for dashboard origin
- Rate limiting on public endpoints
- Input validation on all forms

## 📈 Analytics Metrics

### Conversation Metrics
- Total conversations by site
- Average messages per conversation
- Lead score distribution
- Daily conversation volume

### Lead Metrics
- Total leads extracted
- Emergency requests count
- Quote requests count
- Lead conversion rate

### System Health
- Database connection status
- Orphan message detection
- Pending job queue size

## 🎯 Usage Tips

### 1. Monitor Lead Queue
Check `/api/admin/debug` regularly to ensure workers are processing jobs.

### 2. Filter by Site
Use the site dropdown to view analytics for specific clients.

### 3. Export Data
All endpoints return JSON - easily integrate with BI tools or export to CSV.

### 4. Conversation Recovery
Run `rebuildConversationCounts.js` monthly to ensure data integrity.

## 🛠️ Troubleshooting

### Workers Not Running
- Check cron job logs
- Verify `DATABASE_URL` and `OPENAI_API_KEY` are set
- Run manually to test: `node workers/summarizeWorker.js`

### Dashboard Not Loading Data
- Verify `REACT_APP_API_URL` points to backend
- Check `ADMIN_SECRET` matches backend
- Open browser console for CORS errors

### Slow Queries
- Run `node scripts/createIndexes.js`
- Check Supabase connection pooling
- Consider upgrading database plan

## 📝 Development

### Run Dashboard Locally
```bash
cd admin-dashboard
npm start
```

### Test API Endpoints
```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  https://your-backend.com/api/admin/conversations
```

## 🚀 Production Checklist

- [ ] Database indexes created
- [ ] Workers scheduled via cron
- [ ] Environment variables configured
- [ ] Dashboard deployed to Vercel
- [ ] CORS configured for dashboard URL
- [ ] Test all endpoints with Bearer token
- [ ] Monitor first 24h of worker execution

## 🤝 Support

For issues or questions, check:
1. Backend logs (Render dashboard)
2. Dashboard console (Browser DevTools)
3. Database queries (Supabase SQL editor)
4. Worker execution logs

---

Built with ❤️ for ChattyBot
