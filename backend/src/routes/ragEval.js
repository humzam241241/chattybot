/**
 * RAG evaluation API for admin dashboard.
 * GET: return latest report if present for site.
 * POST: run RAG evaluation script and return report.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { userAuth } = require('../middleware/userAuth');
const { requireAdmin } = require('../middleware/userAuth');

const execAsync = promisify(exec);
const router = express.Router();

router.use(userAuth);
router.use(requireAdmin);

const REPORT_FILENAME = 'ragEvaluationReport.json';

function getReportPath() {
  return path.join(process.cwd(), 'tests', REPORT_FILENAME);
}

/**
 * GET /api/admin/rag-eval/:site_id
 * Return latest evaluation report for site if it exists.
 */
router.get('/:site_id', async (req, res) => {
  const { site_id } = req.params;
  const reportPath = getReportPath();

  try {
    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ error: 'No evaluation report found' });
    }
    const data = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(data);
    if (report.summary && report.summary.site_id !== site_id) {
      return res.status(404).json({ error: 'Report is for a different site' });
    }
    return res.json(report);
  } catch (err) {
    console.error('[RAG Eval] Failed to load report:', err);
    return res.status(500).json({ error: 'Failed to load report' });
  }
});

/**
 * POST /api/admin/rag-eval/:site_id
 * Run RAG evaluation script and return the generated report.
 */
router.post('/:site_id', async (req, res) => {
  const { site_id } = req.params;
  const scriptPath = path.join(process.cwd(), 'tests', 'runRagEvaluation.js');

  if (!fs.existsSync(scriptPath)) {
    return res.status(503).json({
      error: 'RAG evaluation script not available',
      details: 'tests/runRagEvaluation.js not found',
    });
  }

  try {
    const { stdout, stderr } = await execAsync(
      `node "${scriptPath}" --site_id=${site_id}`,
      { cwd: process.cwd(), timeout: 120000 }
    );
    if (stderr) console.warn('[RAG Eval] stderr:', stderr);
    console.log('[RAG Eval] stdout:', stdout);

    const reportPath = getReportPath();
    if (!fs.existsSync(reportPath)) {
      return res.status(500).json({ error: 'Evaluation ran but no report was produced' });
    }
    const data = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(data);
    return res.json(report);
  } catch (err) {
    console.error('[RAG Eval] Run failed:', err);
    return res.status(500).json({
      error: 'Failed to run evaluation',
      details: err.message || 'Unknown error',
    });
  }
});

module.exports = router;
