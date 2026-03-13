import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request, { params }) {
  try {
    const { site_id } = await params;
    const body = await request.json();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value || 
                  request.headers.get('x-supabase-token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = API_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/admin/ai-chat/${site_id}/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[api/ai-chat/intent] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
