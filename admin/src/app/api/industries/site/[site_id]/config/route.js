import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../../_utils/backend';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

export async function GET(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id } = params;
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/industries/site/${site_id}/config`;

  const res = await fetch(backendUrl, { headers: auth.headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id } = params;
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/industries/site/${site_id}/config`;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
