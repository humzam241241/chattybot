import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../_utils/backend';

const API_URL = process.env.API_URL;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/sites`, { headers: auth.headers, cache: 'no-store' });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const res = await fetch(`${API_URL}/sites`, {
    method: 'POST',
    headers: auth.headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
