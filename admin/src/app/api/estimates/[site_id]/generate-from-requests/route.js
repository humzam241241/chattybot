import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../_utils/backend';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

export async function POST(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id } = params;
  const baseUrl = API_URL.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/admin/estimates/${site_id}/generate-from-requests`, {
    method: 'POST',
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
