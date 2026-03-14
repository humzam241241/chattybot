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

  if (res.status === 204) return null;
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

// CRM (admin-proxy → backend /api/admin)
const crm = (path, options = {}) => apiFetch(`/api/admin-proxy/${path}`, options);
export const getCustomers = (siteId, q) => crm(`customers/${siteId}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const createCustomer = (siteId, data) => crm(`customers/${siteId}`, { method: 'POST', body: JSON.stringify(data) });
export const getCustomer = (siteId, customerId) => crm(`customers/${siteId}/${customerId}`);
export const updateCustomer = (siteId, customerId, data) => crm(`customers/${siteId}/${customerId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCustomer = (siteId, customerId) => crm(`customers/${siteId}/${customerId}`, { method: 'DELETE' });
export const addCustomerAddress = (siteId, customerId, data) => crm(`customers/${siteId}/${customerId}/addresses`, { method: 'POST', body: JSON.stringify(data) });

export const getJobs = (siteId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.customer_id) params.set('customer_id', opts.customer_id);
  return crm(`jobs/${siteId}${params.toString() ? `?${params}` : ''}`);
};
export const createJob = (siteId, data) => crm(`jobs/${siteId}`, { method: 'POST', body: JSON.stringify(data) });
export const createJobFromRequest = (siteId, requestId, options = {}) => crm(`jobs/${siteId}/from-request`, { method: 'POST', body: JSON.stringify({ request_id: requestId, ...options }) });
export const createJobFromEstimate = (siteId, estimateId, options = {}) => crm(`jobs/${siteId}/from-estimate`, { method: 'POST', body: JSON.stringify({ estimate_id: estimateId, ...options }) });
export const getJob = (siteId, jobId) => crm(`jobs/${siteId}/${jobId}`);
export const updateJob = (siteId, jobId, data) => crm(`jobs/${siteId}/${jobId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const addJobTask = (siteId, jobId, data) => crm(`jobs/${siteId}/${jobId}/tasks`, { method: 'POST', body: JSON.stringify(data) });
export const updateJobTask = (siteId, jobId, taskId, data) => crm(`jobs/${siteId}/${jobId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getTechnicians = (siteId, activeOnly) => crm(`technicians/${siteId}${activeOnly ? '?active=true' : ''}`);
export const createTechnician = (siteId, data) => crm(`technicians/${siteId}`, { method: 'POST', body: JSON.stringify(data) });
export const updateTechnician = (siteId, techId, data) => crm(`technicians/${siteId}/${techId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getAppointments = (siteId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.technician_id) params.set('technician_id', opts.technician_id);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  return crm(`appointments/${siteId}${params.toString() ? `?${params}` : ''}`);
};
export const getScheduleForDay = (siteId, date) => crm(`appointments/${siteId}/schedule/${date}`);
export const createAppointment = (siteId, data) => crm(`appointments/${siteId}`, { method: 'POST', body: JSON.stringify(data) });
export const updateAppointment = (siteId, appointmentId, data) => crm(`appointments/${siteId}/${appointmentId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const assignTechnicianToAppointment = (siteId, appointmentId, technicianId) => crm(`appointments/${siteId}/${appointmentId}/assign`, { method: 'POST', body: JSON.stringify({ technician_id: technicianId }) });

export const getInvoices = (siteId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.customer_id) params.set('customer_id', opts.customer_id);
  if (opts.status) params.set('status', opts.status);
  return crm(`invoices/${siteId}${params.toString() ? `?${params}` : ''}`);
};
export const createInvoice = (siteId, data) => crm(`invoices/${siteId}`, { method: 'POST', body: JSON.stringify(data) });
export const getInvoice = (siteId, invoiceId) => crm(`invoices/${siteId}/${invoiceId}`);
export const addInvoiceLineItem = (siteId, invoiceId, data) => crm(`invoices/${siteId}/${invoiceId}/line-items`, { method: 'POST', body: JSON.stringify(data) });
export const updateInvoiceLineItem = (siteId, invoiceId, lineId, data) => crm(`invoices/${siteId}/${invoiceId}/line-items/${lineId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const sendInvoice = (siteId, invoiceId) => crm(`invoices/${siteId}/${invoiceId}/send`, { method: 'POST' });
export const markInvoicePaid = (siteId, invoiceId) => crm(`invoices/${siteId}/${invoiceId}/mark-paid`, { method: 'POST' });

export const getPayments = (siteId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.customer_id) params.set('customer_id', opts.customer_id);
  return crm(`payments/${siteId}${params.toString() ? `?${params}` : ''}`);
};
export const getPaymentsByInvoice = (siteId, invoiceId) => crm(`payments/${siteId}/invoice/${invoiceId}`);
export const recordPayment = (siteId, data) => crm(`payments/${siteId}`, { method: 'POST', body: JSON.stringify(data) });

export const getPipelineSummary = (siteId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.from_date) params.set('from_date', opts.from_date);
  if (opts.to_date) params.set('to_date', opts.to_date);
  return crm(`pipeline/${siteId}${params.toString() ? `?${params}` : ''}`);
};

