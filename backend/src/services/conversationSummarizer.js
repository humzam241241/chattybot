/**
 * Conversation Summarizer Service
 * 
 * Generates AI summaries for conversations after they become idle.
 * Summaries include main problem, urgency, and contact info status.
 */

const OpenAI = require('openai');
const pool = require('../config/database');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_PROMPT = `Summarize this customer conversation in 2 sentences.

Include:
• main problem or topic discussed
• urgency level (if apparent)
• whether contact info (email/phone) was provided

Be concise and factual. Focus on actionable insights.

Example:
"Customer reported roof leak after storm and asked about repair options. They requested someone to inspect the roof but did not provide contact info."`;

/**
 * Check if a conversation needs summary (idle for 5+ minutes, no recent summary)
 * @param {string} conversationId 
 * @returns {Promise<boolean>}
 */
async function needsSummary(conversationId) {
  const result = await pool.query(`
    SELECT 
      c.updated_at,
      c.last_summary_at,
      c.message_count
    FROM conversations c
    WHERE c.id = $1
  `, [conversationId]);

  if (result.rows.length === 0) {
    return false;
  }

  const convo = result.rows[0];
  
  // Need at least 2 messages
  if (convo.message_count < 2) {
    return false;
  }

  // Check if idle for 5+ minutes
  const idleMinutes = (Date.now() - new Date(convo.updated_at).getTime()) / 60000;
  if (idleMinutes < 5) {
    return false;
  }

  // Check if already summarized recently
  if (convo.last_summary_at) {
    const lastSummary = new Date(convo.last_summary_at);
    const lastUpdate = new Date(convo.updated_at);
    
    // If summary is newer than last update, don't re-summarize
    if (lastSummary >= lastUpdate) {
      return false;
    }
  }

  return true;
}

/**
 * Generate a summary for a conversation
 * @param {string} conversationId 
 * @returns {Promise<string|null>}
 */
async function generateSummary(conversationId) {
  console.log(`[ConversationSummarizer] Generating summary for ${conversationId}...`);

  try {
    // Fetch messages
    const messages = await pool.query(`
      SELECT role, content
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [conversationId]);

    if (messages.rows.length === 0) {
      console.log(`[ConversationSummarizer] No messages found`);
      return null;
    }

    // Build transcript
    const transcript = messages.rows
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    // Generate summary
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: `Conversation:\n\n${transcript}` },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    const summary = completion.choices[0].message.content?.trim();
    
    if (!summary) {
      console.log(`[ConversationSummarizer] No summary generated`);
      return null;
    }

    console.log(`[ConversationSummarizer] Summary: ${summary}`);

    // Store summary
    await pool.query(`
      UPDATE conversations
      SET summary = $1, last_summary_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [summary, conversationId]);

    console.log(`[ConversationSummarizer] Summary saved for ${conversationId}`);
    return summary;

  } catch (err) {
    console.error(`[ConversationSummarizer] Error:`, err);
    return null;
  }
}

/**
 * Find and summarize idle conversations
 * @param {number} idleMinutes - How long conversation must be idle (default 5)
 * @param {number} limit - Max conversations to process (default 10)
 * @returns {Promise<number>} Number of conversations summarized
 */
async function summarizeIdleConversations(idleMinutes = 5, limit = 10) {
  console.log(`[ConversationSummarizer] Finding conversations idle for ${idleMinutes}+ minutes...`);

  try {
    // Find idle conversations without recent summary
    const conversations = await pool.query(`
      SELECT c.id
      FROM conversations c
      WHERE c.message_count >= 2
      AND c.updated_at <= NOW() - INTERVAL '${idleMinutes} minutes'
      AND (
        c.last_summary_at IS NULL
        OR c.last_summary_at < c.updated_at
      )
      ORDER BY c.updated_at DESC
      LIMIT $1
    `, [limit]);

    if (conversations.rows.length === 0) {
      console.log('[ConversationSummarizer] No conversations need summarizing');
      return 0;
    }

    console.log(`[ConversationSummarizer] Processing ${conversations.rows.length} conversations`);

    let count = 0;
    for (const row of conversations.rows) {
      const summary = await generateSummary(row.id);
      if (summary) {
        count++;
      }
    }

    console.log(`[ConversationSummarizer] Summarized ${count} conversations`);
    return count;

  } catch (err) {
    console.error('[ConversationSummarizer] Error:', err);
    return 0;
  }
}

module.exports = {
  needsSummary,
  generateSummary,
  summarizeIdleConversations,
  SUMMARY_PROMPT,
};
