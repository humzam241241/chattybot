import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function GET(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  if (!supabaseToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/api/stripe/subscription`, {
    headers: {
      Authorization: `Bearer ${supabaseToken}`,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
