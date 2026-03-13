import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../_utils/backend';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_URL = process.env.API_URL;

export async function GET(request) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured: API_URL not set' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/admin/conversations${qs ? `?${qs}` : ''}`;

  const res = await fetch(backendUrl, {
    headers: auth.headers,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}

