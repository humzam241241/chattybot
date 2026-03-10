import { NextResponse } from 'next/server';
import { requireBackendAuth } from '../../_utils/backend';

const API_URL = process.env.API_URL;

export async function GET(request) {
  try {
    const auth = requireBackendAuth(request);
    if (!auth.ok) return auth.response;

    const res = await fetch(`${API_URL}/api/admin/leads/debug/all`, {
      headers: auth.headers,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
