/**
 * Weekly Report Worker
 * 
 * Generates and sends weekly lead reports for each site.
 * Runs weekly on Sundays at midnight via the worker scheduler.
 * 
 * Run manually: node workers/weeklyReportWorker.js
 */

require('dotenv').config();

const OpenAI = require('openai');
const {
  createPool,
  sendEmail,
  getAdminUrl,
  log,
  logError,
} = require('../src/utils/workerUtils');

const pool = createPool();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WORKER_NAME = 'WeeklyReport';

async function generateWeeklyReports() {
  log(WORKER_NAME, 'Starting weekly report generation...');

  try {
    const sites = await pool.query(`
      SELECT id, company_name, report_email
      FROM sites
    `);

    if (sites.rows.length === 0) {
      log(WORKER_NAME, 'No sites found');
      return;
    }

    log(WORKER_NAME, `Processing ${sites.rows.length} sites`);

    for (const site of sites.rows) {
      await generateSiteReport(site);
    }

    log(WORKER_NAME, 'All reports generated');
  } catch (err) {
    logError(WORKER_NAME, 'Report generation failed', err);
  }
}

async function generateSiteReport(site) {
  const { id: siteId, company_name, report_email } = site;
  const email = report_email || process.env.LEAD_NOTIFICATION_EMAIL;

  log(WORKER_NAME, `Generating report for ${company_name}...`);

  try {
    const conversationStats = await pool.query(`
      SELECT COUNT(*) as total
      FROM conversations
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '7 days'
    `, [siteId]);

    const totalConversations = parseInt(conversationStats.rows[0]?.total || 0);

    const leadStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE lead_rating = 'HOT') as hot,
        COUNT(*) FILTER (WHERE lead_rating = 'WARM') as warm,
        COUNT(*) FILTER (WHERE lead_rating = 'COLD') as cold
      FROM leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '7 days'
    `, [siteId]);

    const totalLeads = parseInt(leadStats.rows[0]?.total || 0);
    const hotLeads = parseInt(leadStats.rows[0]?.hot || 0);
    const warmLeads = parseInt(leadStats.rows[0]?.warm || 0);
    const coldLeads = parseInt(leadStats.rows[0]?.cold || 0);

    const missedStats = await pool.query(`
      SELECT COUNT(*) as total
      FROM missed_leads
      WHERE site_id = $1
      AND created_at >= NOW() - INTERVAL '7 days'
    `, [siteId]);

    const missedLeads = parseInt(missedStats.rows[0]?.total || 0);
    const topQuestions = await getTopQuestions(siteId);

    const reportDate = new Date().toISOString().split('T')[0];
    await pool.query(`
      INSERT INTO weekly_reports (site_id, report_date, total_conversations, total_leads, hot_leads, warm_leads, cold_leads, missed_leads, top_questions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (site_id, report_date) DO UPDATE SET
        total_conversations = EXCLUDED.total_conversations,
        total_leads = EXCLUDED.total_leads,
        hot_leads = EXCLUDED.hot_leads,
        warm_leads = EXCLUDED.warm_leads,
        cold_leads = EXCLUDED.cold_leads,
        missed_leads = EXCLUDED.missed_leads,
        top_questions = EXCLUDED.top_questions
    `, [siteId, reportDate, totalConversations, totalLeads, hotLeads, warmLeads, coldLeads, missedLeads, JSON.stringify(topQuestions)]);

    log(WORKER_NAME, `Report generated for ${company_name}`);

    if (email) {
      await sendReportEmail({
        to: email,
        companyName: company_name,
        siteId,
        stats: { totalConversations, totalLeads, hotLeads, warmLeads, coldLeads, missedLeads },
        topQuestions,
      });
    } else {
      log(WORKER_NAME, 'No email configured, skipping send');
    }

  } catch (err) {
    logError(WORKER_NAME, `Failed to generate report for ${company_name}`, err);
  }
}

async function getTopQuestions(siteId) {
  try {
    const messages = await pool.query(`
      SELECT m.content
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.site_id = $1
      AND m.role = 'user'
      AND m.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [siteId]);

    if (messages.rows.length === 0) {
      return [];
    }

    const userMessages = messages.rows.map(m => m.content).join('\n---\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Analyze these customer messages and identify the top 5 most common questions or topics. Return as a JSON array of strings, each being a concise question/topic. Example: ["How much does roof repair cost?", "Do you offer financing?"]',
        },
        {
          role: 'user',
          content: `Customer messages:\n\n${userMessages}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return result.questions || result.topics || [];
  } catch (err) {
    logError(WORKER_NAME, 'Error getting top questions', err);
    return [];
  }
}

async function sendReportEmail({ to, companyName, siteId, stats, topQuestions }) {
  log(WORKER_NAME, `Sending email to ${to}...`);

  const adminUrl = getAdminUrl(`sites/${siteId}`);

  const questionsText = topQuestions.length > 0
    ? topQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')
    : '  (No questions this week)';

  const body = `
═══════════════════════════════════════════════════════════
📊  WEEKLY CHATBOT REPORT
    ${companyName}
═══════════════════════════════════════════════════════════

CONVERSATION METRICS (Last 7 Days)
───────────────────────────────────────────────────────────
Total Conversations:    ${stats.totalConversations}
Total Leads:            ${stats.totalLeads}

LEAD BREAKDOWN
───────────────────────────────────────────────────────────
🔴 HOT:     ${stats.hotLeads}
🟡 WARM:    ${stats.warmLeads}
⚪ COLD:    ${stats.coldLeads}
⚠️  Missed:  ${stats.missedLeads}

TOP CUSTOMER QUESTIONS
───────────────────────────────────────────────────────────
${questionsText}

${adminUrl ? `VIEW DASHBOARD: ${adminUrl}` : ''}

═══════════════════════════════════════════════════════════
This is an automated report from ChattyBot.
`.trim();

  const sent = await sendEmail({
    to,
    subject: `📊 Weekly Chatbot Report – ${companyName}`,
    text: body,
  });

  if (sent) {
    const reportDate = new Date().toISOString().split('T')[0];
    await pool.query(
      `UPDATE weekly_reports SET sent_at = NOW() WHERE site_id = $1 AND report_date = $2`,
      [siteId, reportDate]
    );
    log(WORKER_NAME, `Email sent to ${to}`);
  }
}

async function run() {
  log(WORKER_NAME, 'Starting weekly report worker...');
  
  await generateWeeklyReports();
  
  await pool.end();
  log(WORKER_NAME, 'Done');
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  logError(WORKER_NAME, 'Unhandled rejection', err);
  process.exit(1);
});

run();
