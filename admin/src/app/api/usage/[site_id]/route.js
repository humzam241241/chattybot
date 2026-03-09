import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function backendHeaders(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  return {
    'Content-Type': 'application/json',
    Authorization: supabaseToken ? `Bearer ${supabaseToken}` : `Bearer ${ADMIN_SECRET}`,
  };
}

export async function GET(request, { params }) {
  const { site_id } = params;
  const res = await fetch(`${API_URL}/api/usage?site_id=${site_id}`, {
    headers: backendHeaders(request),
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

