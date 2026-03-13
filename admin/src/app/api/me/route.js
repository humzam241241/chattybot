import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../_utils/backend';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

export async function GET(request) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const res = await fetch(`${API_URL}/api/me`, {
    headers: auth.headers,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

