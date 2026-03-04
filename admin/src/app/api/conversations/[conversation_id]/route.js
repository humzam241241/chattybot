import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request, { params }) {
  const res = await fetch(`${API_URL}/api/admin/conversations/${params.conversation_id}`, {
    headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

