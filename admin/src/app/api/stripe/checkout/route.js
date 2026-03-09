import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function POST(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  if (!supabaseToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { plan, site_id } = body;

  const res = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      plan,
      site_id: site_id || undefined,
      successUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`
        : undefined,
      cancelUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`
        : undefined,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
