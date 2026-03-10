import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/api/admin/conversations/${params.conversation_id}`, {
    headers: auth.headers,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/api/admin/conversations/${params.conversation_id}`, {
    method: 'DELETE',
    headers: auth.headers,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
