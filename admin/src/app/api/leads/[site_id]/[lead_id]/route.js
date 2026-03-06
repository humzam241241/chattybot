import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(request, { params }) {
  const res = await fetch(`${API_URL}/api/admin/leads/${params.site_id}/${params.lead_id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ADMIN_SECRET}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

