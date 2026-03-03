const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { crawlSite } = require('../services/crawler');
const { chunkText } = require('../services/chunker');
const { embedBatch, vectorToSql } = require('../services/embeddings');
const { ingestLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

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

    const pages = await crawlSite(startUrl);
    console.log(`[Ingest] Crawled ${pages.length} pages`);

    let totalChunks = 0;
    let totalStored = 0;

    // Render free tier memory is tight — keep ingestion streamed and capped.
    // These caps prevent OOM on large pages / SPA bundles.
    const MAX_CHUNKS_PER_SITE = 300;
    const MAX_CHUNKS_PER_PAGE = 80;
    const EMBED_BATCH_SIZE = 20;

    for (const page of pages) {
      if (totalStored >= MAX_CHUNKS_PER_SITE) break;

      const pageChunks = chunkText(page.text).slice(0, MAX_CHUNKS_PER_PAGE);
      if (pageChunks.length === 0) continue;

      totalChunks += pageChunks.length;

      // Embed + insert in small batches to keep memory stable
      for (let i = 0; i < pageChunks.length; i += EMBED_BATCH_SIZE) {
        if (totalStored >= MAX_CHUNKS_PER_SITE) break;

        const chunkBatch = pageChunks.slice(i, i + EMBED_BATCH_SIZE);
        const embeddings = await embedBatch(chunkBatch);

        for (let j = 0; j < chunkBatch.length; j++) {
          if (totalStored >= MAX_CHUNKS_PER_SITE) break;
          await pool.query(
            `INSERT INTO documents (id, site_id, content, embedding, created_at)
             VALUES ($1, $2, $3, $4::vector, NOW())`,
            [uuidv4(), site_id, chunkBatch[j], vectorToSql(embeddings[j])]
          );
          totalStored++;
        }
      }
    }

    console.log(`[Ingest] Done. Stored ${totalStored} chunks for site ${site_id}`);

    return res.json({
      success: true,
      pages_crawled: pages.length,
      chunks_stored: totalStored,
      chunks_total: totalChunks,
    });
  } catch (err) {
    console.error('Ingest error:', err);
    return res.status(500).json({ error: 'Ingestion failed', details: err.message });
  }
});

module.exports = router;
