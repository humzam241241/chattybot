import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../../../../_utils/backend';

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const { conversation_id, message_id } = params;
  const backendUrl = `${API_URL}/api/admin/conversations/${conversation_id}/messages/${message_id}/media`;

  const res = await fetch(backendUrl, { headers: auth.headers });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
