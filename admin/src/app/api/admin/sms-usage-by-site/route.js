import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export const dynamic = 'force-dynamic';

function backendHeaders(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  return {
    'Content-Type': 'application/json',
    Authorization: supabaseToken ? `Bearer ${supabaseToken}` : `Bearer ${ADMIN_SECRET}`,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || '30';

  const res = await fetch(`${API_URL}/api/admin/overview/sms-usage-by-site?days=${days}`, {
    headers: backendHeaders(request),
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
