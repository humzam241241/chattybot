import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../_utils/backend';

const API_URL = process.env.API_URL;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/api/admin/leads/${params.site_id}/${params.lead_id}`, {
    method: 'DELETE',
    headers: auth.headers,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

