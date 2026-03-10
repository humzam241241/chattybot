/**
 * API route for RAG evaluation management
 */

import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
const API_URL = process.env.API_URL || BACKEND_URL;

async function requirePlatformAdmin(request) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (!API_URL) return { ok: false, response: NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }) };

  const r = await fetch(`${API_URL}/api/admin/overview?days=1`, { headers: auth.headers, cache: 'no-store' });
  if (!r.ok) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, headers: auth.headers };
}

// GET /api/rag-eval/[site_id] - Get latest evaluation report
export async function GET(request, { params }) {
  const { site_id } = params;

  try {
    const gate = await requirePlatformAdmin(request);
    if (!gate.ok) return gate.response;

    // Check if report file exists in backend
    const reportPath = path.join(process.cwd(), '..', 'backend', 'tests', 'ragEvaluationReport.json');
    
    if (!fs.existsSync(reportPath)) {
      return NextResponse.json({ error: 'No evaluation report found' }, { status: 404 });
    }

    const reportData = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(reportData);

    // Verify report is for this site
    if (report.summary.site_id !== site_id) {
      return NextResponse.json({ error: 'Report is for a different site' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error('Failed to load RAG evaluation report:', err);
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
  }
}

// POST /api/rag-eval/[site_id] - Run new evaluation
export async function POST(request, { params }) {
  const { site_id } = params;

  try {
    const gate = await requirePlatformAdmin(request);
    if (!gate.ok) return gate.response;

    // Run evaluation script
    const backendPath = path.join(process.cwd(), '..', 'backend');
    const { stdout, stderr } = await execAsync(
      `npm run test:rag -- --site_id=${site_id}`,
      { cwd: backendPath, timeout: 120000 } // 2 min timeout
    );

    console.log('[RAG Eval] Output:', stdout);
    if (stderr) console.warn('[RAG Eval] Stderr:', stderr);

    // Load the generated report
    const reportPath = path.join(backendPath, 'tests', 'ragEvaluationReport.json');
    const reportData = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(reportData);

    return NextResponse.json(report);
  } catch (err) {
    console.error('Failed to run RAG evaluation:', err);
    return NextResponse.json({ 
      error: 'Failed to run evaluation', 
      details: err.message 
    }, { status: 500 });
  }
}
