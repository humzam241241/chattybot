import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const url = `${API_URL}/api/admin/leads/${params.site_id}`;
  console.log('[API/leads] Fetching:', url);
  
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: auth.headers,
  });
  const data = await res.json();
  
  console.log('[API/leads] Response status:', res.status, 'leads count:', data.leads?.length);
  
  return NextResponse.json(data, { status: res.status });
}
