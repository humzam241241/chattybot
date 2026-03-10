import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export async function POST(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/ingest/${params.site_id}`, {
    method: 'POST',
    headers: auth.headers,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/ingest/${params.site_id}/status`, {
    headers: auth.headers,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
