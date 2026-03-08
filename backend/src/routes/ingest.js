const express = require('express');
const pool = require('../config/database');
const { runIngestion } = require('../ingest/ingestRunner');
const { ingestLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');
const { trackApiUsage } = require('../middleware/usageTracking');

const router = express.Router();

// Track running ingestion jobs {siteId → {status, result, startedAt}}
const ingestJobs = new Map();

/**
 * POST /ingest/:site_id
 *
 * Kicks off ingestion in the background and returns immediately.
 * The admin UI polls GET /ingest/:site_id/status for progress.
 */
router.post('/:site_id', adminAuth, ingestLimiter, async (req, res) => {
  const { site_id } = req.params;

  if (ingestJobs.has(site_id) && ingestJobs.get(site_id).status === 'running') {
    return res.status(409).json({
      error: 'Ingestion already running for this site',
      site_id,
    });
  }

  try {
    const siteResult = await pool.query(
      'SELECT id, company_name, domain FROM sites WHERE id = $1',
      [site_id],
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];

    if (!site.domain) {
      return res.status(400).json({ error: 'Site has no domain configured', site_id });
    }

    const startUrl = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;

    trackApiUsage(site_id, 'ingest').catch(() => {});

    console.log(`[Ingest] Request received for site ${site.company_name} (${site_id})`);

    // Mark job as running
    ingestJobs.set(site_id, { status: 'running', startedAt: Date.now(), result: null });

    // Return 202 immediately — crawl runs in the background
    res.status(202).json({
      success: true,
      message: 'Ingestion started. Poll GET /ingest/:site_id/status for progress.',
      site_id,
    });

    // Run ingestion in the background (not awaited by the request)
    runIngestion(site_id, startUrl)
      .then((result) => {
        ingestJobs.set(site_id, {
          status: result.success ? 'done' : 'error',
          startedAt: ingestJobs.get(site_id)?.startedAt,
          finishedAt: Date.now(),
          result,
        });
        console.log(`[Ingest] Background job finished for ${site_id}: ${result.success ? 'success' : 'error'}`);
      })
      .catch((err) => {
        console.error(`[Ingest] Background job crashed for ${site_id}:`, err);
        ingestJobs.set(site_id, {
          status: 'error',
          startedAt: ingestJobs.get(site_id)?.startedAt,
          finishedAt: Date.now(),
          result: { success: false, error: err.message },
        });
      });

  } catch (err) {
    console.error('[Ingest] Error:', err);
    return res.status(500).json({ error: 'Ingestion failed to start', details: err.message });
  }
});

/**
 * GET /ingest/:site_id/status
 *
 * Returns current ingestion status: running, done, error, or idle.
 */
router.get('/:site_id/status', adminAuth, async (req, res) => {
  const { site_id } = req.params;

  try {
    const job = ingestJobs.get(site_id);

    // Get document count from DB regardless
    const countResult = await pool.query(
      'SELECT COUNT(*) as chunk_count FROM documents WHERE site_id = $1',
      [site_id],
    );
    const chunkCount = parseInt(countResult.rows[0]?.chunk_count || 0);

    const lastIngestResult = await pool.query(
      'SELECT MAX(created_at) as last_ingestion FROM documents WHERE site_id = $1',
      [site_id],
    );
    const lastIngestion = lastIngestResult.rows[0]?.last_ingestion;

    if (!job) {
      return res.json({
        site_id,
        status: 'idle',
        chunk_count: chunkCount,
        last_ingestion: lastIngestion,
      });
    }

    const elapsed = Math.round((Date.now() - job.startedAt) / 1000);

    return res.json({
      site_id,
      status: job.status,
      chunk_count: chunkCount,
      last_ingestion: lastIngestion,
      elapsed_seconds: elapsed,
      result: job.status !== 'running' ? job.result : undefined,
    });

  } catch (err) {
    console.error('[Ingest] Status check error:', err);
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
