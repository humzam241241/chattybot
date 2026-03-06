/**
 * Lead Webhook Service
 * 
 * Sends lead data to external CRM systems via webhooks.
 * Sites can configure a lead_webhook_url to receive lead payloads.
 */

const axios = require('axios');

/**
 * Send lead data to configured webhook URL
 * @param {Object} params
 * @param {string} params.webhookUrl - Target webhook URL
 * @param {Object} params.lead - Lead data to send
 * @param {string} params.siteId - Site ID
 * @param {string} params.siteName - Company name
 * @returns {Promise<{success: boolean, statusCode?: number, error?: string}>}
 */
async function sendLeadWebhook({ webhookUrl, lead, siteId, siteName }) {
  if (!webhookUrl) {
    console.log('[LeadWebhook] No webhook URL configured, skipping');
    return { success: false, error: 'No webhook URL' };
  }

  const payload = {
    event: 'lead.created',
    timestamp: new Date().toISOString(),
    site: {
      id: siteId,
      name: siteName,
    },
    lead: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      issue: lead.issue,
      location: lead.location,
      lead_score: lead.lead_score,
      lead_rating: lead.lead_rating,
      conversation_id: lead.conversation_id,
      created_at: lead.created_at,
    },
  };

  try {
    console.log(`[LeadWebhook] Sending to ${webhookUrl}...`);

    const response = await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChattyBot-Webhook/1.0',
      },
    });

    console.log(`[LeadWebhook] Success - Status: ${response.status}`);
    return { success: true, statusCode: response.status };
  } catch (err) {
    const statusCode = err.response?.status;
    const errorMsg = err.response?.data?.message || err.message;
    
    console.error(`[LeadWebhook] Failed - Status: ${statusCode || 'N/A'}, Error: ${errorMsg}`);
    
    return {
      success: false,
      statusCode,
      error: errorMsg,
    };
  }
}

/**
 * Retry webhook with exponential backoff
 * @param {Object} params - Same as sendLeadWebhook
 * @param {number} maxRetries - Max retry attempts (default 3)
 * @returns {Promise<{success: boolean, attempts: number, error?: string}>}
 */
async function sendLeadWebhookWithRetry(params, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendLeadWebhook(params);
    
    if (result.success) {
      return { success: true, attempts: attempt };
    }
    
    lastError = result.error;
    
    // Don't retry on client errors (4xx)
    if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
      console.log(`[LeadWebhook] Client error (${result.statusCode}), not retrying`);
      break;
    }
    
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[LeadWebhook] Retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return { success: false, attempts: maxRetries, error: lastError };
}

module.exports = {
  sendLeadWebhook,
  sendLeadWebhookWithRetry,
};
