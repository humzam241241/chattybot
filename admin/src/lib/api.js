/**
 * Admin API client — calls Next.js API routes, NOT the backend directly.
 *
 * The backend URL and admin secret live in server-side env vars (no NEXT_PUBLIC_).
 * This means they are NEVER sent to the browser, preventing token leakage.
 *
 * Flow: Browser → /api/sites (Next.js server) → backend (with secret header)
 */

import { getAccessToken } from './supabase';

async function apiFetch(path, options = {}) {
  const accessToken = await getAccessToken();
  
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { 'X-Supabase-Token': accessToken }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg =
      err.error ||
      (Array.isArray(err.errors) && err.errors.length
        ? err.errors.map((e) => e.msg || e.message).filter(Boolean).join('. ')
        : null) ||
      res.statusText ||
      'API error';
    throw new Error(msg);
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
export const getIngestStatus = (siteId) => apiFetch(`/api/ingest/${siteId}`);

export const getLeads = (siteId) => apiFetch(`/api/leads/${siteId}`);
export const rescoreLeads = (siteId) => apiFetch(`/api/leads/${siteId}/rescore`, { method: 'POST' });
export const deleteLead = (siteId, leadId) => apiFetch(`/api/leads/${siteId}/${leadId}`, { method: 'DELETE' });
export const clearLeads = (siteId) => apiFetch(`/api/leads/${siteId}/clear`, { method: 'DELETE' });

// Files
export const listFiles = (siteId) => apiFetch(`/api/files/site/${siteId}`);
export const reprocessFile = (fileId) => apiFetch(`/api/files/reprocess/${fileId}`, { method: 'POST' });
export const deleteFile = (fileId) => apiFetch(`/api/files/file/${fileId}`, { method: 'DELETE' });
export async function uploadFiles(siteId, files) {
  const formData = new FormData();
  formData.append('site_id', siteId);
  for (const f of files) formData.append('files', f);

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Unauthorized (no session). Please sign in again.');
  }

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: {
      'X-Supabase-Token': accessToken,
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

// Conversations
export const listConversations = (siteId, { limit = 50, offset = 0, channel } = {}) => {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  if (channel) params.set('channel', channel); // 'sms' | 'whatsapp'
  const qs = params.toString();
  return apiFetch(`/api/conversations/site/${siteId}${qs ? `?${qs}` : ''}`);
};
export const getConversation = (conversationId) => apiFetch(`/api/conversations/${conversationId}`);
export const deleteConversation = (conversationId) => apiFetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });

// Cross-site admin/owner views
export const listAllConversations = ({ siteId, q, channel, limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  if (siteId) params.set('site_id', siteId);
  if (q) params.set('q', q);
  if (channel) params.set('channel', channel); // 'sms' | 'whatsapp'
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiFetch(`/api/conversations?${params.toString()}`);
};

export const listAllLeads = ({ siteId, q, rating, limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  if (siteId) params.set('site_id', siteId);
  if (q) params.set('q', q);
  if (rating) params.set('rating', rating);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiFetch(`/api/leads/all?${params.toString()}`);
};

// Missed Leads
export const getMissedLeads = (siteId) => apiFetch(`/api/missed-leads/${siteId}`);
export const getMissedLeadStats = (siteId) => apiFetch(`/api/missed-leads/${siteId}/stats`);

// Weekly Reports
export const getWeeklyReports = (siteId) => apiFetch(`/api/reports/${siteId}`);

// Analytics
export const getAnalytics = (siteId) => apiFetch(`/api/analytics/${siteId}`);

// Data Reconciliation
export const triggerReconciliation = () => apiFetch('/api/reconcile', { method: 'POST' });

// Admin Overview
export const getAdminOverview = (days = 30) => apiFetch(`/api/admin/overview?days=${days}`);
export const getAdminUsers = () => apiFetch('/api/admin/users');
export const updateUserPricing = (userId, customPricing) => 
  apiFetch(`/api/admin/users/${userId}/pricing`, { method: 'PUT', body: JSON.stringify({ custom_pricing: customPricing }) });
export const getLeadsBySite = (days = 30) => apiFetch(`/api/admin/leads-by-site?days=${days}`);
export const getApiUsageBySite = (days = 30) => apiFetch(`/api/admin/api-usage-by-site?days=${days}`);
export const getSmsUsageBySite = (days = 30) => apiFetch(`/api/admin/sms-usage-by-site?days=${days}`);

// Stripe
export const createCheckoutSession = (plan, siteId) => 
  apiFetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan, site_id: siteId }) });
export const getPortalUrl = () => apiFetch('/api/stripe/portal', { method: 'POST' });
export const getSubscriptionStatus = () => apiFetch('/api/stripe/subscription');

// Usage
export const getUsage = (siteId) => apiFetch(`/api/usage/${siteId}`);

