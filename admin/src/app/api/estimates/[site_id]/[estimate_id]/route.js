import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../../_utils/backend';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { site_id, estimate_id } = params;
  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/admin/estimates/${site_id}/${estimate_id}`;

  const res = await fetch(backendUrl, { headers: auth.headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
