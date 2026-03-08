import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function backendHeaders(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  return {
    'Content-Type': 'application/json',
    Authorization: supabaseToken ? `Bearer ${supabaseToken}` : `Bearer ${ADMIN_SECRET}`,
  };
}

export async function PUT(request, { params }) {
  const { id } = params;
  const body = await request.json();

  const res = await fetch(`${API_URL}/api/admin/overview/users/${id}/pricing`, {
    method: 'PUT',
    headers: backendHeaders(request),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
