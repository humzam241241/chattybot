import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request) {
  const formData = await request.formData();

  const res = await fetch(`${API_URL}/api/admin/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_SECRET}`,
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

