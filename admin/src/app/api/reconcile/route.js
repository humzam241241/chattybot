import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../_utils/backend';

const API_URL = process.env.API_URL;

export async function POST(request) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const res = await fetch(`${API_URL}/api/admin/reconcile`, {
    method: 'POST',
    headers: auth.headers,
  });
  
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
