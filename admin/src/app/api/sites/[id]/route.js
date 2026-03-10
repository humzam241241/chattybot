import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/sites/${params.id}`, { headers: auth.headers });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const res = await fetch(`${API_URL}/sites/${params.id}`, {
    method: 'PUT',
    headers: auth.headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;
  const res = await fetch(`${API_URL}/sites/${params.id}`, {
    method: 'DELETE',
    headers: auth.headers,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
