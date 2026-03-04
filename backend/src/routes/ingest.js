const express = require('express');
const pool = require('../config/database');
const { runIngestion } = require('../ingest/ingestRunner');
const { ingestLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Prevent concurrent ingestion jobs for the same site
const ingestLocks = new Set();

/**
 * POST /ingest/:site_id
 * 
 * Triggers full site ingestion using the modular ingestion pipeline:
 * 1. Crawls the site with Playwright (React/SPA support)
 * 2. Extracts and validates content
 * 3. Chunks text with overlap
 * 4. Generates embeddings
 * 5. Stores in PostgreSQL with pgvector
 * 
 * Admin-only endpoint with rate limiting
 */
router.post('/:site_id', adminAuth, ingestLimiter, async (req, res) => {
  const { site_id } = req.params;

  // Check if ingestion is already running
  if (ingestLocks.has(site_id)) {
    return res.status(409).json({ 
      error: 'Ingestion already running for this site',
      site_id 
    });
  }

  ingestLocks.add(site_id);

  try {
    // Fetch site from database
    const siteResult = await pool.query(
      'SELECT id, company_name, domain FROM sites WHERE id = $1',
      [site_id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];
    
    if (!site.domain) {
      return res.status(400).json({ 
        error: 'Site has no domain configured',
        site_id 
      });
    }

    // Normalize start URL
    const startUrl = site.domain.startsWith('http') 
      ? site.domain 
      : `https://${site.domain}`;

    console.log(`[Ingest] Request received for site ${site.company_name} (${site_id})`);

    // Run the modular ingestion pipeline
    const result = await runIngestion(site_id, startUrl);

    if (!result.success) {
      return res.status(500).json({
        error: 'Ingestion failed',
        details: result.error,
        site_id,
        duration: result.duration
      });
    }

    // Return detailed summary
    return res.json({
      success: true,
      site_id,
      company_name: site.company_name,
      pages_crawled: result.pagesCrawled,
      links_discovered: result.linksDiscovered,
      chunks_created: result.chunksCreated,
      chunks_stored: result.chunksStored,
      duration_seconds: result.duration,
      message: `Successfully ingested ${result.chunksStored} chunks from ${result.pagesCrawled} pages`
    });

  } catch (err) {
    console.error('[Ingest] Error:', err);
    return res.status(500).json({ 
      error: 'Ingestion failed', 
      details: err.message,
      site_id 
    });
  } finally {
    ingestLocks.delete(site_id);
  }
});

/**
 * GET /ingest/:site_id/status
 * 
 * Returns ingestion status for a site
 */
router.get('/:site_id/status', adminAuth, async (req, res) => {
  const { site_id } = req.params;

  try {
    // Check if ingestion is running
    const isRunning = ingestLocks.has(site_id);

    // Get document count
    const countResult = await pool.query(
      'SELECT COUNT(*) as chunk_count FROM documents WHERE site_id = $1',
      [site_id]
    );

    const chunkCount = parseInt(countResult.rows[0]?.chunk_count || 0);

    // Get last ingestion time
    const lastIngestResult = await pool.query(
      'SELECT MAX(created_at) as last_ingestion FROM documents WHERE site_id = $1',
      [site_id]
    );

    const lastIngestion = lastIngestResult.rows[0]?.last_ingestion;

    return res.json({
      site_id,
      is_running: isRunning,
      chunk_count: chunkCount,
      last_ingestion: lastIngestion,
      has_data: chunkCount > 0
    });

  } catch (err) {
    console.error('[Ingest] Status check error:', err);
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
