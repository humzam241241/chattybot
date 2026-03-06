/**
 * Conversation Summary Worker
 * 
 * Two modes:
 * 1. Process pending summary jobs from conversation_summary_jobs table
 * 2. Auto-summarize idle conversations (idle for 5+ minutes)
 * 
 * Runs every 5 minutes via the worker scheduler.
 * Run manually: node workers/summarizeWorker.js
 */

require('dotenv').config();

const OpenAI = require('openai');
const {
  createPool,
  log,
  logError,
} = require('../src/utils/workerUtils');

const pool = createPool();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WORKER_NAME = 'SummaryWorker';

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
  log(WORKER_NAME, 'Polling for pending jobs...');
  
  try {
    const jobs = await pool.query(
      `SELECT id, conversation_id, site_id, created_at
       FROM conversation_summary_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (jobs.rows.length === 0) {
      log(WORKER_NAME, 'No pending jobs');
      return 0;
    }

    log(WORKER_NAME, `Processing ${jobs.rows.length} jobs`);

    for (const job of jobs.rows) {
      await processJob(job);
    }

    return jobs.rows.length;
  } catch (err) {
    logError(WORKER_NAME, 'Poll error', err);
    return 0;
  }
}

async function processJob(job) {
  const { id: jobId, conversation_id } = job;
  
  log(WORKER_NAME, `Summarizing conversation: ${conversation_id}`);

  try {
    await pool.query(
      'UPDATE conversation_summary_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', jobId]
    );

    const summary = await generateSummary(conversation_id);

    await pool.query(
      `UPDATE conversation_summary_jobs 
       SET status = 'done', 
           result = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [summary ? JSON.stringify({ summary }) : null, jobId]
    );

    log(WORKER_NAME, `✓ Completed job ${jobId}`);

  } catch (err) {
    logError(WORKER_NAME, `Job ${jobId} failed`, err);
    
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
  const messages = await pool.query(
    `SELECT role, content, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );

  if (messages.rows.length === 0) {
    log(WORKER_NAME, `No messages found for conversation ${conversationId}`);
    return null;
  }

  const transcript = messages.rows
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  log(WORKER_NAME, `Transcript: ${transcript.length} chars`);

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
  log(WORKER_NAME, `Summary: ${summary}`);

  await pool.query(
    'UPDATE conversations SET summary = $1, last_summary_at = NOW(), updated_at = NOW() WHERE id = $2',
    [summary, conversationId]
  );

  return summary;
}

async function summarizeIdleConversations() {
  log(WORKER_NAME, `Finding conversations idle for ${IDLE_MINUTES}+ minutes...`);

  try {
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
      log(WORKER_NAME, 'No idle conversations need summarizing');
      return 0;
    }

    log(WORKER_NAME, `Processing ${conversations.rows.length} idle conversations`);

    let count = 0;
    for (const row of conversations.rows) {
      try {
        await generateSummary(row.id);
        count++;
      } catch (err) {
        logError(WORKER_NAME, `Failed to summarize ${row.id}`, err);
      }
    }

    log(WORKER_NAME, `Summarized ${count} idle conversations`);
    return count;

  } catch (err) {
    logError(WORKER_NAME, 'Error finding idle conversations', err);
    return 0;
  }
}

async function run() {
  log(WORKER_NAME, 'Starting conversation summary worker...');
  
  await pollJobs();
  await summarizeIdleConversations();
  
  await pool.end();
  log(WORKER_NAME, 'Done');
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  logError(WORKER_NAME, 'Unhandled rejection', err);
  process.exit(1);
});

run();
