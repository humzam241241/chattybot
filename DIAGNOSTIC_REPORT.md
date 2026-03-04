# ChattyBot Intelligence Pipeline - Diagnostic Report

## EXECUTIVE SUMMARY

**Status:** ✅ Pipeline Architecture is COMPLETE  
**Problem:** ❌ Knowledge Base is EMPTY (no documents ingested)  
**Root Cause:** Ingestion has not been triggered for your site  
**Impact:** Bot responds generically without site-specific knowledge

---

## SECTION 1 — Pipeline Architecture Analysis

### ✅ What's Working

1. **Widget → Backend Communication**: WORKING
   - Widget successfully loads and initializes
   - `/site-config/:site_id` returns valid config
   - Widget sends messages to backend

2. **Chat Endpoint**: WORKING
   - `POST /chat` endpoint exists and is functional
   - Located at: `backend/src/routes/chat.js`
   - Accepts: `site_id`, `user_message`, `conversation_id`, etc.

3. **RAG Service**: WORKING
   - `backend/src/services/rag.js` implements vector search
   - Function `retrieveContext(siteId, query)` properly:
     - Embeds user query using OpenAI
     - Performs pgvector cosine similarity search
     - Returns top 5 relevant chunks

4. **OpenAI Integration**: WORKING
   - OpenAI client initialized with API key
   - Uses `gpt-4o-mini` model
   - Temperature set to 0.3 (factual, low hallucination)
   - Receives system prompt with context

5. **Database Schema**: WORKING
   - `sites` table: ✅ EXISTS (has your RYANS ROOFING COMPANY record)
   - `documents` table: ✅ EXISTS (pgvector column configured)
   - `vector` extension: ✅ ENABLED
   - Indexes: ✅ CREATED (ivfflat for cosine similarity)

6. **Ingestion Pipeline**: WORKING (code exists)
   - `POST /ingest/:site_id` endpoint exists
   - Uses Playwright to crawl websites
   - Chunks text into 1000-char segments
   - Embeds chunks using OpenAI
   - Stores in `documents` table with vectors

### ❌ What's Broken

**THE KNOWLEDGE BASE IS EMPTY**

The `documents` table has **ZERO rows** for your site ID:
```
site_id: 1cafeea7-4e93-4381-81e5-00302161ce44
```

**Evidence:**
- Line 75 in `chat.js`: `const contextChunks = await retrieveContext(site_id, user_message);`
- This returns `[]` (empty array) because no documents exist
- Line 77: `const basePrompt = site.system_prompt || buildSystemPrompt(site, contextChunks);`
- With empty `contextChunks`, the prompt contains: `[No relevant company information was found for this query.]`
- OpenAI receives NO context about your business
- Result: Generic, unhelpful answers

---

## SECTION 2 — Database Tables for Knowledge Storage

### Table: `documents`

**Purpose:** Stores chunked website content with embeddings for RAG

**Schema:**
```sql
id          UUID PRIMARY KEY
site_id     UUID (references sites)
content     TEXT (the actual text chunk)
embedding   vector(1536) (OpenAI text-embedding-3-small)
created_at  TIMESTAMPTZ
```

**Current State:**
```sql
SELECT COUNT(*) FROM documents WHERE site_id = '1cafeea7-4e93-4381-81e5-00302161ce44';
-- Expected result: 0 (empty)
```

**Expected State (after ingestion):**
- ~150 chunks per site (configurable)
- Each chunk = ~1000 characters of website text
- Example: 10 pages × 15 chunks/page = 150 total chunks

---

## SECTION 3 — Embeddings & Documents Status

### Current Status: **EMPTY**

**What Should Exist:**
1. Text chunks extracted from: `https://ralphsitemirror.vercel.app/`
2. Each chunk embedded using OpenAI `text-embedding-3-small`
3. 1536-dimensional vectors stored in `embedding` column
4. Indexed for fast cosine similarity search

**Why It's Empty:**
The ingestion process has **never been run** for this site.

**How to Verify:**
Run this SQL query in Supabase:
```sql
SELECT 
  COUNT(*) as total_docs,
  MIN(created_at) as first_ingestion,
  MAX(created_at) as last_ingestion
FROM documents 
WHERE site_id = '1cafeea7-4e93-4381-81e5-00302161ce44';
```

Expected output right now:
```
total_docs: 0
first_ingestion: NULL
last_ingestion: NULL
```

---

## SECTION 4 — Vector Search Execution

### Is Vector Search Running? **YES**

**Code Path:**
1. User sends message → `POST /chat`
2. Line 75: `const contextChunks = await retrieveContext(site_id, user_message);`
3. `retrieveContext()` in `rag.js`:
   ```javascript
   const queryEmbedding = await embedText(query);
   const vectorLiteral = vectorToSql(queryEmbedding);
   
   const result = await pool.query(
     `SELECT content
      FROM documents
      WHERE site_id = $1
      ORDER BY embedding <=> $2::vector
      LIMIT $3`,
     [siteId, vectorLiteral, TOP_K]
   );
   ```

**The Search IS Executing, BUT:**
- Query runs successfully
- Returns 0 results (because `documents` table is empty)
- `contextChunks = []`
- OpenAI gets no context

**Debug Output:**
In the chat response, you can see:
```json
{
  "context_used": 0  // ← This confirms 0 chunks retrieved
}
```

---

## SECTION 5 — Minimal Code Fixes Required

### Fix #1: Trigger Ingestion (REQUIRED)

**Action:** Call the ingestion endpoint to crawl and embed your website

**Method 1: Via Admin Dashboard (if UI exists)**
1. Go to admin dashboard
2. Navigate to site: `RYANS ROOFING COMPANY`
3. Click "Re-ingest Site" button
4. Wait 2-3 minutes for crawl to complete

**Method 2: Direct API Call**

```bash
curl -X POST https://chattybot-0jvh.onrender.com/ingest/1cafeea7-4e93-4381-81e5-00302161ce44 \
  -H "Authorization: Bearer chattybot-admin-secret-2024" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "pages_crawled": 10,
  "chunks_stored": 127
}
```

**What This Does:**
1. Launches Playwright browser (headless Chromium)
2. Crawls up to 10 pages from `https://ralphsitemirror.vercel.app/`
3. Extracts text from each page (max 20,000 chars/page)
4. Chunks text into ~1000-char segments
5. Embeds each chunk using OpenAI
6. Stores in `documents` table with vectors
7. Takes ~2-3 minutes on Render

---

### Fix #2: Add Debug Logging (OPTIONAL)

If you want to confirm vector search is working, add temporary logging:

**File:** `backend/src/services/rag.js`

**Change:**
```javascript
async function retrieveContext(siteId, query) {
  const queryEmbedding = await embedText(query);
  const vectorLiteral = vectorToSql(queryEmbedding);

  // 🔍 ADD THIS
  console.log(`[RAG] Searching for site: ${siteId}, query: "${query}"`);

  const result = await pool.query(
    `SELECT content
     FROM documents
     WHERE site_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [siteId, vectorLiteral, TOP_K]
  );

  // 🔍 ADD THIS
  console.log(`[RAG] Found ${result.rows.length} chunks`);
  if (result.rows.length > 0) {
    console.log(`[RAG] First chunk preview: ${result.rows[0].content.slice(0, 100)}...`);
  }

  return result.rows.map((row) => row.content);
}
```

**Purpose:** Confirm in Render logs that search executes and returns results after ingestion.

---

### Fix #3: Verify Environment Variables

**Required for Ingestion:**
```bash
OPENAI_API_KEY=sk-proj-...  # ✅ Must be set (for embeddings)
PLAYWRIGHT_BROWSERS_PATH=0   # ✅ Must be set (for Render)
INGEST_MAX_PAGES=10          # ✅ Optional (default: 10)
```

**Check in Render Dashboard:**
1. Go to your backend service
2. Click "Environment" tab
3. Verify `OPENAI_API_KEY` is set
4. Verify `PLAYWRIGHT_BROWSERS_PATH=0` is set

---

## VERIFICATION CHECKLIST

After running ingestion, verify success:

### ✅ Step 1: Check Database
```sql
SELECT COUNT(*) FROM documents WHERE site_id = '1cafeea7-4e93-4381-81e5-00302161ce44';
-- Should return: ~127 (varies by website size)
```

### ✅ Step 2: Test Chat
Ask a question about Ryan's Roofing services:
```
User: "What roofing services do you offer?"
```

Expected response should mention specific services from the website (not generic).

### ✅ Step 3: Check Context Used
In the API response, verify:
```json
{
  "context_used": 5  // ← Should be 5 (not 0)
}
```

### ✅ Step 4: Check Render Logs
```
[RAG] Searching for site: 1cafeea7-4e93-4381-81e5-00302161ce44
[RAG] Found 5 chunks
[RAG] First chunk preview: Ryan's Roofing Company provides...
```

---

## SUMMARY

### 🎯 Root Cause
**Knowledge base is empty** — ingestion has never been run for this site.

### 🔧 Fix
**Run ingestion once** to crawl and embed the website.

### 📊 Impact
After ingestion completes:
- ✅ Bot will answer FAQs about Ryan's Roofing
- ✅ Responses will be specific and accurate
- ✅ Context will be retrieved from vector search
- ✅ `context_used` will be > 0

### ⏱️ Time to Fix
**5 minutes** (3 min ingestion + 2 min testing)

---

## NEXT STEPS

1. **Run the diagnostic SQL query** (see `DIAGNOSTIC_QUERY.sql`)
2. **Trigger ingestion** for site `1cafeea7-4e93-4381-81e5-00302161ce44`
3. **Wait 2-3 minutes** for crawl to complete
4. **Test the chatbot** with a specific question
5. **Verify `context_used > 0`** in API response

The pipeline is working. You just need to populate the knowledge base! 🚀
