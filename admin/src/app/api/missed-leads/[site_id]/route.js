const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request, { params }) {
  const { site_id } = await params;
  
  const res = await fetch(`${API_URL}/api/admin/missed-leads/${site_id}`, {
    headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    cache: 'no-store',
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
