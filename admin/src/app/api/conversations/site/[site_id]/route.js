import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request, { params }) {
  const site_id = params?.site_id;
  if (!site_id) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
  }
  if (!API_URL || !ADMIN_SECRET) {
    console.error('[API] Missing API_URL or ADMIN_SECRET in env');
    return NextResponse.json(
      { error: 'Server misconfigured: API_URL or ADMIN_SECRET not set' },
      { status: 500 }
    );
  }

  try {
    const url = `${API_URL.replace(/\/$/, '')}/api/admin/conversations/site/${site_id}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
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

