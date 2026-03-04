# ChattyBot Ingestion System

Production-ready, modular site ingestion pipeline for multi-tenant RAG chatbot platform.

## Architecture

```
src/ingest/
├── crawler.js       # Playwright-based web crawler with React/SPA support
├── extractor.js     # Content validation and quality filtering
├── chunker.js       # Text chunking with overlapping windows
├── embedder.js      # OpenAI embedding generation with batching
└── ingestRunner.js  # Main orchestrator
```

## Features

### 🕷️ Intelligent Crawling
- **React/SPA Support**: Waits for `networkidle` and DOM hydration
- **BFS Queue**: Discovers links systematically
- **Retry Logic**: Exponential backoff for failed pages (3 retries)
- **Concurrency**: Worker pool for parallel crawling
- **Domain Filtering**: Only crawls same-domain links
- **URL Normalization**: Removes hashes, deduplicates query params

### 🎯 Content Quality
- **Minimum Length**: Skips pages < 300 chars
- **Error Detection**: Filters 404, error pages
- **Noise Removal**: Strips `nav`, `footer`, `header`, `script`, `style`
- **Spam Detection**: Validates unique word ratio
- **Text Normalization**: Cleans whitespace, applies safety caps

### ✂️ Smart Chunking
- **Chunk Size**: 800 characters per chunk
- **Overlap**: 120 characters for context continuity
- **Boundary Detection**: Breaks at sentences, paragraphs, words (in that order)
- **Validation**: Filters corrupted/invalid chunks

### 🧠 Embedding Pipeline
- **Model**: `text-embedding-3-small` (1536 dimensions)
- **Batch Processing**: 10 chunks per batch
- **Retry Logic**: Exponential backoff for API failures
- **Validation**: Checks embedding dimensions and values

### 🔐 Safety & Scalability
- **Page Limit**: `INGEST_MAX_PAGES` (default: 150)
- **Concurrency**: `INGEST_CONCURRENCY` (default: 3 workers)
- **Chunk Cap**: 500 chunks per site (prevents DB bloat)
- **Memory Safe**: Processes in batches, no large arrays
- **Lock System**: Prevents concurrent ingestion for same site

## Configuration

Environment variables:

```bash
INGEST_MAX_PAGES=150        # Maximum pages to crawl per site
INGEST_CONCURRENCY=3        # Number of concurrent crawler workers
OPENAI_API_KEY=sk-...       # OpenAI API key for embeddings
```

## API Endpoints

### POST /ingest/:site_id
Triggers full site ingestion.

**Headers:**
```
Authorization: Bearer <ADMIN_SECRET>
```

**Response:**
```json
{
  "success": true,
  "site_id": "...",
  "pages_crawled": 25,
  "links_discovered": 142,
  "chunks_created": 98,
  "chunks_stored": 98,
  "duration_seconds": 87,
  "message": "Successfully ingested 98 chunks from 25 pages"
}
```

### GET /ingest/:site_id/status
Returns ingestion status.

**Response:**
```json
{
  "site_id": "...",
  "is_running": false,
  "chunk_count": 98,
  "last_ingestion": "2026-03-02T15:30:00.000Z",
  "has_data": true
}
```

## Expected Results

For a typical small business website (10-30 pages):

| Metric | Expected Range |
|--------|----------------|
| Pages Crawled | 10-30 |
| Text per Page | 2,000-8,000 chars |
| Chunks Created | 40-120 |
| Chunks Stored | 40-120 |
| Duration | 60-180 seconds |

## Logging

Structured logs for debugging:

```
[Ingest] Starting crawl for https://example.com (max 150 pages, 3 workers)
[Ingest] Crawling: https://example.com/about
[Ingest] Text length: 4532
[Ingest] Links discovered: 12
[Ingest] Chunks created: 6
[Ingest] Progress: 10/45 chunks embedded
[Ingest] Storage complete: 6 stored, 0 failed
[Ingest] Ingestion complete in 45s
[Ingest] Summary: 8 pages, 45 chunks stored
```

## Error Handling

### Crawl Failures
- Retries with exponential backoff (1s, 2s, 4s)
- Logs warnings for failed pages
- Continues crawling other pages

### Embedding Failures
- Retries API calls up to 3 times
- Splits large batches automatically
- Logs detailed error messages

### Storage Failures
- Validates embeddings before storing
- Logs per-chunk failures
- Returns success/failure counts

## Database Schema

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_site_id ON documents(site_id);
CREATE INDEX idx_documents_embedding ON documents USING ivfflat(embedding vector_cosine_ops);
```

## Performance

### Memory Usage
- Streaming architecture (no large arrays)
- Batch size: 10 chunks
- Per-page text cap: 50KB
- Target: < 512MB RAM on Render free tier

### API Costs (OpenAI)
- Model: `text-embedding-3-small` ($0.02 per 1M tokens)
- Average site (100 chunks): ~$0.001
- 1000 sites: ~$1.00

## Future Enhancements

- [ ] PDF/DOCX crawler support
- [ ] Incremental ingestion (only new pages)
- [ ] Distributed locks (Redis) for horizontal scaling
- [ ] Progress webhooks for admin UI
- [ ] Custom chunking strategies per site
- [ ] Image/video metadata extraction

## Testing

```bash
# Run ingestion for a site
curl -X POST http://localhost:3001/ingest/<site_id> \
  -H "Authorization: Bearer <ADMIN_SECRET>"

# Check status
curl http://localhost:3001/ingest/<site_id>/status \
  -H "Authorization: Bearer <ADMIN_SECRET>"
```

## Troubleshooting

### "Text length: 128" (Low extraction)
- Site uses client-side rendering
- ✅ Fixed: Waits for `networkidle` + body selector + 1s hydration

### "Chunks stored: 6" (Expected 80-150)
- Not enough content extracted
- ✅ Check crawl logs for text lengths
- ✅ Verify site is accessible and not blocking crawler

### "Ingestion already running"
- Another ingestion job is in progress
- ✅ Wait or check `/status` endpoint

### Memory issues
- Reduce `INGEST_CONCURRENCY` to 1-2
- Reduce `INGEST_MAX_PAGES`
- Ensure streaming architecture is not accumulating arrays
