/**
 * Ingestion orchestrator — coordinates crawl → extract → chunk → embed → store.
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { SiteCrawler } = require('./crawler');
const { processExtractedContent } = require('./extractor');
const { chunkText } = require('./chunker');
const { embedChunks, vectorToSql } = require('./embedder');

const MAX_PAGES = Number(process.env.INGEST_MAX_PAGES || 150);
const CONCURRENCY = Number(process.env.INGEST_CONCURRENCY || 3);
const MAX_CHUNKS = 500;

/**
 * Store embedded chunks in Postgres.
 */
async function storeChunks(siteId, items) {
  let stored = 0;
  for (const { chunk, embedding } of items) {
    try {
      await pool.query(
        `INSERT INTO documents (id, site_id, content, embedding, created_at)
         VALUES ($1, $2, $3, $4::vector, NOW())`,
        [uuidv4(), siteId, chunk, vectorToSql(embedding)],
      );
      stored++;
    } catch (e) {
      console.error(`[Ingest] DB insert failed: ${e.message}`);
    }
  }
  return stored;
}

/**
 * Main ingestion pipeline.
 */
async function runIngestion(siteId, startUrl, opts = {}) {
  const t0 = Date.now();
  console.log(`[Ingest] ── Pipeline start for site ${siteId}`);
  console.log(`[Ingest] URL: ${startUrl} | maxPages=${MAX_PAGES} concurrency=${CONCURRENCY}`);

  try {
    // 1. Clear old documents
    const del = await pool.query('DELETE FROM documents WHERE site_id = $1', [siteId]);
    console.log(`[Ingest] Cleared ${del.rowCount} old documents`);

    // 2. Crawl
    const crawler = new SiteCrawler(startUrl, {
      maxPages: opts.maxPages || MAX_PAGES,
      concurrency: opts.concurrency || CONCURRENCY,
    });
    const crawl = await crawler.crawl();

    if (!crawl.results.length) {
      return { success: false, error: 'No pages with extractable content', siteId, duration: secs(t0) };
    }

    // 3. Extract → chunk → embed → store  (page by page to limit memory)
    let totalChunks = 0;
    let totalStored = 0;

    for (const page of crawl.results) {
      if (totalStored >= MAX_CHUNKS) {
        console.warn(`[Ingest] Hit chunk cap (${MAX_CHUNKS}), stopping`);
        break;
      }

      const extracted = processExtractedContent(page.text, page.url);
      if (!extracted.success) {
        console.warn(`[Ingest] Skipped ${page.url}: ${extracted.reason}`);
        continue;
      }

      const chunks = chunkText(extracted.text);
      totalChunks += chunks.length;

      if (!chunks.length) continue;

      // Cap per-site
      const remaining = MAX_CHUNKS - totalStored;
      const toEmbed = chunks.slice(0, remaining);

      const embedded = await embedChunks(toEmbed);
      const stored = await storeChunks(siteId, embedded);
      totalStored += stored;

      console.log(`[Ingest] Page ${page.url} → ${chunks.length} chunks, ${stored} stored`);
    }

    const duration = secs(t0);
    console.log(`[Ingest] ── Pipeline done in ${duration}s — ${crawl.pagesCrawled} pages, ${totalStored} chunks stored`);

    return {
      success: true,
      siteId,
      startUrl,
      pagesCrawled: crawl.pagesCrawled,
      linksDiscovered: crawl.linksDiscovered,
      chunksCreated: totalChunks,
      chunksStored: totalStored,
      duration,
    };
  } catch (err) {
    console.error(`[Ingest] Pipeline error:`, err);
    return { success: false, siteId, error: err.message, duration: secs(t0) };
  }
}

function secs(t0) {
  return Math.round((Date.now() - t0) / 1000);
}

module.exports = { runIngestion };
