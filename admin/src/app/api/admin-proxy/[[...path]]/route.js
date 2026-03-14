import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

function getBackendUrl(pathname, request) {
  if (!API_URL) return null;
  const base = API_URL.replace(/\/$/, '');
  const path = pathname.join('/');
  const qs = request.nextUrl.searchParams.toString();
  return `${base}/api/admin/${path}${qs ? `?${qs}` : ''}`;
}

export async function GET(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const pathname = params.path || [];
  const url = getBackendUrl(pathname, request);
  const res = await fetch(url, { headers: auth.headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const pathname = params.path || [];
  const url = getBackendUrl(pathname, request);
  const body = await request.text();
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: body || undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const pathname = params.path || [];
  const url = getBackendUrl(pathname, request);
  const body = await request.text();
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: body || undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const pathname = params.path || [];
  const url = getBackendUrl(pathname, request);
  const res = await fetch(url, { method: 'DELETE', headers: auth.headers });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
