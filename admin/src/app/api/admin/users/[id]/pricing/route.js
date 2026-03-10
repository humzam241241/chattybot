import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../../_utils/backend';

const API_URL = process.env.API_URL;

export async function PUT(request, { params }) {
  const { id } = params;
  const body = await request.json();

  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const res = await fetch(`${API_URL}/api/admin/overview/users/${id}/pricing`, {
    method: 'PUT',
    headers: auth.headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
