import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL;

export async function GET() {
  if (!API_URL) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const baseUrl = API_URL.replace(/\/$/, '');
  const backendUrl = `${baseUrl}/api/industries`;

  const res = await fetch(backendUrl, { cache: 'no-store' });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
