/**
 * Lead Notification Service
 * 
 * Sends automatic lead intelligence emails to business owners when
 * high-value leads are detected (HOT or WARM rating).
 */

const pool = require('../config/database');
const { scoreLead } = require('./leadScore');
const { buildTranscript } = require('./transcript');
const { isConfigured } = require('./emailService');
const { sendEmail, sendSMS, sendWhatsApp } = require('./notificationService');
const { getEffectiveRaffySettings } = require('./raffySettings');
const { normalizePhoneE164 } = require('../utils/phone');

async function getBookingUrlForSite(siteId) {
  try {
    const settings = await getEffectiveRaffySettings(siteId);
    return settings?.raffy?.booking?.url || process.env.DEFAULT_BOOKING_URL || null;
  } catch (e) {
    return process.env.DEFAULT_BOOKING_URL || null;
  }
}

async function getSiteCommsConfig(siteId) {
  if (!siteId) {
    return {
      ownerEmail: (process.env.LEAD_NOTIFICATION_EMAIL || '').trim() || null,
      ownerSmsTo: null,
      ownerWhatsAppTo: null,
      siteFromSms: null,
      siteFromWhatsApp: null,
      reportEmail: null,
    };
  }

  const siteRes = await pool.query(
    `SELECT report_email, twilio_phone, twilio_whatsapp
     FROM sites
     WHERE id = $1::uuid`,
    [siteId]
  );
  const siteRow = siteRes.rows?.[0] || {};

  let settings = null;
  try {
    settings = await getEffectiveRaffySettings(siteId);
  } catch {
    settings = null;
  }

  const reportEmail = String(siteRow.report_email || '').trim() || null;
  const overrideLeadEmail = String(settings?.raffy?.notifications?.lead_email || '').trim() || null;
  const globalEmail = String(process.env.LEAD_NOTIFICATION_EMAIL || '').trim() || null;

  // Prefer per-site report_email for owner alerts; allow raffy override; fallback to global env.
  const ownerEmail = reportEmail || overrideLeadEmail || globalEmail || null;

  const ownerSmsTo = normalizePhoneE164(settings?.raffy?.notifications?.lead_sms_to) || null;
  const ownerWhatsAppTo = normalizePhoneE164(settings?.raffy?.notifications?.lead_whatsapp_to) || null;

  // Per-site Twilio "from" numbers (used for proactive outbound; wired in later step).
  const siteFromSms = normalizePhoneE164(siteRow.twilio_phone) || null;
  const siteFromWhatsApp = normalizePhoneE164(siteRow.twilio_whatsapp) || null;

  return { ownerEmail, ownerSmsTo, ownerWhatsAppTo, siteFromSms, siteFromWhatsApp, reportEmail };
}

function buildOwnerAlertText({ lead, siteName, adminUrl, isDuplicate }) {
  const subjectPrefix = isDuplicate ? 'RETURNING CONTACT' : `${lead.lead_rating} LEAD`;
  const lines = [
    `[${subjectPrefix}] ${siteName}`,
    lead.name ? `Name: ${lead.name}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.issue ? `Issue: ${lead.issue}` : null,
    lead.location ? `Location: ${lead.location}` : null,
    adminUrl ? `View: ${adminUrl}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Send lead notification email
 * @param {Object} params
 * @param {Object} params.lead - Lead data
 * @param {Object} params.conversation - Conversation data with messages
 * @param {string} params.siteName - Company name
 * @param {string} [params.adminUrl] - Admin dashboard URL for conversation
 * @param {boolean} [params.isDuplicate] - Whether this is a returning contact
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
async function sendLeadNotificationEmail({ lead, conversation, siteName, adminUrl, isDuplicate = false }) {
  const siteId = conversation?.site_id || null;
  const comms = await getSiteCommsConfig(siteId);

  if (!isConfigured()) {
    console.log('[LeadNotifier] Email not configured, skipping');
    return { success: false, reason: 'Email not configured' };
  }

  // Build transcript
  const transcript = buildTranscript(conversation);

  // Build email
  const subjectPrefix = isDuplicate ? 'RETURNING CONTACT' : `${lead.lead_rating} LEAD`;
  const subject = `[${subjectPrefix}] ${siteName} - ${lead.name || 'New Lead'}`;
  
  const headerText = isDuplicate 
    ? '🔄  RETURNING CONTACT - New Conversation'
    : `🔔  NEW ${lead.lead_rating} LEAD`;
  
  const urgency = lead.extraction_json?.urgency ? formatUrgency(lead.extraction_json.urgency) : 'Unknown';
  const html = `
    <h2>${escapeHtml(headerText)}</h2>
    <h3>Contact</h3>
    <ul>
      <li><b>Name:</b> ${escapeHtml(lead.name || 'Unknown')}</li>
      <li><b>Email:</b> ${escapeHtml(lead.email || 'Unknown')}</li>
      <li><b>Phone:</b> ${escapeHtml(lead.phone || 'Unknown')}</li>
      <li><b>Location:</b> ${escapeHtml(lead.location || 'Unknown')}</li>
    </ul>
    <h3>Lead</h3>
    <ul>
      <li><b>Issue:</b> ${escapeHtml(lead.issue || 'Not specified')}</li>
      <li><b>Urgency:</b> ${escapeHtml(urgency)}</li>
      <li><b>Score:</b> ${escapeHtml(String(lead.lead_score ?? ''))}</li>
      <li><b>Rating:</b> ${escapeHtml(lead.lead_rating || '')}</li>
    </ul>
    <h3>Site</h3>
    <ul>
      <li><b>Company:</b> ${escapeHtml(siteName)}</li>
      <li><b>Time:</b> ${escapeHtml(new Date(lead.created_at).toLocaleString())}</li>
      <li><b>Visitor ID:</b> ${escapeHtml(conversation.visitor_id || '(anonymous)')}</li>
    </ul>
    ${adminUrl ? `<p><a href="${escapeAttr(adminUrl)}">View conversation</a></p>` : ''}
    <h3>Transcript</h3>
    <pre style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(transcript)}</pre>
  `;

  try {
    console.log(`[LeadNotifier] Sending ${lead.lead_rating} lead email...`);

    // 1) Notify owner (all HOT/WARM notifications go here)
    if (comms.ownerEmail) {
      await sendEmail(comms.ownerEmail, subject, html);
    } else {
      console.log('[LeadNotifier] No owner notification email configured (report_email / raffy override / LEAD_NOTIFICATION_EMAIL).');
    }

    // Optional: notify owner by SMS / WhatsApp (destinations configured per-site in raffy_overrides)
    const ownerAlertText = buildOwnerAlertText({ lead, siteName, adminUrl, isDuplicate });
    if (comms.ownerSmsTo) {
      await sendSMS(comms.ownerSmsTo, ownerAlertText, { from: comms.siteFromSms || undefined });
    }
    if (comms.ownerWhatsAppTo) {
      await sendWhatsApp(comms.ownerWhatsAppTo, ownerAlertText, { from: comms.siteFromWhatsApp || undefined });
    }

    console.log(`[LeadNotifier] Email sent successfully`);

    // 2–4) Multi-channel follow-up for HOT leads only
    if (String(lead.lead_rating || '').toUpperCase() === 'HOT') {
      const bookingLink = await getBookingUrlForSite(conversation.site_id);
      const followupMessage = [
        `Thanks for contacting ${siteName}.`,
        '',
        `We've received your request regarding:`,
        `${lead.issue || 'your inquiry'}.`,
        '',
        `A technician will contact you shortly.`,
        bookingLink ? '' : null,
        bookingLink ? `If you'd like to schedule an inspection now:` : null,
        bookingLink ? bookingLink : null,
      ].filter(Boolean).join('\n');

      // 2) Send confirmation email to customer
      if (lead.email) {
        await sendEmail(
          lead.email,
          `${siteName} received your request`,
          `<pre style="white-space:pre-wrap;">${escapeHtml(followupMessage)}</pre>`
        );
      }

      // 3) Send SMS confirmation
      if (lead.phone) {
        await sendSMS(lead.phone, followupMessage, { from: comms.siteFromSms || undefined });
      }

      // 4) Send WhatsApp confirmation
      if (lead.phone) {
        await sendWhatsApp(lead.phone, followupMessage, { from: comms.siteFromWhatsApp || undefined });
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[LeadNotifier] Email send failed:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Format urgency for display
 * @param {string} urgency 
 * @returns {string}
 */
function formatUrgency(urgency) {
  const map = {
    today: '🔴 TODAY / URGENT',
    this_week: '🟡 This week',
    soon: '🟢 Soon',
    not_urgent: '⚪ Not urgent',
  };
  return map[urgency] || 'Unknown';
}

/**
 * Legacy function - Notify business owner of a high-value lead
 * (kept for backward compatibility with existing chat.js integration)
 * @param {Object} params
 * @param {string} params.conversationId - Conversation UUID
 * @param {string} params.siteId - Site UUID
 * @param {string} params.intent - Detected intent
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
async function notifyOwnerOfLead({ conversationId, siteId, intent }) {
  try {
    if (!isConfigured()) {
      console.log('[LeadNotifier] Email not configured, skipping notification');
      return { success: false, reason: 'Email not configured' };
    }

    // Fetch conversation with messages
    const convoRes = await pool.query(
      `SELECT c.id, c.site_id, c.visitor_id, c.summary, c.created_at, c.updated_at,
              s.company_name, s.report_email
       FROM conversations c
       JOIN sites s ON c.site_id = s.id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (convoRes.rows.length === 0) {
      console.warn('[LeadNotifier] Conversation not found:', conversationId);
      return { success: false, reason: 'Conversation not found' };
    }

    const conversation = convoRes.rows[0];

    // Fetch all messages
    const messagesRes = await pool.query(
      `SELECT role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    conversation.messages = messagesRes.rows;

    // Score the lead
    const { score, rating } = scoreLead({ intent, messages: conversation.messages });

    // Build transcript
    const transcript = buildTranscript(conversation);

    // Build email
    const subject = `[${rating} LEAD] ${conversation.company_name} Chatbot Lead`;
    
    const body = [
      `═══════════════════════════════════════`,
      `LEAD INTELLIGENCE ALERT`,
      `═══════════════════════════════════════`,
      '',
      `Lead Rating:    ${rating} (Score: ${score})`,
      `Intent:         ${intent.toUpperCase()}`,
      `Site:           ${conversation.company_name}`,
      `Timestamp:      ${new Date(conversation.created_at).toLocaleString()}`,
      `Visitor ID:     ${conversation.visitor_id || '(anonymous)'}`,
      '',
      `Summary:`,
      conversation.summary || '(No summary yet)',
      '',
      `═══════════════════════════════════════`,
      `CONVERSATION TRANSCRIPT`,
      `═══════════════════════════════════════`,
      '',
      transcript,
      '',
      `═══════════════════════════════════════`,
      `End of Lead Alert`,
      '',
    ].join('\n');

    // Send email (legacy path)
    console.log(`[LeadNotifier] Sending ${rating} lead email...`);
    const comms = await getSiteCommsConfig(conversation.site_id);
    const to = comms.ownerEmail;
    if (!to) {
      console.log('[LeadNotifier] No owner notification email configured (report_email / raffy override / LEAD_NOTIFICATION_EMAIL).');
      return { success: false, reason: 'No notification email configured' };
    }
    await sendEmail(
      to,
      subject,
      `<pre style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(body)}</pre>`
    );

    console.log(`[LeadNotifier] Sent ${rating} lead notification for conversation ${conversationId}`);

    // Store lead score in DB
    await pool.query(
      `UPDATE conversations SET lead_score = $1, lead_rating = $2, updated_at = NOW() WHERE id = $3`,
      [score, rating, conversationId]
    ).catch((err) => {
      console.warn('[LeadNotifier] Could not store lead_score:', err.message);
    });

    return { success: true };
  } catch (err) {
    console.error('[LeadNotifier] Failed to send lead notification:', err);
    return { success: false, reason: err.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

module.exports = { 
  notifyOwnerOfLead,
  sendLeadNotificationEmail,
};
