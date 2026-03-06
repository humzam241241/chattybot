/**
 * Data Reconciliation Worker
 * 
 * Scans the database to find and recover missing lead data:
 * 1. Scan ALL conversations for contact info (comprehensive)
 * 2. Re-scan missed_leads to recover
 * 3. Re-extract partial leads to fill missing fields
 * 
 * Runs daily at 2 AM or on-demand via admin API.
 * Run manually: node workers/dataReconciliationWorker.js
 */

require('dotenv').config();

const OpenAI = require('openai');
const {
  createPool,
  log,
  logError,
  detectContactInfo,
} = require('../src/utils/workerUtils');
const { scoreLead } = require('../src/services/leadScore');

const pool = createPool();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WORKER_NAME = 'DataReconciliation';

const EXTRACTION_PROMPT = `You are a lead extraction system. Extract customer information from conversations.
Return ONLY valid JSON with these fields: name, phone, email, service_requested, urgency, address.
If a field is not mentioned, use null. Urgency should be "low", "medium", "high", or "emergency".
Example: {"name": "John Smith", "phone": "555-1234", "email": "john@example.com", "service_requested": "roof repair", "urgency": "high", "address": "123 Main St"}`;

// Multiple regex patterns for better detection
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX_STANDARD = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const PHONE_REGEX_SIMPLE = /\b\d{10}\b/g;
const PHONE_REGEX_DASHED = /\b\d{3}[-]\d{3}[-]\d{4}\b/g;

function extractContactFromText(text) {
  const emails = text.match(EMAIL_REGEX) || [];
  const phonesStandard = text.match(PHONE_REGEX_STANDARD) || [];
  const phonesSimple = text.match(PHONE_REGEX_SIMPLE) || [];
  const phonesDashed = text.match(PHONE_REGEX_DASHED) || [];
  
  const allPhones = [...new Set([...phonesStandard, ...phonesSimple, ...phonesDashed])];
  
  return {
    emails: [...new Set(emails)],
    phones: allPhones,
    hasEmail: emails.length > 0,
    hasPhone: allPhones.length > 0,
  };
}

async function reconcileData() {
  log(WORKER_NAME, '=== Starting data reconciliation ===');
  log(WORKER_NAME, 'This will scan ALL conversations for missed contact info');
  
  const stats = {
    conversationsScanned: 0,
    newLeadsFound: 0,
    leadsUpdated: 0,
    missedLeadsRecovered: 0,
    errors: 0,
  };

  try {
    // Step 1: Scan ALL conversations for contact info
    await scanAllConversations(stats);
    
    // Step 2: Update missed_leads table
    await updateMissedLeads(stats);
    
    log(WORKER_NAME, '=== Reconciliation complete ===');
    log(WORKER_NAME, `Results: ${JSON.stringify(stats, null, 2)}`);
    
    return stats;
  } catch (err) {
    logError(WORKER_NAME, 'Reconciliation failed', err);
    throw err;
  }
}

/**
 * Step 1: Scan ALL conversations for contact info
 */
async function scanAllConversations(stats) {
  log(WORKER_NAME, '[Step 1] Scanning ALL conversations for contact info...');
  
  try {
    // Get all conversations with messages
    const conversations = await pool.query(`
      SELECT c.id, c.site_id, c.message_count,
             EXISTS (SELECT 1 FROM leads l WHERE l.conversation_id = c.id) as has_lead
      FROM conversations c
      WHERE c.message_count >= 2
      ORDER BY c.updated_at DESC
      LIMIT 200
    `);

    log(WORKER_NAME, `Found ${conversations.rows.length} conversations to scan`);

    for (const convo of conversations.rows) {
      try {
        stats.conversationsScanned++;
        
        // Get all messages for this conversation
        const messages = await pool.query(
          `SELECT role, content FROM messages 
           WHERE conversation_id = $1 
           ORDER BY created_at ASC`,
          [convo.id]
        );

        if (messages.rows.length === 0) continue;

        // Extract user text
        const userText = messages.rows
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' ');

        // Use regex to find contact info
        const contactInfo = extractContactFromText(userText);
        
        if (!contactInfo.hasEmail && !contactInfo.hasPhone) {
          continue;
        }
        
        log(WORKER_NAME, `Found contact in conversation ${convo.id}: email=${contactInfo.hasEmail}, phone=${contactInfo.hasPhone}`);

        // Run OpenAI extraction for more details
        const transcript = messages.rows
          .map(m => `${m.role}: ${m.content}`)
          .join('\n');

        let extracted = {};
        try {
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
          extracted = JSON.parse(completion.choices[0].message.content || '{}');
        } catch (aiErr) {
          log(WORKER_NAME, `OpenAI extraction failed, using regex only: ${aiErr.message}`);
        }

        // Merge regex results (regex takes priority if AI missed them)
        if (contactInfo.hasEmail && !extracted.email) {
          extracted.email = contactInfo.emails[0];
        }
        if (contactInfo.hasPhone && !extracted.phone) {
          extracted.phone = contactInfo.phones[0];
        }

        if (!extracted.email && !extracted.phone) {
          continue;
        }

        // Score the lead
        const { score, rating } = scoreLead({
          messages: messages.rows,
          extracted,
        });

        // Check if lead already exists
        const existingLead = await pool.query(
          `SELECT id, email, phone, name FROM leads WHERE conversation_id = $1`,
          [convo.id]
        );

        if (existingLead.rows.length > 0) {
          // Update existing lead if we found more info
          const existing = existingLead.rows[0];
          const needsUpdate = 
            (!existing.email && extracted.email) ||
            (!existing.phone && extracted.phone) ||
            (!existing.name && extracted.name);
          
          if (needsUpdate) {
            await pool.query(
              `UPDATE leads SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                phone = COALESCE($3, phone),
                issue = COALESCE($4, issue),
                location = COALESCE($5, location),
                lead_score = $6,
                lead_rating = $7,
                extracted_at = NOW()
               WHERE conversation_id = $8`,
              [
                extracted.name || null,
                extracted.email || null,
                extracted.phone || null,
                extracted.service_requested || null,
                extracted.address || null,
                score,
                rating,
                convo.id,
              ]
            );
            stats.leadsUpdated++;
            log(WORKER_NAME, `✓ Updated lead: ${convo.id}`);
          }
        } else {
          // Create new lead
          await pool.query(
            `INSERT INTO leads (
              conversation_id,
              site_id,
              name,
              email,
              phone,
              issue,
              location,
              lead_score,
              lead_rating,
              extracted_at,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (conversation_id)
            DO UPDATE SET
              name = COALESCE(EXCLUDED.name, leads.name),
              email = COALESCE(EXCLUDED.email, leads.email),
              phone = COALESCE(EXCLUDED.phone, leads.phone),
              issue = COALESCE(EXCLUDED.issue, leads.issue),
              location = COALESCE(EXCLUDED.location, leads.location),
              lead_score = EXCLUDED.lead_score,
              lead_rating = EXCLUDED.lead_rating,
              extracted_at = NOW()`,
            [
              convo.id,
              convo.site_id,
              extracted.name || null,
              extracted.email || null,
              extracted.phone || null,
              extracted.service_requested || null,
              extracted.address || null,
              score,
              rating,
            ]
          );
          stats.newLeadsFound++;
          log(WORKER_NAME, `✓ Created new lead: ${convo.id} (${rating}) - email: ${extracted.email}, phone: ${extracted.phone}`);
        }
        
      } catch (err) {
        logError(WORKER_NAME, `Failed to process conversation ${convo.id}`, err);
        stats.errors++;
      }
    }
    
    log(WORKER_NAME, `[Step 1] Scanned ${stats.conversationsScanned} conversations, found ${stats.newLeadsFound} new leads, updated ${stats.leadsUpdated}`);
  } catch (err) {
    logError(WORKER_NAME, 'Step 1 failed', err);
    throw err;
  }
}

/**
 * Step 2: Mark recovered missed_leads
 */
async function updateMissedLeads(stats) {
  log(WORKER_NAME, '[Step 2] Updating missed_leads table...');
  
  try {
    // Check if recovered_at column exists
    const columnCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'missed_leads' AND column_name = 'recovered_at'
    `);
    
    if (columnCheck.rows.length === 0) {
      log(WORKER_NAME, 'recovered_at column does not exist, skipping missed_leads update');
      log(WORKER_NAME, 'Run migration 008 to add this column');
      return;
    }
    
    // Mark missed_leads as recovered if they now have a lead
    const result = await pool.query(`
      UPDATE missed_leads ml
      SET recovered_at = NOW()
      WHERE ml.recovered_at IS NULL
      AND EXISTS (
        SELECT 1 FROM leads l 
        WHERE l.conversation_id = ml.conversation_id
        AND (l.email IS NOT NULL OR l.phone IS NOT NULL)
      )
    `);
    
    stats.missedLeadsRecovered = result.rowCount;
    log(WORKER_NAME, `[Step 2] Marked ${result.rowCount} missed_leads as recovered`);
  } catch (err) {
    logError(WORKER_NAME, 'Step 2 failed', err);
  }
}

async function run() {
  log(WORKER_NAME, 'Starting data reconciliation worker...');
  log(WORKER_NAME, `Database: ${process.env.DATABASE_URL ? 'connected' : 'NOT CONFIGURED'}`);
  log(WORKER_NAME, `OpenAI: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT CONFIGURED'}`);
  
  try {
    const stats = await reconcileData();
    log(WORKER_NAME, 'Done');
    await pool.end();
    process.exit(0);
  } catch (err) {
    logError(WORKER_NAME, 'Worker failed', err);
    await pool.end();
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  logError(WORKER_NAME, 'Unhandled rejection', err);
  process.exit(1);
});

// Export for on-demand use via admin API
module.exports = { reconcileData };

// Run if called directly
if (require.main === module) {
  run();
}
