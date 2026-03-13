import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../_utils/backend';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  const site_id = params?.site_id;
  if (!site_id) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
  }
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured: API_URL not set' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';

  try {
    const baseUrl = API_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/admin/conversations/site/${site_id}?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: auth.headers,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[API] Conversations fetch failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch conversations from backend' },
      { status: 502 }
    );
  }
}

