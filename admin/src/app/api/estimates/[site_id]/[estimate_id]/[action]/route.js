import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../../_utils/backend';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL;

export async function POST(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id, estimate_id, action } = params;

  const validActions = ['approve', 'reject', 'send', 'response'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/admin/estimates/${site_id}/${estimate_id}/${action}`;

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
