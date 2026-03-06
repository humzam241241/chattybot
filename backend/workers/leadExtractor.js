/**
 * Lead Extraction Worker
 * 
 * Analyzes conversation transcripts and extracts structured lead data
 * (name, phone, email, service requested, urgency, address).
 * 
 * Runs every 10 minutes via the worker scheduler.
 * Run manually: node workers/leadExtractor.js
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
const WORKER_NAME = 'LeadExtractor';

const BATCH_SIZE = 10;

const EXTRACTION_PROMPT = `You are a lead extraction system. Extract customer information from conversations.
Return ONLY valid JSON with these fields: name, phone, email, service_requested, urgency, address.
If a field is not mentioned, use null. Urgency should be "low", "medium", "high", or "emergency".
Example: {"name": "John Smith", "phone": "555-1234", "email": "john@example.com", "service_requested": "roof repair", "urgency": "high", "address": "123 Main St"}`;

async function pollConversations() {
  log(WORKER_NAME, 'Polling for conversations needing lead extraction...');
  
  try {
    const conversations = await pool.query(
      `SELECT c.id, c.site_id, c.message_count
       FROM conversations c
       WHERE c.message_count >= 4
       AND NOT EXISTS (
         SELECT 1 FROM leads l 
         WHERE l.conversation_id = c.id 
         AND l.extracted_at IS NOT NULL
       )
       ORDER BY c.updated_at DESC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (conversations.rows.length === 0) {
      log(WORKER_NAME, 'No conversations need processing');
      return;
    }

    log(WORKER_NAME, `Processing ${conversations.rows.length} conversations`);

    for (const convo of conversations.rows) {
      await extractLead(convo);
    }

  } catch (err) {
    logError(WORKER_NAME, 'Poll error', err);
  }
}

async function extractLead(conversation) {
  const { id: conversationId, site_id } = conversation;
  
  log(WORKER_NAME, `Extracting lead from conversation: ${conversationId}`);

  try {
    const messages = await pool.query(
      `SELECT role, content FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );

    if (messages.rows.length === 0) {
      log(WORKER_NAME, 'No messages found');
      return;
    }

    const transcript = messages.rows
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `Extract lead information from this conversation:\n\n${transcript}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.2,
    });

    const extracted = JSON.parse(completion.choices[0].message.content || '{}');
    log(WORKER_NAME, 'Extracted:', extracted);

    const hasData = extracted.name || extracted.phone || extracted.email;
    
    if (!hasData) {
      log(WORKER_NAME, `No lead data found in conversation ${conversationId}`);
      return;
    }

    await pool.query(
      `INSERT INTO leads (
        conversation_id,
        site_id,
        name,
        email,
        phone,
        issue,
        location,
        extracted_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (conversation_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        issue = EXCLUDED.issue,
        location = EXCLUDED.location,
        extracted_at = NOW()`,
      [
        conversationId,
        site_id,
        extracted.name || null,
        extracted.email || null,
        extracted.phone || null,
        extracted.service_requested || null,
        extracted.address || null,
      ]
    );

    log(WORKER_NAME, `✓ Lead extracted for conversation ${conversationId}`);

  } catch (err) {
    logError(WORKER_NAME, 'Failed to extract lead', err);
  }
}

async function run() {
  log(WORKER_NAME, 'Starting lead extraction worker...');
  
  await pollConversations();
  
  await pool.end();
  log(WORKER_NAME, 'Done');
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  logError(WORKER_NAME, 'Unhandled rejection', err);
  process.exit(1);
});

run();
