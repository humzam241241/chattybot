import { NextResponse } from 'next/server';

export function getBackendAuthHeaders(request) {
  const supabaseToken = request.headers.get('x-supabase-token');
  if (!supabaseToken) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${supabaseToken}`,
  };
}

export function requireBackendAuth(request) {
  const headers = getBackendAuthHeaders(request);
  if (!headers) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      headers: null,
    };
  }
  return { ok: true, response: null, headers };
}

