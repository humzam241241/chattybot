/**
 * Missed Lead Detector Service
 * 
 * Detects conversations that likely contained a lead but no contact info was captured.
 * Sends alerts for potential missed opportunities.
 */

const pool = require('../config/database');
const { sendLeadEmail, isConfigured } = require('./emailService');

const LEAD_KEYWORDS = [
  'leak', 'leaking', 'repair', 'fix', 'broken',
  'quote', 'estimate', 'price', 'cost', 'pricing',
  'inspection', 'inspect', 'evaluate', 'assess',
  'damage', 'damaged', 'storm', 'hail', 'wind',
  'replace', 'replacement', 'new roof', 'install',
  'emergency', 'urgent', 'asap', 'today',
  'appointment', 'schedule', 'book', 'visit',
];

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /\b(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

/**
 * Detect missed leads in recent conversations
 * @param {number} minutesAgo - How far back to check (default 30 minutes)
 * @returns {Promise<Array>} List of missed lead records
 */
async function detectMissedLeads(minutesAgo = 30) {
  console.log(`[MissedLeadDetector] Scanning conversations from last ${minutesAgo} minutes...`);

  try {
    // Find conversations that:
    // 1. Have 3+ messages
    // 2. Updated in the time window
    // 3. Are "idle" (not updated in last 5 minutes - conversation likely ended)
    // 4. Don't already have a lead or missed_lead record
    const conversations = await pool.query(`
      SELECT 
        c.id,
        c.site_id,
        c.visitor_id,
        c.message_count,
        c.summary,
        c.updated_at,
        s.company_name,
        s.report_email
      FROM conversations c
      JOIN sites s ON c.site_id = s.id
      WHERE c.message_count >= 3
      AND c.updated_at >= NOW() - INTERVAL '${minutesAgo} minutes'
      AND c.updated_at <= NOW() - INTERVAL '5 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM leads l WHERE l.conversation_id = c.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM missed_leads ml WHERE ml.conversation_id = c.id
      )
      ORDER BY c.updated_at DESC
      LIMIT 20
    `);

    if (conversations.rows.length === 0) {
      console.log('[MissedLeadDetector] No conversations to check');
      return [];
    }

    console.log(`[MissedLeadDetector] Checking ${conversations.rows.length} conversations`);

    const missedLeads = [];

    for (const convo of conversations.rows) {
      const result = await analyzeConversation(convo);
      if (result.isMissedLead) {
        missedLeads.push(result);
      }
    }

    console.log(`[MissedLeadDetector] Found ${missedLeads.length} potential missed leads`);
    return missedLeads;
  } catch (err) {
    console.error('[MissedLeadDetector] Error:', err);
    return [];
  }
}

/**
 * Analyze a conversation for missed lead signals
 * @param {Object} conversation 
 * @returns {Promise<Object>}
 */
async function analyzeConversation(conversation) {
  const { id: conversationId, site_id, company_name, report_email } = conversation;

  try {
    // Fetch user messages
    const messages = await pool.query(`
      SELECT role, content
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [conversationId]);

    const userMessages = messages.rows
      .filter(m => m.role === 'user')
      .map(m => m.content);

    const allUserText = userMessages.join(' ').toLowerCase();

    // Check for contact info
    const hasEmail = EMAIL_REGEX.test(allUserText);
    const hasPhone = PHONE_REGEX.test(allUserText);

    if (hasEmail || hasPhone) {
      // Contact info was provided - not a missed lead
      return { isMissedLead: false, conversationId };
    }

    // Check for lead keywords
    const foundKeywords = LEAD_KEYWORDS.filter(kw => 
      allUserText.includes(kw.toLowerCase())
    );

    if (foundKeywords.length === 0) {
      // No lead signals - not a missed lead
      return { isMissedLead: false, conversationId };
    }

    // This is a potential missed lead
    console.log(`[MissedLeadDetector] Potential missed lead detected: ${conversationId}`);
    console.log(`[MissedLeadDetector] Keywords found: ${foundKeywords.join(', ')}`);

    const reason = `User discussed ${foundKeywords.slice(0, 3).join(', ')} but did not provide contact info`;

    // Store missed lead record
    await pool.query(`
      INSERT INTO missed_leads (site_id, conversation_id, reason, keywords_found, message_count)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (conversation_id) DO NOTHING
    `, [site_id, conversationId, reason, foundKeywords, conversation.message_count]);

    console.log(`[MissedLeadDetector] Missed lead recorded: ${conversationId}`);

    return {
      isMissedLead: true,
      conversationId,
      siteId: site_id,
      companyName: company_name,
      reportEmail: report_email,
      reason,
      keywordsFound: foundKeywords,
      summary: conversation.summary,
    };
  } catch (err) {
    console.error(`[MissedLeadDetector] Error analyzing conversation ${conversationId}:`, err);
    return { isMissedLead: false, conversationId };
  }
}

/**
 * Send missed lead alert email
 * @param {Object} missedLead 
 * @returns {Promise<boolean>}
 */
async function sendMissedLeadAlert(missedLead) {
  const email = missedLead.reportEmail || process.env.LEAD_NOTIFICATION_EMAIL;

  if (!email) {
    console.log('[MissedLeadDetector] No email configured for alerts');
    return false;
  }

  if (!isConfigured()) {
    console.log('[MissedLeadDetector] Email not configured');
    return false;
  }

  const adminUrl = process.env.ADMIN_DASHBOARD_URL
    ? `${process.env.ADMIN_DASHBOARD_URL}/sites/${missedLead.siteId}/conversations/${missedLead.conversationId}`
    : null;

  const body = `
═══════════════════════════════════════════════════════════
⚠️  POTENTIAL MISSED LEAD
    ${missedLead.companyName}
═══════════════════════════════════════════════════════════

A visitor expressed interest but did not leave contact info.

REASON
───────────────────────────────────────────────────────────
${missedLead.reason}

Keywords detected: ${missedLead.keywordsFound.join(', ')}

CONVERSATION SUMMARY
───────────────────────────────────────────────────────────
${missedLead.summary || '(No summary available)'}

${adminUrl ? `REVIEW CONVERSATION: ${adminUrl}` : ''}

═══════════════════════════════════════════════════════════
Consider following up or improving lead capture prompts.
`.trim();

  try {
    console.log(`[MissedLeadDetector] Sending alert to ${email}...`);

    const result = await sendLeadEmail({
      to: email,
      subject: `⚠️ Potential Missed Lead – ${missedLead.companyName}`,
      html: `<pre style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(body)}</pre>`,
    });
    if (!result?.success) {
      console.error('[MissedLeadDetector] Email send failed:', result?.reason || 'Unknown error');
      return false;
    }

    // Mark as notified
    await pool.query(
      `UPDATE missed_leads SET notified = TRUE WHERE conversation_id = $1`,
      [missedLead.conversationId]
    );

    console.log(`[MissedLeadDetector] Alert sent for conversation ${missedLead.conversationId}`);
    return true;
  } catch (err) {
    console.error('[MissedLeadDetector] Email send failed:', err);
    return false;
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

module.exports = {
  detectMissedLeads,
  analyzeConversation,
  sendMissedLeadAlert,
  LEAD_KEYWORDS,
};
