/**
 * Conversation Recovery Tool
 * 
 * Rebuilds message_count for all conversations by counting actual messages.
 * Useful for fixing data inconsistencies.
 * 
 * Run with: node scripts/rebuildConversationCounts.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function rebuildCounts() {
  console.log('[Recovery] Starting conversation count rebuild...');

  try {
    // Get actual message counts per conversation
    const counts = await pool.query(`
      SELECT 
        conversation_id, 
        COUNT(*) as actual_count
      FROM messages
      GROUP BY conversation_id
    `);

    console.log(`[Recovery] Found ${counts.rows.length} conversations with messages`);

    let updated = 0;
    let fixed = 0;

    // Update each conversation
    for (const row of counts.rows) {
      const { conversation_id, actual_count } = row;

      // Get current stored count
      const current = await pool.query(
        'SELECT message_count FROM conversations WHERE id = $1',
        [conversation_id]
      );

      if (current.rows.length === 0) {
        console.log(`[Recovery] Orphan conversation ${conversation_id} - skipping`);
        continue;
      }

      const storedCount = current.rows[0].message_count;

      if (storedCount !== parseInt(actual_count)) {
        console.log(`[Recovery] Fixing ${conversation_id}: ${storedCount} → ${actual_count}`);
        
        await pool.query(
          'UPDATE conversations SET message_count = $1, updated_at = NOW() WHERE id = $2',
          [actual_count, conversation_id]
        );

        fixed++;
      }

      updated++;
    }

    console.log(`[Recovery] ✓ Complete: ${updated} conversations processed, ${fixed} fixed`);

  } catch (err) {
    console.error('[Recovery] Error:', err);
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

rebuildCounts();
