import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function POST(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  if (!supabaseToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/api/stripe/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseToken}`,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
