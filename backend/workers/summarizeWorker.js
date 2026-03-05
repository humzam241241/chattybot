/**
 * Conversation Summary Worker
 * 
 * Polls conversation_summary_jobs table for pending jobs,
 * generates AI summaries, and updates the conversations table.
 * 
 * Run with: node workers/summarizeWorker.js
 * Or deploy as a cron job / background task
 */

const { Pool } = require('pg');
const OpenAI = require('openai');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 10;

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
      return;
    }

    console.log(`[SummaryWorker] Processing ${jobs.rows.length} jobs`);

    // Process each job
    for (const job of jobs.rows) {
      await processJob(job);
    }

  } catch (err) {
    console.error('[SummaryWorker] Poll error:', err);
  }
}

async function processJob(job) {
  const { id: jobId, conversation_id, site_id } = job;
  
  console.log(`[SummaryWorker] Summarizing conversation: ${conversation_id}`);

  try {
    // Mark job as processing
    await pool.query(
      'UPDATE conversation_summary_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', jobId]
    );

    // Fetch all messages for the conversation
    const messages = await pool.query(
      `SELECT role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversation_id]
    );

    if (messages.rows.length === 0) {
      console.log(`[SummaryWorker] No messages found for conversation ${conversation_id}`);
      await markJobDone(jobId, null);
      return;
    }

    // Build transcript
    const transcript = messages.rows
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    console.log(`[SummaryWorker] Transcript built: ${transcript.length} chars`);

    // Generate summary with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Summarize the customer request in one sentence for a CRM dashboard. Focus on what the customer needs and any urgency indicators.',
        },
        {
          role: 'user',
          content: `Conversation transcript:\n\n${transcript}\n\nSummary:`,
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    const summary = completion.choices[0].message.content?.trim() || 'No summary generated';
    console.log(`[SummaryWorker] Summary: ${summary}`);

    // Update conversations table
    await pool.query(
      'UPDATE conversations SET summary = $1, updated_at = NOW() WHERE id = $2',
      [summary, conversation_id]
    );

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

// Main loop
async function run() {
  console.log('[SummaryWorker] Starting conversation summary worker...');
  
  // Run once
  await pollJobs();
  
  // If running as a continuous worker, uncomment:
  // setInterval(pollJobs, 60000); // Poll every 60 seconds
  
  // Exit after one run (for cron-style execution)
  await pool.end();
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('[SummaryWorker] Unhandled rejection:', err);
  process.exit(1);
});

// Run
run();
