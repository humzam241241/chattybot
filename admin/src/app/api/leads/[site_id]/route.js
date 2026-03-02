import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request, { params }) {
  const res = await fetch(`${API_URL}/lead/${params.site_id}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_SECRET}`,
    },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
