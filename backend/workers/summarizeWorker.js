/**
 * Conversation Summary Worker
 * 
 * Two modes:
 * 1. Process pending summary jobs from conversation_summary_jobs table
 * 2. Auto-summarize idle conversations (idle for 5+ minutes)
 * 
 * Run with: node workers/summarizeWorker.js
 * Or deploy as a cron job: */5 * * * *
 */

require('dotenv').config();
const { Pool } = require('pg');
const OpenAI = require('openai');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 10;
const IDLE_MINUTES = 5;

const SUMMARY_PROMPT = `Summarize this customer conversation in 2 sentences.

Include:
• main problem or topic discussed
• urgency level (if apparent)
• whether contact info (email/phone) was provided

Be concise and factual. Focus on actionable insights.

Example:
"Customer reported roof leak after storm and asked about repair options. They requested someone to inspect the roof but did not provide contact info."`;

async function pollJobs() {
  console.log('[SummaryWorker] Polling for pending jobs...');
  
  try {
    // Fetch pending jobs
    const jobs = await pool.query(
      `SELECT id, conversation_id, site_id, created_at
       FROM conversation_summary_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (jobs.rows.length === 0) {
      console.log('[SummaryWorker] No pending jobs');
      return 0;
    }

    console.log(`[SummaryWorker] Processing ${jobs.rows.length} jobs`);

    // Process each job
    for (const job of jobs.rows) {
      await processJob(job);
    }

    return jobs.rows.length;
  } catch (err) {
    console.error('[SummaryWorker] Poll error:', err);
    return 0;
  }
}

async function processJob(job) {
  const { id: jobId, conversation_id } = job;
  
  console.log(`[SummaryWorker] Summarizing conversation: ${conversation_id}`);

  try {
    // Mark job as processing
    await pool.query(
      'UPDATE conversation_summary_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', jobId]
    );

    const summary = await generateSummary(conversation_id);

    // Mark job as done
    await markJobDone(jobId, summary);

    console.log(`[SummaryWorker] ✓ Completed job ${jobId}`);

  } catch (err) {
    console.error(`[SummaryWorker] Job ${jobId} failed:`, err);
    
    // Mark job as failed
    await pool.query(
      `UPDATE conversation_summary_jobs 
       SET status = 'failed', 
           error = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [err.message, jobId]
    );
  }
}

async function generateSummary(conversationId) {
  // Fetch all messages for the conversation
  const messages = await pool.query(
    `SELECT role, content, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );

  if (messages.rows.length === 0) {
    console.log(`[SummaryWorker] No messages found for conversation ${conversationId}`);
    return null;
  }

  // Build transcript
  const transcript = messages.rows
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  console.log(`[SummaryWorker] Transcript: ${transcript.length} chars`);

  // Generate summary with OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: `Conversation:\n\n${transcript}` },
    ],
    max_tokens: 150,
    temperature: 0.3,
  });

  const summary = completion.choices[0].message.content?.trim() || 'No summary generated';
  console.log(`[SummaryWorker] Summary: ${summary}`);

  // Update conversations table
  await pool.query(
    'UPDATE conversations SET summary = $1, last_summary_at = NOW(), updated_at = NOW() WHERE id = $2',
    [summary, conversationId]
  );

  return summary;
}

async function markJobDone(jobId, summary) {
  await pool.query(
    `UPDATE conversation_summary_jobs 
     SET status = 'done', 
         result = $1, 
         updated_at = NOW() 
     WHERE id = $2`,
    [summary ? JSON.stringify({ summary }) : null, jobId]
  );
}

async function summarizeIdleConversations() {
  console.log(`[SummaryWorker] Finding conversations idle for ${IDLE_MINUTES}+ minutes...`);

  try {
    // Find idle conversations without recent summary
    const conversations = await pool.query(`
      SELECT c.id
      FROM conversations c
      WHERE c.message_count >= 2
      AND c.updated_at <= NOW() - INTERVAL '${IDLE_MINUTES} minutes'
      AND (
        c.last_summary_at IS NULL
        OR c.last_summary_at < c.updated_at
      )
      ORDER BY c.updated_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);

    if (conversations.rows.length === 0) {
      console.log('[SummaryWorker] No idle conversations need summarizing');
      return 0;
    }

    console.log(`[SummaryWorker] Processing ${conversations.rows.length} idle conversations`);

    let count = 0;
    for (const row of conversations.rows) {
      try {
        await generateSummary(row.id);
        count++;
      } catch (err) {
        console.error(`[SummaryWorker] Failed to summarize ${row.id}:`, err.message);
      }
    }

    console.log(`[SummaryWorker] Summarized ${count} idle conversations`);
    return count;

  } catch (err) {
    console.error('[SummaryWorker] Error finding idle conversations:', err);
    return 0;
  }
}

// Main loop
async function run() {
  console.log('[SummaryWorker] Starting conversation summary worker...');
  
  // Process pending jobs first
  await pollJobs();
  
  // Then summarize idle conversations
  await summarizeIdleConversations();
  
  // Exit after one run (for cron-style execution)
  await pool.end();
  console.log('[SummaryWorker] Done');
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('[SummaryWorker] Unhandled rejection:', err);
  process.exit(1);
});

// Run
run();
