const express = require('express');
// Render runtime doesn't persist Playwright's default browser cache path.
// We download browsers during the Render build step with PLAYWRIGHT_BROWSERS_PATH=0,
// which installs them into node_modules. Force the same setting at runtime
// BEFORE requiring Playwright so chromium.launch finds the executable.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '0';
const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { embedBatch, vectorToSql } = require('../services/embeddings');
const { ingestLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Prevent concurrent ingestion jobs (Render free tier will OOM easily).
// In-memory lock is enough for MVP (single instance); if you scale horizontally,
// move this to Redis or the database.
const ingestLocks = new Set();

const CRAWL_UA = 'Mozilla/5.0 (compatible; ChattyBotCrawler/1.0)';
const MAX_PAGES = Number(process.env.INGEST_MAX_PAGES || 10); // MVP safety limit (configurable)
const MAX_CHUNK_CHARS = 1000; // safety: keep chunks small to avoid OOM
const EMBED_BATCH_SIZE = 10;  // safety: small embedding batches
const MAX_TEXT_CHARS = 20_000; // safety: cap per-page extracted text

function normalizeText(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  return cleaned.length > MAX_TEXT_CHARS ? cleaned.slice(0, MAX_TEXT_CHARS) : cleaned;
}

function chunkByChars(text, maxChars) {
  // Simple, low-memory chunking: yield sequential chunks up to maxChars.
  // (We intentionally keep this local to ingest; chat/RAG chunking remains unchanged.)
  const t = String(text || '').trim();
  if (!t) return [];
  const chunks = [];
  for (let i = 0; i < t.length; i += maxChars) {
    const chunk = t.slice(i, i + maxChars).trim();
    if (chunk.length > 50) chunks.push(chunk);
  }
  return chunks;
}

async function insertChunkBatch(siteId, chunkBatch, state) {
  if (chunkBatch.length === 0) return;
  const embeddings = await embedBatch(chunkBatch);
  for (let i = 0; i < chunkBatch.length; i++) {
    await pool.query(
      `INSERT INTO documents (id, site_id, content, embedding, created_at)
       VALUES ($1, $2, $3, $4::vector, NOW())`,
      [uuidv4(), siteId, chunkBatch[i], vectorToSql(embeddings[i])]
    );
    state.totalStored++;
  }
}

async function processTextStreaming(siteId, text, caps, state) {
  if (!text) return;
  if (state.totalStored >= caps.maxChunksPerSite) return;

  const chunks = chunkByChars(text, MAX_CHUNK_CHARS);
  if (chunks.length === 0) return;

  // Stream embeddings + inserts in small batches, clearing arrays each time.
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    if (state.totalStored >= caps.maxChunksPerSite) break;
    const remaining = caps.maxChunksPerSite - state.totalStored;
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    if (batch.length > remaining) batch.length = remaining;

    state.totalChunks += batch.length;
    await insertChunkBatch(siteId, batch, state);

    // Clear batch references (helps GC on tight memory)
    batch.length = 0;
  }
}

function isSameDomain(url, baseHost) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname === baseHost;
  } catch {
    return false;
  }
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * POST /ingest/:site_id
 * 
 * Crawls the registered site domain, chunks and embeds all content,
 * then upserts into the documents table.
 * 
 * This is an admin-only, async-heavy operation. On Render free tier
 * it may take a few minutes. Returns immediately after job completes.
 */
router.post('/:site_id', adminAuth, ingestLimiter, async (req, res) => {
  const { site_id } = req.params;

  if (ingestLocks.has(site_id)) {
    return res.status(409).json({ error: 'Ingestion already running for this site' });
  }

  ingestLocks.add(site_id);

  try {
    const siteResult = await pool.query(
      'SELECT id, company_name, domain FROM sites WHERE id = $1',
      [site_id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];
    if (!site.domain) {
      return res.status(400).json({ error: 'Site has no domain configured' });
    }

    const startUrl = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;

    console.log(`[Ingest] Starting crawl for site ${site_id} at ${startUrl}`);

    // Delete existing documents for this site before re-ingesting
    await pool.query('DELETE FROM documents WHERE site_id = $1', [site_id]);

    // Render free tier memory is tight — keep ingestion streamed and capped.
    // These caps prevent OOM on large pages / SPA bundles.
    const MAX_CHUNKS_PER_SITE = 150;
    const state = { totalChunks: 0, totalStored: 0 };
    const caps = { maxChunksPerSite: MAX_CHUNKS_PER_SITE };

    // ---------------------------------------------------------------------
    // Playwright crawl (root page is always processed first)
    // ---------------------------------------------------------------------
    const baseHost = new URL(startUrl).hostname;
    const visited = new Set();
    const queue = [startUrl];
    let pagesCrawled = 0;

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const context = await browser.newContext({ userAgent: CRAWL_UA });

      while (queue.length > 0 && pagesCrawled < MAX_PAGES) {
        const nextUrl = cleanUrl(queue.shift());
        if (!nextUrl) continue;
        if (visited.has(nextUrl)) continue;
        if (!isSameDomain(nextUrl, baseHost)) continue;
        visited.add(nextUrl);

        pagesCrawled++;
        console.log(`[Ingest] Crawling URL: ${nextUrl}`);

        const page = await context.newPage();
        try {
          await page.goto(nextUrl, { waitUntil: 'networkidle', timeout: 20000 });

          const text = await page.evaluate(() => document.body?.innerText || '');
          const cleanedText = normalizeText(text);
          console.log(`[Ingest] Text length: ${cleanedText.length}`);

          const links = await page.$$eval('a', (anchors) => anchors.map((a) => a.href));
          const filteredInternal = Array.from(
            new Set(
              (links || [])
                .map((l) => cleanUrl(l))
                .filter(Boolean)
                .filter((l) => isSameDomain(l, baseHost))
            )
          );

          console.log(`[Ingest] Links discovered: ${filteredInternal.length}`);

          // Enqueue discovered internal links
          for (const l of filteredInternal) {
            if (queue.length + visited.size >= MAX_PAGES * 5) break; // small bound on queue growth
            if (!visited.has(l)) queue.push(l);
          }

          // Streamed chunk → embed → insert (no large arrays kept in memory)
          if (state.totalStored < MAX_CHUNKS_PER_SITE) {
            await processTextStreaming(site_id, cleanedText, caps, state);
          }
        } catch (e) {
          console.warn(`[Ingest] Failed ${nextUrl}: ${e.message}`);
        } finally {
          await page.close().catch(() => {});
        }
      }
    } finally {
      await browser.close().catch(() => {});
    }

    console.log(`[Ingest] Done. Stored ${state.totalStored} chunks for site ${site_id}`);

    return res.json({
      success: true,
      pages_crawled: Math.max(1, pagesCrawled),
      chunks_stored: state.totalStored,
      chunks_total: state.totalChunks,
    });
  } catch (err) {
    console.error('Ingest error:', err);
    return res.status(500).json({ error: 'Ingestion failed', details: err.message });
  } finally {
    ingestLocks.delete(site_id);
  }
});

module.exports = router;
