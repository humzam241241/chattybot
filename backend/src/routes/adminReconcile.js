/**
 * Admin Data Reconciliation API
 * 
 * POST /api/admin/reconcile - Trigger manual data reconciliation
 */

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

/**
 * POST /api/admin/reconcile
 * Trigger data reconciliation manually
 */
router.post('/', async (req, res) => {
  console.log('[AdminReconcile] Manual reconciliation triggered');

  try {
    // Spawn the reconciliation worker as a child process
    const workerPath = path.join(__dirname, '../../workers/dataReconciliationWorker.js');
    const worker = spawn('node', [workerPath], {
      stdio: 'pipe',
      env: process.env,
    });

    let output = '';
    let errorOutput = '';

    worker.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[ReconcileWorker]', data.toString().trim());
    });

    worker.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('[ReconcileWorker] Error:', data.toString().trim());
    });

    worker.on('close', (code) => {
      console.log(`[ReconcileWorker] Process exited with code ${code}`);
    });

    // Return immediately - reconciliation runs in background
    res.json({
      message: 'Data reconciliation started',
      status: 'running',
      timestamp: new Date().toISOString(),
    });

    // Wait for completion (but response already sent)
    worker.on('close', (code) => {
      if (code === 0) {
        console.log('[AdminReconcile] Reconciliation completed successfully');
      } else {
        console.error(`[AdminReconcile] Reconciliation failed with code ${code}`);
      }
    });

  } catch (err) {
    console.error('[AdminReconcile] Error:', err);
    res.status(500).json({ error: 'Failed to start reconciliation' });
  }
});

/**
 * GET /api/admin/reconcile/status
 * Get reconciliation status (for future implementation with job tracking)
 */
router.get('/status', async (req, res) => {
  // For now, just return a placeholder
  res.json({
    message: 'Reconciliation status tracking not yet implemented',
    suggestion: 'Check backend logs for reconciliation results',
  });
});

module.exports = router;
