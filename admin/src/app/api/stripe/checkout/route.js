import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function POST(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  if (!supabaseToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { plan } = body;

  const res = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      plan,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?canceled=true`,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
