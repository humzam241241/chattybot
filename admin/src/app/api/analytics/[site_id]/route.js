const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request, { params }) {
  const { site_id } = await params;
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || '30';
  
  const res = await fetch(`${API_URL}/api/admin/analytics/${site_id}?days=${days}`, {
    headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    cache: 'no-store',
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
