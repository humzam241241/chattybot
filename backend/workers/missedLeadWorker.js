/**
 * Missed Lead Worker
 * 
 * Detects conversations with potential leads where no contact info was captured.
 * Sends alerts for missed opportunities.
 * 
 * Runs every 5 minutes via the worker scheduler.
 * Run manually: node workers/missedLeadWorker.js
 */

require('dotenv').config();

const {
  createPool,
  sendEmail,
  getAdminUrl,
  log,
  logError,
  detectContactInfo,
  detectLeadKeywords,
} = require('../src/utils/workerUtils');

const pool = createPool();
const WORKER_NAME = 'MissedLeadDetector';

async function detectMissedLeads() {
  log(WORKER_NAME, 'Scanning for potential missed leads...');

  try {
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
      log(WORKER_NAME, 'No conversations to check');
      return;
    }

    log(WORKER_NAME, `Checking ${conversations.rows.length} conversations`);

    for (const convo of conversations.rows) {
      await analyzeAndAlert(convo);
    }

  } catch (err) {
    logError(WORKER_NAME, 'Detection failed', err);
  }
}

async function analyzeAndAlert(conversation) {
  const { id: conversationId, site_id, company_name, report_email, summary, message_count } = conversation;

  try {
    const messages = await pool.query(`
      SELECT role, content
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [conversationId]);

    const userMessages = messages.rows
      .filter(m => m.role === 'user')
      .map(m => m.content);

    const allUserText = userMessages.join(' ');
    const contactInfo = detectContactInfo(allUserText);

    if (contactInfo.hasEmail || contactInfo.hasPhone) {
      return; // Contact info was provided - not a missed lead
    }

    const foundKeywords = detectLeadKeywords(allUserText);

    if (foundKeywords.length === 0) {
      return; // No lead signals
    }

    log(WORKER_NAME, `Potential missed lead: ${conversationId}`);
    log(WORKER_NAME, `Keywords: ${foundKeywords.join(', ')}`);

    const reason = `User discussed ${foundKeywords.slice(0, 3).join(', ')} but did not provide contact info`;

    await pool.query(`
      INSERT INTO missed_leads (site_id, conversation_id, reason, keywords_found, message_count)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (conversation_id) DO NOTHING
    `, [site_id, conversationId, reason, foundKeywords, message_count]);

    log(WORKER_NAME, `Missed lead recorded: ${conversationId}`);

    await sendMissedLeadAlert({
      conversationId,
      siteId: site_id,
      companyName: company_name,
      reportEmail: report_email,
      reason,
      keywordsFound: foundKeywords,
      summary,
    });

  } catch (err) {
    logError(WORKER_NAME, `Error analyzing conversation ${conversationId}`, err);
  }
}

async function sendMissedLeadAlert(missedLead) {
  const email = missedLead.reportEmail || process.env.LEAD_NOTIFICATION_EMAIL;
  if (!email) {
    log(WORKER_NAME, 'No email configured');
    return;
  }

  const adminUrl = getAdminUrl(`sites/${missedLead.siteId}/conversations/${missedLead.conversationId}`);

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

  const sent = await sendEmail({
    to: email,
    subject: `⚠️ Potential Missed Lead – ${missedLead.companyName}`,
    text: body,
  });

  if (sent) {
    await pool.query(
      `UPDATE missed_leads SET notified = TRUE WHERE conversation_id = $1`,
      [missedLead.conversationId]
    );
    log(WORKER_NAME, `Alert sent for ${missedLead.conversationId}`);
  }
}

async function run() {
  log(WORKER_NAME, 'Starting missed lead detection worker...');
  
  await detectMissedLeads();
  
  await pool.end();
  log(WORKER_NAME, 'Done');
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  logError(WORKER_NAME, 'Unhandled rejection', err);
  process.exit(1);
});

run();
