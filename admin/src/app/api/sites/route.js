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

export async function GET(request) {
  const res = await fetch(`${API_URL}/sites`, { headers: backendHeaders(request), cache: 'no-store' });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/sites`, {
    method: 'POST',
    headers: backendHeaders(request),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
