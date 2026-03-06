/**
 * Data Reconciliation Worker
 * 
 * Scans the database to find and recover missing lead data:
 * 1. Re-scan missed_leads to see if contact info appeared in later messages
 * 2. Re-scan conversations with no lead (comprehensive extraction)
 * 3. Re-extract partial leads to fill missing fields
 * 4. Optionally backfill summaries
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

// Relaxed phone regex for recovery - matches 10 consecutive digits
const RELAXED_PHONE_REGEX = /\b\d{10}\b/g;

async function reconcileData() {
  log(WORKER_NAME, '=== Starting data reconciliation ===');
  
  const stats = {
    missedLeadsRecovered: 0,
    newLeadsFound: 0,
    partialLeadsUpdated: 0,
    errors: 0,
  };

  try {
    // Step 1: Re-scan missed_leads
    await rescanMissedLeads(stats);
    
    // Step 2: Re-scan conversations with no lead
    await rescanUnleadedConversations(stats);
    
    // Step 3: Re-extract partial leads
    await rescanPartialLeads(stats);
    
    log(WORKER_NAME, '=== Reconciliation complete ===');
    log(WORKER_NAME, `Results: ${JSON.stringify(stats, null, 2)}`);
    
    return stats;
  } catch (err) {
    logError(WORKER_NAME, 'Reconciliation failed', err);
    throw err;
  }
}

/**
 * Step 1: Re-scan missed_leads to find contact info that may have appeared later
 */
async function rescanMissedLeads(stats) {
  log(WORKER_NAME, '[Step 1] Re-scanning missed_leads for recovered contact info...');
  
  try {
    const missedLeads = await pool.query(`
      SELECT ml.id, ml.conversation_id, ml.site_id, c.message_count
      FROM missed_leads ml
      JOIN conversations c ON ml.conversation_id = c.id
      WHERE ml.recovered_at IS NULL
      AND c.message_count >= 3
      ORDER BY ml.created_at DESC
      LIMIT 50
    `);

    if (missedLeads.rows.length === 0) {
      log(WORKER_NAME, 'No missed leads to re-scan');
      return;
    }

    log(WORKER_NAME, `Re-scanning ${missedLeads.rows.length} missed leads`);

    for (const missed of missedLeads.rows) {
      try {
        const recovered = await tryRecoverMissedLead(missed);
        if (recovered) {
          stats.missedLeadsRecovered++;
          
          // Mark as recovered
          await pool.query(
            `UPDATE missed_leads SET recovered_at = NOW() WHERE id = $1`,
            [missed.id]
          );
        }
      } catch (err) {
        logError(WORKER_NAME, `Failed to recover missed lead ${missed.id}`, err);
        stats.errors++;
      }
    }
    
    log(WORKER_NAME, `[Step 1] Recovered ${stats.missedLeadsRecovered} missed leads`);
  } catch (err) {
    logError(WORKER_NAME, 'Step 1 failed', err);
    throw err;
  }
}

/**
 * Try to recover a missed lead by re-extracting contact info
 */
async function tryRecoverMissedLead(missed) {
  const { conversation_id, site_id } = missed;
  
  // Fetch all messages
  const messages = await pool.query(
    `SELECT role, content FROM messages 
     WHERE conversation_id = $1 
     ORDER BY created_at ASC`,
    [conversation_id]
  );

  if (messages.rows.length === 0) return false;

  // Try relaxed regex first
  const userText = messages.rows
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  const contactInfo = detectContactInfo(userText);
  
  // Also try relaxed phone pattern
  const relaxedPhones = userText.match(RELAXED_PHONE_REGEX) || [];
  if (relaxedPhones.length > 0 && !contactInfo.hasPhone) {
    contactInfo.hasPhone = true;
    contactInfo.phones = [...new Set(relaxedPhones)];
  }

  let extracted = null;

  // If regex found something, also try OpenAI extraction
  if (contactInfo.hasEmail || contactInfo.hasPhone) {
    log(WORKER_NAME, `Contact info found in missed lead ${conversation_id}: email=${contactInfo.hasEmail}, phone=${contactInfo.hasPhone}`);
    
    // Run full extraction with OpenAI
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

    extracted = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Use regex results if OpenAI missed them
    if (!extracted.email && contactInfo.hasEmail) {
      extracted.email = contactInfo.emails[0];
    }
    if (!extracted.phone && contactInfo.hasPhone) {
      extracted.phone = contactInfo.phones[0];
    }
    
    if (extracted.email || extracted.phone) {
      // Score the lead
      const { score, rating } = scoreLead({
        messages: messages.rows,
        extracted,
      });
      
      // Store as a new lead
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
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          issue = EXCLUDED.issue,
          location = EXCLUDED.location,
          lead_score = EXCLUDED.lead_score,
          lead_rating = EXCLUDED.lead_rating,
          extracted_at = NOW()`,
        [
          conversation_id,
          site_id,
          extracted.name || null,
          extracted.email || null,
          extracted.phone || null,
          extracted.service_requested || null,
          extracted.address || null,
          score,
          rating,
        ]
      );
      
      log(WORKER_NAME, `✓ Recovered lead from missed_lead: ${conversation_id} (${rating})`);
      return true;
    }
  }
  
  return false;
}

/**
 * Step 2: Re-scan conversations with no lead
 */
async function rescanUnleadedConversations(stats) {
  log(WORKER_NAME, '[Step 2] Re-scanning conversations without leads...');
  
  try {
    const conversations = await pool.query(`
      SELECT c.id, c.site_id, c.message_count
      FROM conversations c
      WHERE c.message_count >= 4
      AND NOT EXISTS (
        SELECT 1 FROM leads l 
        WHERE l.conversation_id = c.id
      )
      ORDER BY c.updated_at DESC
      LIMIT 100
    `);

    if (conversations.rows.length === 0) {
      log(WORKER_NAME, 'No unleaded conversations to re-scan');
      return;
    }

    log(WORKER_NAME, `Re-scanning ${conversations.rows.length} conversations without leads`);

    for (const convo of conversations.rows) {
      try {
        const created = await tryExtractLead(convo);
        if (created) {
          stats.newLeadsFound++;
        }
      } catch (err) {
        logError(WORKER_NAME, `Failed to extract from conversation ${convo.id}`, err);
        stats.errors++;
      }
    }
    
    log(WORKER_NAME, `[Step 2] Found ${stats.newLeadsFound} new leads`);
  } catch (err) {
    logError(WORKER_NAME, 'Step 2 failed', err);
    throw err;
  }
}

/**
 * Try to extract a lead from a conversation
 */
async function tryExtractLead(convo) {
  const { id: conversationId, site_id } = convo;
  
  const messages = await pool.query(
    `SELECT role, content FROM messages 
     WHERE conversation_id = $1 
     ORDER BY created_at ASC`,
    [conversationId]
  );

  if (messages.rows.length === 0) return false;

  const transcript = messages.rows
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Try regex first
  const userText = messages.rows
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  const contactInfo = detectContactInfo(userText);
  
  // Relaxed phone pattern
  const relaxedPhones = userText.match(RELAXED_PHONE_REGEX) || [];
  if (relaxedPhones.length > 0 && !contactInfo.hasPhone) {
    contactInfo.hasPhone = true;
    contactInfo.phones = [...new Set(relaxedPhones)];
  }

  // Try OpenAI extraction
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

  let extracted = JSON.parse(completion.choices[0].message.content || '{}');
  
  // Merge regex results
  if (!extracted.email && contactInfo.hasEmail) {
    extracted.email = contactInfo.emails[0];
  }
  if (!extracted.phone && contactInfo.hasPhone) {
    extracted.phone = contactInfo.phones[0];
  }

  if (!extracted.email && !extracted.phone && !extracted.name) {
    return false;
  }

  // Score and store
  const { score, rating } = scoreLead({
    messages: messages.rows,
    extracted,
  });
  
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
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      issue = EXCLUDED.issue,
      location = EXCLUDED.location,
      lead_score = EXCLUDED.lead_score,
      lead_rating = EXCLUDED.lead_rating,
      extracted_at = NOW()`,
    [
      conversationId,
      site_id,
      extracted.name || null,
      extracted.email || null,
      extracted.phone || null,
      extracted.service_requested || null,
      extracted.address || null,
      score,
      rating,
    ]
  );
  
  log(WORKER_NAME, `✓ Extracted new lead: ${conversationId} (${rating})`);
  return true;
}

/**
 * Step 3: Re-extract partial leads (missing email or phone)
 */
async function rescanPartialLeads(stats) {
  log(WORKER_NAME, '[Step 3] Re-scanning partial leads...');
  
  try {
    const partialLeads = await pool.query(`
      SELECT l.conversation_id, l.site_id, l.name, l.email, l.phone, c.message_count
      FROM leads l
      JOIN conversations c ON l.conversation_id = c.id
      WHERE (l.email IS NULL OR l.phone IS NULL OR l.name IS NULL)
      AND c.message_count >= 4
      ORDER BY l.created_at DESC
      LIMIT 50
    `);

    if (partialLeads.rows.length === 0) {
      log(WORKER_NAME, 'No partial leads to re-scan');
      return;
    }

    log(WORKER_NAME, `Re-scanning ${partialLeads.rows.length} partial leads`);

    for (const lead of partialLeads.rows) {
      try {
        const updated = await tryUpdatePartialLead(lead);
        if (updated) {
          stats.partialLeadsUpdated++;
        }
      } catch (err) {
        logError(WORKER_NAME, `Failed to update partial lead ${lead.conversation_id}`, err);
        stats.errors++;
      }
    }
    
    log(WORKER_NAME, `[Step 3] Updated ${stats.partialLeadsUpdated} partial leads`);
  } catch (err) {
    logError(WORKER_NAME, 'Step 3 failed', err);
    throw err;
  }
}

/**
 * Try to fill in missing fields for a partial lead
 */
async function tryUpdatePartialLead(lead) {
  const { conversation_id } = lead;
  
  const messages = await pool.query(
    `SELECT role, content FROM messages 
     WHERE conversation_id = $1 
     ORDER BY created_at ASC`,
    [conversation_id]
  );

  if (messages.rows.length === 0) return false;

  const transcript = messages.rows
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  const userText = messages.rows
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  // Regex + relaxed phone
  const contactInfo = detectContactInfo(userText);
  const relaxedPhones = userText.match(RELAXED_PHONE_REGEX) || [];
  if (relaxedPhones.length > 0 && !contactInfo.hasPhone) {
    contactInfo.hasPhone = true;
    contactInfo.phones = [...new Set(relaxedPhones)];
  }

  // OpenAI extraction
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

  let extracted = JSON.parse(completion.choices[0].message.content || '{}');
  
  // Merge regex
  if (!extracted.email && contactInfo.hasEmail) {
    extracted.email = contactInfo.emails[0];
  }
  if (!extracted.phone && contactInfo.hasPhone) {
    extracted.phone = contactInfo.phones[0];
  }

  // Only update if we found new fields
  const needsUpdate = 
    (!lead.email && extracted.email) ||
    (!lead.phone && extracted.phone) ||
    (!lead.name && extracted.name);
  
  if (!needsUpdate) return false;

  // Update with new fields (keep existing if not found)
  await pool.query(
    `UPDATE leads SET
      name = COALESCE($1, name),
      email = COALESCE($2, email),
      phone = COALESCE($3, phone),
      issue = COALESCE($4, issue),
      location = COALESCE($5, location),
      extracted_at = NOW()
     WHERE conversation_id = $6`,
    [
      extracted.name || null,
      extracted.email || null,
      extracted.phone || null,
      extracted.service_requested || null,
      extracted.address || null,
      conversation_id,
    ]
  );
  
  log(WORKER_NAME, `✓ Updated partial lead: ${conversation_id}`);
  return true;
}

async function run() {
  log(WORKER_NAME, 'Starting data reconciliation worker...');
  
  const stats = await reconcileData();
  
  await pool.end();
  log(WORKER_NAME, 'Done');
  process.exit(0);
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
