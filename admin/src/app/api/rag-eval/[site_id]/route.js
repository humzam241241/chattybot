/**
 * API route for RAG evaluation — proxies to backend.
 * GET: latest report for site. POST: run evaluation and return report.
 */
import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

async function proxy(method, request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  if (!API_URL) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { site_id } = params;
  const baseUrl = API_URL.replace(/\/$/, '');
  const url = `${baseUrl}/api/admin/rag-eval/${site_id}`;

  const opts = {
    method,
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    cache: 'no-store',
  };
  if (method === 'POST') {
    opts.body = JSON.stringify({});
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(request, { params }) {
  return proxy('GET', request, { params });
}

export async function POST(request, { params }) {
  return proxy('POST', request, { params });
}
