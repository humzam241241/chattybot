/**
 * Admin API client — calls Next.js API routes, NOT the backend directly.
 *
 * The backend URL and admin secret live in server-side env vars (no NEXT_PUBLIC_).
 * This means they are NEVER sent to the browser, preventing token leakage.
 *
 * Flow: Browser → /api/sites (Next.js server) → backend (with secret header)
 */

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }

  return res.json();
}

// All paths are relative — they hit the Next.js server, not the backend directly
export const getSites = () => apiFetch('/api/sites');
export const getSite = (id) => apiFetch(`/api/sites/${id}`);
export const createSite = (data) => apiFetch('/api/sites', { method: 'POST', body: JSON.stringify(data) });
export const updateSite = (id, data) => apiFetch(`/api/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSite = (id) => apiFetch(`/api/sites/${id}`, { method: 'DELETE' });

export const triggerIngest = (siteId) => apiFetch(`/api/ingest/${siteId}`, { method: 'POST' });

export const getLeads = (siteId) => apiFetch(`/api/leads/${siteId}`);
