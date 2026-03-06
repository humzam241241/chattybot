import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const url = `${API_URL}/api/admin/leads/${params.site_id}`;
  console.log('[API/leads] Fetching:', url);
  
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_SECRET}`,
    },
  });
  const data = await res.json();
  
  console.log('[API/leads] Response status:', res.status, 'leads count:', data.leads?.length);
  
  return NextResponse.json(data, { status: res.status });
}
