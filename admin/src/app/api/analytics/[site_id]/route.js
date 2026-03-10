import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export async function GET(request, { params }) {
  const { site_id } = await params;
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || '30';
  
  const auth = requireBackendAuth(request);
  if (!auth.ok) return auth.response;

  const res = await fetch(`${API_URL}/api/admin/analytics/${site_id}?days=${days}`, {
    headers: auth.headers,
    cache: 'no-store',
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
