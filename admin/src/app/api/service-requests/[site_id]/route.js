import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../_utils/backend';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id } = params;
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/admin/service-requests/${site_id}${qs ? `?${qs}` : ''}`;

  const res = await fetch(backendUrl, { headers: auth.headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id } = params;
  const body = await request.json();
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/admin/service-requests/${site_id}`;

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
