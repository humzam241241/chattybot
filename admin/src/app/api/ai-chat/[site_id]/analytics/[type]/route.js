import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request, { params }) {
  try {
    const { site_id, type } = await params;
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value || 
                  request.headers.get('x-supabase-token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = API_URL.replace(/\/$/, '');
    const response = await fetch(
      `${baseUrl}/api/admin/ai-chat/${site_id}/analytics/${type}?days=${days}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[api/ai-chat/analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
