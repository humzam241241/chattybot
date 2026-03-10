import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || '30';

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const res = await fetch(`${API_URL}/api/admin/overview/sms-usage-by-site?days=${days}`, {
    headers: auth.headers,
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
