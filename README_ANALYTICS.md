# ChattyBot - Complete Conversation Analytics System

## 🎉 What's Included

This repository now includes a **complete conversation analytics system** with:

- **AI-Powered Conversation Summaries** - Automatic 1-sentence summaries using OpenAI
- **Lead Intelligence** - Structured lead extraction (name, phone, email, service, urgency)
- **Admin Dashboard** - Beautiful React dashboard with conversations, transcripts, leads, and analytics
- **Background Workers** - Automated processing of conversations and lead extraction
- **Real-time Monitoring** - System health checks and debug endpoints
- **Performance Optimization** - Database indexes for fast queries

## 📁 New File Structure

```
chattybot/
├── backend/
│   ├── workers/
│   │   ├── summarizeWorker.js       # AI summary generation
│   │   └── leadExtractor.js         # Lead extraction
│   ├── scripts/
│   │   ├── rebuildConversationCounts.js  # Data recovery tool
│   │   └── createIndexes.js              # Performance indexes
│   └── src/routes/
│       └── adminAnalytics.js        # Analytics API endpoints
│
├── admin-dashboard/                  # NEW: React analytics dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ConversationsPage.js
│   │   │   ├── TranscriptViewer.js
│   │   │   ├── LeadDashboard.js
│   │   │   └── StatsPage.js
│   │   ├── utils/
│   │   │   └── realtime.js          # Optional Supabase realtime
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env.example
│
├── ecosystem.config.js               # PM2 process manager config
├── setup-analytics.sh                # Quick setup script (Linux/Mac)
├── setup-analytics.bat               # Quick setup script (Windows)
│
└── Documentation/
    ├── ANALYTICS_SETUP.md           # Complete setup guide
    ├── ANALYTICS_IMPLEMENTATION.md  # Technical overview
    └── DEPLOYMENT_CHECKLIST.md      # Pre-launch checklist
```

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

**Windows:**
```cmd
setup-analytics.bat
```

**Linux/Mac:**
```bash
chmod +x setup-analytics.sh
./setup-analytics.sh
```

### Option 2: Manual Setup

1. **Install Dependencies**
```bash
cd backend && npm install
cd ../admin-dashboard && npm install
```

2. **Configure Environment**
```bash
cp backend/.env.example backend/.env
cp admin-dashboard/.env.example admin-dashboard/.env
# Edit both .env files with your credentials
```

3. **Setup Database**
```bash
cd backend
node scripts/createIndexes.js
```

4. **Start Services**
```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Dashboard
cd admin-dashboard && npm start

# Terminal 3 & 4: Workers (or use cron/PM2)
cd backend
node workers/summarizeWorker.js  # Run every 5 min
node workers/leadExtractor.js    # Run every 10 min
```

## 📊 Features Overview

### 1. Conversation Management
- View all conversations with message counts
- AI-generated summaries
- Lead scoring
- Filter by site
- Click to view full transcripts

### 2. Lead Intelligence
- Automatic extraction of customer data
- Structured fields: name, phone, email, service, urgency, address
- Emergency request detection
- Quote request tracking
- Link to conversation context

### 3. Analytics Dashboard
- Total conversations and leads
- Average messages per conversation
- Lead conversion rate
- Daily conversation volume (7-day chart)
- Real-time system health monitoring

### 4. Transcript Viewer
- Chat-style message display
- User vs Assistant differentiation
- Timestamps
- Conversation metadata
- Summary display

## 🔧 API Endpoints

All endpoints require `Authorization: Bearer <ADMIN_SECRET>` header.

### Analytics Endpoints

```
GET /api/admin/conversations?site_id=xxx&limit=50&offset=0
GET /api/admin/transcript/:conversationId
GET /api/admin/leads?site_id=xxx&limit=50
GET /api/admin/stats?site_id=xxx
GET /api/admin/debug
```

## 🤖 Background Workers

### Summary Worker
Generates AI summaries for conversations.

**Manual run:**
```bash
cd backend
node workers/summarizeWorker.js
```

**Cron job (every 5 minutes):**
```bash
*/5 * * * * cd /path/to/backend && node workers/summarizeWorker.js
```

### Lead Extractor
Extracts structured lead data from conversations.

**Manual run:**
```bash
cd backend
node workers/leadExtractor.js
```

**Cron job (every 10 minutes):**
```bash
*/10 * * * * cd /path/to/backend && node workers/leadExtractor.js
```

**Using PM2 (Recommended for Production):**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🗄️ Database Schema

The system uses your existing tables:
- `conversations` - Stores conversation metadata
- `messages` - Individual chat messages
- `leads` - Lead information (enhanced with extraction fields)
- `conversation_summary_jobs` - Job queue for summary generation

**New indexes created:**
- `messages(conversation_id)`
- `conversations(site_id, created_at)`
- `leads(site_id, conversation_id, extracted_at)`
- `conversation_summary_jobs(status)`

## 🔐 Security

- All admin routes require authentication
- CORS configured for dashboard origin
- Rate limiting on public endpoints
- Environment variables for secrets
- Production-safe error messages

## 📱 Mobile Support

The dashboard is fully responsive:
- Horizontal scrolling tables
- Stacked cards on mobile
- Touch-friendly buttons (44px minimum)
- Optimized viewport

## 🎯 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
ADMIN_SECRET=your-secure-token
NODE_ENV=production
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=eyJ...
```

### Dashboard (.env)
```env
REACT_APP_API_URL=https://your-backend.onrender.com
REACT_APP_ADMIN_SECRET=your-secure-token
```

## 📚 Documentation

- **[ANALYTICS_SETUP.md](./ANALYTICS_SETUP.md)** - Complete deployment guide
- **[ANALYTICS_IMPLEMENTATION.md](./ANALYTICS_IMPLEMENTATION.md)** - Technical details
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Pre-launch verification

## 🛠️ Maintenance

### Monthly Tasks
- Run `node scripts/rebuildConversationCounts.js` to verify data integrity
- Check `/api/admin/debug` for orphan messages
- Review worker logs for errors

### Performance Monitoring
- Query execution times (should be < 100ms)
- Worker job queue size
- Database connection pool utilization

## ✨ Optional Enhancements

See `admin-dashboard/src/utils/realtime.js` for Supabase real-time subscription example.

Additional features you can add:
- Email alerts for high-priority leads
- CSV export functionality
- Custom date range filters
- Lead assignment to sales reps
- Advanced search and filtering

## 🆘 Troubleshooting

### Workers Not Running
1. Check environment variables are set
2. Run manually: `node workers/summarizeWorker.js`
3. Check logs for errors

### Dashboard Not Loading Data
1. Verify `REACT_APP_API_URL` is correct
2. Check `ADMIN_SECRET` matches backend
3. Open browser console for errors
4. Test API endpoint directly with curl

### Slow Queries
1. Verify indexes are created: `node scripts/createIndexes.js`
2. Check Supabase connection pooling
3. Review query execution plans

## 📞 Support

If you encounter issues:
1. Check backend logs (Render dashboard)
2. Check browser console (DevTools)
3. Review database logs (Supabase)
4. Verify all environment variables

## ⚡ Performance Tips

- Use site filtering to reduce data load
- Implement pagination for large datasets
- Enable Supabase realtime for live updates (optional)
- Use PM2 for worker management in production

---

**Ready to deploy?** Follow the [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) to ensure everything is configured correctly.

Built with ❤️ for ChattyBot
