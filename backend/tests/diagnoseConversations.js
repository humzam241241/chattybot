/**
 * Diagnostic script to identify conversation display issue
 * Run this with: node backend/tests/diagnoseConversations.js
 */

const pool = require('../src/config/database');

async function diagnose() {
  console.log('🔍 Starting conversation diagnosis...\n');

  try {
    // 1. Check conversations table
    console.log('1️⃣ Checking conversations table:');
    const conversationsCount = await pool.query('SELECT COUNT(*) as count FROM conversations');
    console.log(`   Total conversations: ${conversationsCount.rows[0].count}`);

    const conversationsSample = await pool.query('SELECT id, site_id, visitor_id, message_count, created_at FROM conversations ORDER BY created_at DESC LIMIT 5');
    console.log(`   Sample (latest 5):`);
    conversationsSample.rows.forEach(c => {
      console.log(`     - ${c.id.slice(0, 8)}... | site: ${c.site_id.slice(0, 8)}... | messages: ${c.message_count}`);
    });

    // 2. Check if conversation_overview exists
    console.log('\n2️⃣ Checking for conversation_overview:');
    try {
      const overviewCount = await pool.query('SELECT COUNT(*) as count FROM conversation_overview');
      console.log(`   conversation_overview exists with ${overviewCount.rows[0].count} records`);
      
      const overviewSample = await pool.query('SELECT id, site_id, visitor_id, message_count FROM conversation_overview ORDER BY created_at DESC LIMIT 5');
      console.log(`   Sample (latest 5):`);
      overviewSample.rows.forEach(c => {
        console.log(`     - ${c.id.slice(0, 8)}... | site: ${c.site_id ? c.site_id.slice(0, 8) + '...' : 'NULL'} | messages: ${c.message_count}`);
      });
    } catch (err) {
      console.log(`   conversation_overview does NOT exist (${err.message})`);
    }

    // 3. Check messages table
    console.log('\n3️⃣ Checking messages table:');
    const messagesCount = await pool.query('SELECT COUNT(*) as count FROM messages');
    console.log(`   Total messages: ${messagesCount.rows[0].count}`);

    // 4. Check for orphaned conversations
    console.log('\n4️⃣ Checking for orphaned conversations (no messages):');
    const orphaned = await pool.query(`
      SELECT c.id, c.visitor_id, c.message_count, c.created_at
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE m.id IS NULL
      LIMIT 10
    `);
    console.log(`   Orphaned conversations: ${orphaned.rows.length}`);
    if (orphaned.rows.length > 0) {
      orphaned.rows.forEach(c => {
        console.log(`     - ${c.id.slice(0, 8)}... | visitor: ${c.visitor_id || 'NULL'} | count: ${c.message_count}`);
      });
    }

    // 5. Check for site filtering issues
    console.log('\n5️⃣ Checking conversations by site:');
    const bySite = await pool.query(`
      SELECT site_id, COUNT(*) as count
      FROM conversations
      GROUP BY site_id
      ORDER BY count DESC
    `);
    bySite.rows.forEach(row => {
      console.log(`   Site ${row.site_id ? row.site_id.slice(0, 8) + '...' : 'NULL'}: ${row.count} conversations`);
    });

    // 6. Check table structure
    console.log('\n6️⃣ Checking conversations table structure:');
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      ORDER BY ordinal_position
    `);
    console.log('   Columns:');
    structure.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log('\n✅ Diagnosis complete!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error during diagnosis:', err);
    process.exit(1);
  }
}

diagnose();
