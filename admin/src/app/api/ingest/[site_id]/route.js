import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request, { params }) {
  const res = await fetch(`${API_URL}/ingest/${params.site_id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_SECRET}`,
    },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
