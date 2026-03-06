/**
 * Missed Lead Worker
 * 
 * Detects conversations with potential leads where no contact info was captured.
 * Sends alerts for missed opportunities.
 * 
 * Run every 5 minutes via cron: */5 * * * *
 * Run manually: node workers/missedLeadWorker.js
 */

require('dotenv').config();

// Import after dotenv so env vars are available
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Re-implement the detector logic here to avoid module path issues in workers
const nodemailer = require('nodemailer');

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

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function detectMissedLeads() {
  console.log('[MissedLeadDetector] Scanning for potential missed leads...');

  try {
    // Find idle conversations with signals but no contact captured
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
      AND c.updated_at >= NOW() - INTERVAL '30 minutes'
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
      return;
    }

    console.log(`[MissedLeadDetector] Checking ${conversations.rows.length} conversations`);

    for (const convo of conversations.rows) {
      await analyzeAndAlert(convo);
    }

  } catch (err) {
    console.error('[MissedLeadDetector] Error:', err);
  }
}

async function analyzeAndAlert(conversation) {
  const { id: conversationId, site_id, company_name, report_email, summary, message_count } = conversation;

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
      return;
    }

    // Check for lead keywords
    const foundKeywords = LEAD_KEYWORDS.filter(kw => 
      allUserText.includes(kw.toLowerCase())
    );

    if (foundKeywords.length === 0) {
      // No lead signals
      return;
    }

    // This is a potential missed lead
    console.log(`[MissedLeadDetector] Potential missed lead: ${conversationId}`);
    console.log(`[MissedLeadDetector] Keywords: ${foundKeywords.join(', ')}`);

    const reason = `User discussed ${foundKeywords.slice(0, 3).join(', ')} but did not provide contact info`;

    // Store missed lead record
    await pool.query(`
      INSERT INTO missed_leads (site_id, conversation_id, reason, keywords_found, message_count)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (conversation_id) DO NOTHING
    `, [site_id, conversationId, reason, foundKeywords, message_count]);

    console.log(`[MissedLeadDetector] Missed lead recorded: ${conversationId}`);

    // Send alert
    await sendAlert({
      conversationId,
      siteId: site_id,
      companyName: company_name,
      reportEmail: report_email,
      reason,
      keywordsFound: foundKeywords,
      summary,
    });

  } catch (err) {
    console.error(`[MissedLeadDetector] Error analyzing conversation ${conversationId}:`, err);
  }
}

async function sendAlert(missedLead) {
  const email = missedLead.reportEmail || process.env.LEAD_NOTIFICATION_EMAIL;

  if (!email) {
    console.log('[MissedLeadDetector] No email configured');
    return;
  }

  if (!isSmtpConfigured()) {
    console.log('[MissedLeadDetector] SMTP not configured');
    return;
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

    const transport = getTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `⚠️ Potential Missed Lead – ${missedLead.companyName}`,
      text: body,
    });

    // Mark as notified
    await pool.query(
      `UPDATE missed_leads SET notified = TRUE WHERE conversation_id = $1`,
      [missedLead.conversationId]
    );

    console.log(`[MissedLeadDetector] Alert sent for ${missedLead.conversationId}`);
  } catch (err) {
    console.error('[MissedLeadDetector] Email failed:', err);
  }
}

// Main
async function run() {
  console.log('[MissedLeadDetector] Starting missed lead detection worker...');
  
  await detectMissedLeads();
  
  await pool.end();
  console.log('[MissedLeadDetector] Done');
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  console.error('[MissedLeadDetector] Unhandled rejection:', err);
  process.exit(1);
});

run();
