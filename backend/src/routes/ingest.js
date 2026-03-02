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

    // Process pages in batches to avoid OOM on large sites
    const BATCH_SIZE = 10;
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      const batch = pages.slice(i, i + BATCH_SIZE);

      // Collect all chunks for this batch of pages
      const allChunks = [];
      for (const page of batch) {
        const chunks = chunkText(page.text);
        chunks.forEach((chunk) => allChunks.push({ chunk, url: page.url }));
      }

      if (allChunks.length === 0) continue;
      totalChunks += allChunks.length;

      // Embed the entire batch in one API call
      const embeddings = await embedBatch(allChunks.map((c) => c.chunk));

      // Insert each chunk + embedding into the DB
      for (let j = 0; j < allChunks.length; j++) {
        const { chunk } = allChunks[j];
        const embedding = embeddings[j];

        await pool.query(
          `INSERT INTO documents (id, site_id, content, embedding, created_at)
           VALUES ($1, $2, $3, $4::vector, NOW())`,
          [uuidv4(), site_id, chunk, vectorToSql(embedding)]
        );
        totalStored++;
      }
    }

    console.log(`[Ingest] Done. Stored ${totalStored} chunks for site ${site_id}`);

    return res.json({
      success: true,
      pages_crawled: pages.length,
      chunks_stored: totalStored,
    });
  } catch (err) {
    console.error('Ingest error:', err);
    return res.status(500).json({ error: 'Ingestion failed', details: err.message });
  }
});

module.exports = router;
