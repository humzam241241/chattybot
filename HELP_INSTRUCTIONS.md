# ChattyBot Configuration Fix - Instructions for AI Assistant

## Context
I have a ChattyBot application with:
- **Backend** hosted on Render (https://chattybot-0jvh.onrender.com)
- **Admin dashboard** hosted on Vercel
- **Database** on Supabase (project ID: `ghbexbhcnrumqzshhjtm`)

## The Problem
1. My Supabase database has **8 conversations** and **sites** (verified via SQL in Supabase)
2. My admin dashboard shows **"No sites yet"** and only 5 conversations (or none)
3. I've been debugging configuration issues - there was a typo in the Supabase URL pointing to a wrong project

## Root Cause
The Render backend's environment variables are misconfigured. The backend cannot connect to the correct Supabase database.

## What I Need Help With

### 1. Verify Render Environment Variables
The backend needs these variables set correctly in Render → Environment:

| Variable | Correct Value | Notes |
|----------|---------------|-------|
| **SUPABASE_URL** | `https://ghbexbhcnrumqzshhjtm.supabase.co` | REST API URL only - NOT a PostgreSQL connection string |
| **DATABASE_URL** | Full PostgreSQL connection string | From Supabase → Project Settings → Database → Connection string (URI). Replace [YOUR-PASSWORD] with actual DB password |
| **SUPABASE_SERVICE_ROLE_KEY** | Service role key from Supabase | From Supabase → Project Settings → API → service_role key |

### 2. Common Mistakes to Avoid
- **SUPABASE_URL** must be `https://ghbexbhcnrumqzshhjtm.supabase.co` - do NOT put a `postgresql://` connection string here
- **DATABASE_URL** must be the full `postgresql://...` connection string - this is what the backend uses for conversations and sites
- All three must point to the SAME Supabase project (ghbexbhcnrumqzshhjtm)

### 3. Where to Get the Correct Values
1. Go to https://supabase.com/dashboard
2. Select project with URL containing `ghbexbhcnrumqzshhjtm`
3. **Project Settings** → **API**: Copy Project URL (for SUPABASE_URL) and service_role key (for SUPABASE_SERVICE_ROLE_KEY)
4. **Project Settings** → **Database**: Copy "Connection string" → "URI" (for DATABASE_URL). Replace [YOUR-PASSWORD] with the database password

### 4. After Updating
- Save environment variables in Render
- Trigger a redeploy (Render does this automatically when env vars change, or use Manual Deploy)
- Hard refresh the admin dashboard (Ctrl+Shift+R)

### 5. Verify the Fix
- Dashboard should show sites (not "No sites yet")
- Conversations page should show all 8 conversations for the site

## Database Schema (for reference)
- `sites` table - stores chatbot site configs
- `conversations` table - stores chat conversations (has site_id, visitor_id, message_count, summary, lead_score, lead_rating, etc.)
- `messages` table - stores individual messages per conversation

## Project Structure
- Backend: Express.js, uses `pg` for database, connects via DATABASE_URL
- Admin: Next.js, proxies API calls to Render backend
- The backend at Render uses DATABASE_URL for all database queries (sites, conversations, messages)
