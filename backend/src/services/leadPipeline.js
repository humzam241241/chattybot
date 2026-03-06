/**
 * Lead Pipeline Service
 * 
 * Orchestrates the complete lead capture flow:
 * 1. Detect contact info in messages
 * 2. Extract structured lead data via OpenAI
 * 3. Score the lead
 * 4. Store in database (with deduplication)
 * 5. Send email notification
 * 6. Trigger webhook
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { scanConversationForContact, detectLeadIntent, detectServiceIntent } = require('./leadDetector');
const { extractLeadFromConversation } = require('./leadExtractor');
const { scoreLead } = require('./leadScore');
const { sendLeadNotificationEmail } = require('./leadNotifier');
const { sendLeadWebhookWithRetry } = require('./leadWebhook');

/**
 * Process a conversation for lead capture
 * Called after each message is saved
 * 
 * @param {Object} params
 * @param {string} params.conversationId - Conversation UUID
 * @param {string} params.siteId - Site UUID
 * @param {string} params.userMessage - Latest user message
 * @param {string} [params.intent] - Detected intent from chat
 * @returns {Promise<{processed: boolean, lead?: Object, reason?: string}>}
 */
async function processConversationForLead({ conversationId, siteId, userMessage, intent }) {
  console.log(`[LeadPipeline] Processing conversation ${conversationId}...`);

  try {
    // ─── Step 1: Quick detection check ────────────────────────────────
    const { hasContact } = scanConversationForContact([{ role: 'user', content: userMessage }]);
    const hasLeadIntent = detectLeadIntent(userMessage);
    const hasServiceIntent = detectServiceIntent(userMessage);

    // Only proceed if we detect contact info or strong intent
    if (!hasContact && !hasLeadIntent && !hasServiceIntent && intent === 'kb') {
      console.log('[LeadPipeline] No lead signals detected, skipping');
      return { processed: false, reason: 'No lead signals' };
    }

    console.log(`[LeadPipeline] Lead signals detected - Contact: ${hasContact}, Intent: ${hasLeadIntent}, Service: ${hasServiceIntent}`);

    // ─── Step 2: Fetch full conversation ──────────────────────────────
    const convoRes = await pool.query(
      `SELECT c.*, s.company_name, s.lead_webhook_url
       FROM conversations c
       JOIN sites s ON c.site_id = s.id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (convoRes.rows.length === 0) {
      console.warn('[LeadPipeline] Conversation not found');
      return { processed: false, reason: 'Conversation not found' };
    }

    const conversation = convoRes.rows[0];

    // Fetch messages
    const messagesRes = await pool.query(
      `SELECT role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
    conversation.messages = messagesRes.rows;

    // ─── Step 3: Extract lead info via OpenAI ─────────────────────────
    const extracted = await extractLeadFromConversation(conversation.messages);

    if (!extracted || (!extracted.email && !extracted.phone)) {
      // Update conversation with intent-based scoring even without contact
      if (intent && intent !== 'kb') {
        const { score, rating } = scoreLead({ intent, messages: conversation.messages });
        await pool.query(
          `UPDATE conversations SET lead_score = $1, lead_rating = $2, updated_at = NOW() WHERE id = $3`,
          [score, rating, conversationId]
        ).catch(() => {});
      }
      console.log('[LeadPipeline] No contact info extracted');
      return { processed: false, reason: 'No contact info extracted' };
    }

    // ─── Step 4: Score the lead ───────────────────────────────────────
    const { score, rating, factors } = scoreLead({
      intent,
      messages: conversation.messages,
      extracted,
    });

    console.log(`[LeadScorer] Score: ${score}, Rating: ${rating}`);

    // ─── Step 5: Check for duplicates ─────────────────────────────────
    const isDuplicate = await checkDuplicateLead({
      siteId,
      email: extracted.email,
      phone: extracted.phone,
    });

    if (isDuplicate) {
      console.log('[LeadPipeline] Duplicate lead detected - sending notification for existing contact');
      
      // Update conversation scoring
      await pool.query(
        `UPDATE conversations SET lead_score = $1, lead_rating = $2, updated_at = NOW() WHERE id = $3`,
        [score, rating, conversationId]
      ).catch(() => {});

      // Update existing lead with new conversation_id so it links to latest chat
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await pool
        .query(
          `SELECT id
           FROM leads
           WHERE site_id = $1
             AND created_at > $4
             AND (
               ($2 IS NOT NULL AND email = $2)
               OR
               ($3 IS NOT NULL AND phone = $3)
             )
           ORDER BY created_at DESC
           LIMIT 1`,
          [siteId, extracted.email || null, extracted.phone || null, cutoff]
        )
        .then(async (dupRes) => {
          const existingLeadId = dupRes.rows?.[0]?.id;
          if (!existingLeadId) return;

          const dupExtractionJson = {
            ...extracted,
            factors,
            intent,
            is_duplicate: true,
            latest_conversation_id: conversationId,
          };

          await pool.query(
            `UPDATE leads
             SET conversation_id = $2,
                 name = COALESCE($3, name),
                 email = COALESCE($4, email),
                 phone = COALESCE($5, phone),
                 issue = COALESCE($6, issue),
                 location = COALESCE($7, location),
                 lead_score = $8,
                 lead_rating = $9,
                 extracted_at = NOW(),
                 extraction_json = COALESCE(extraction_json, '{}'::jsonb) || $10::jsonb
             WHERE id = $1`,
            [
              existingLeadId,
              conversationId,
              extracted.name || null,
              extracted.email || null,
              extracted.phone || null,
              extracted.issue || extracted.service_requested || null,
              extracted.location || extracted.address || null,
              score,
              rating,
              JSON.stringify(dupExtractionJson),
            ]
          );
        })
        .catch(() => {});

      // Still send notification email for returning contact
      const adminUrl = process.env.ADMIN_DASHBOARD_URL
        ? `${process.env.ADMIN_DASHBOARD_URL}/sites/${siteId}/conversations/${conversationId}`
        : null;

      sendLeadNotificationEmail({
        lead: {
          name: extracted.name,
          email: extracted.email,
          phone: extracted.phone,
          issue: extracted.issue,
          location: extracted.location,
          lead_score: score,
          lead_rating: rating,
        },
        conversation,
        siteName: conversation.company_name,
        adminUrl,
        isDuplicate: true,
      }).catch(err => {
        console.warn('[LeadPipeline] Duplicate notification email failed (non-fatal):', err.message);
      });

      return { processed: true, reason: 'Duplicate lead - notification sent' };
    }

    // ─── Step 6: Store lead in database ───────────────────────────────
    const leadId = uuidv4();
    const now = new Date();

    const lead = {
      id: leadId,
      site_id: siteId,
      conversation_id: conversationId,
      name: extracted.name,
      email: extracted.email,
      phone: extracted.phone,
      issue: extracted.issue,
      location: extracted.location,
      lead_score: score,
      lead_rating: rating,
      extraction_json: {
        ...extracted,
        factors,
        intent,
      },
      extracted_at: now,
      created_at: now,
    };

    await pool.query(
      `INSERT INTO leads (id, site_id, conversation_id, name, email, phone, issue, location, lead_score, lead_rating, extraction_json, extracted_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        lead.id,
        lead.site_id,
        lead.conversation_id,
        lead.name,
        lead.email,
        lead.phone,
        lead.issue,
        lead.location,
        lead.lead_score,
        lead.lead_rating,
        JSON.stringify(lead.extraction_json),
        lead.extracted_at,
        lead.created_at,
      ]
    );

    console.log(`[LeadStorage] Lead stored - ID: ${leadId}`);

    // Update conversation with lead score
    await pool.query(
      `UPDATE conversations SET lead_score = $1, lead_rating = $2, updated_at = NOW() WHERE id = $3`,
      [score, rating, conversationId]
    ).catch(() => {});

    // ─── Step 7: Send notification (HOT or WARM only) ─────────────────
    if (rating === 'HOT' || rating === 'WARM') {
      const adminUrl = process.env.ADMIN_DASHBOARD_URL
        ? `${process.env.ADMIN_DASHBOARD_URL}/sites/${siteId}/conversations/${conversationId}`
        : null;

      sendLeadNotificationEmail({
        lead,
        conversation,
        siteName: conversation.company_name,
        adminUrl,
      }).catch(err => {
        console.warn('[LeadPipeline] Email notification failed (non-fatal):', err.message);
      });
    }

    // ─── Step 8: Trigger webhook if configured ────────────────────────
    if (conversation.lead_webhook_url) {
      sendLeadWebhookWithRetry({
        webhookUrl: conversation.lead_webhook_url,
        lead,
        siteId,
        siteName: conversation.company_name,
      }).catch(err => {
        console.warn('[LeadPipeline] Webhook failed (non-fatal):', err.message);
      });
    }

    console.log(`[LeadPipeline] Complete - Lead ${leadId} (${rating})`);

    return { processed: true, lead };
  } catch (err) {
    console.error('[LeadPipeline] Error:', err.message);
    return { processed: false, reason: err.message };
  }
}

/**
 * Check if a lead with same email/phone exists for site in last 24 hours
 * @param {Object} params
 * @param {string} params.siteId
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @returns {Promise<boolean>}
 */
async function checkDuplicateLead({ siteId, email, phone }) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (email) {
    const emailCheck = await pool.query(
      `SELECT id FROM leads WHERE site_id = $1 AND email = $2 AND created_at > $3 LIMIT 1`,
      [siteId, email, cutoff]
    );
    if (emailCheck.rows.length > 0) {
      console.log(`[LeadPipeline] Duplicate email found: ${email}`);
      return true;
    }
  }

  if (phone) {
    const phoneCheck = await pool.query(
      `SELECT id FROM leads WHERE site_id = $1 AND phone = $2 AND created_at > $3 LIMIT 1`,
      [siteId, phone, cutoff]
    );
    if (phoneCheck.rows.length > 0) {
      console.log(`[LeadPipeline] Duplicate phone found: ${phone}`);
      return true;
    }
  }

  return false;
}

module.exports = {
  processConversationForLead,
  checkDuplicateLead,
};
