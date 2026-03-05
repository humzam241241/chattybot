/**
 * Database Indexes Migration
 * 
 * Creates performance indexes for conversation analytics queries.
 * Run this script ONCE after deploying the analytics system.
 * 
 * Usage: node scripts/createIndexes.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createIndexes() {
  console.log('[Migration] Creating database indexes for analytics...');

  const indexes = [
    {
      name: 'idx_messages_conversation_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);',
      description: 'Speed up message lookups by conversation',
    },
    {
      name: 'idx_conversations_site_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_conversations_site_id ON conversations(site_id);',
      description: 'Speed up conversation filtering by site',
    },
    {
      name: 'idx_conversations_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);',
      description: 'Speed up time-based queries',
    },
    {
      name: 'idx_leads_site_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_leads_site_id ON leads(site_id);',
      description: 'Speed up lead filtering by site',
    },
    {
      name: 'idx_leads_conversation_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_leads_conversation_id ON leads(conversation_id);',
      description: 'Speed up lead-conversation joins',
    },
    {
      name: 'idx_leads_extracted_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_leads_extracted_at ON leads(extracted_at);',
      description: 'Filter extracted vs manual leads',
    },
    {
      name: 'idx_summary_jobs_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_summary_jobs_status ON conversation_summary_jobs(status);',
      description: 'Speed up worker job polling',
    },
  ];

  for (const index of indexes) {
    try {
      console.log(`[Migration] Creating ${index.name}...`);
      await pool.query(index.sql);
      console.log(`[Migration] ✓ ${index.description}`);
    } catch (err) {
      console.error(`[Migration] ✗ Failed to create ${index.name}:`, err.message);
    }
  }

  console.log('[Migration] ✓ Index creation complete');
  await pool.end();
  process.exit(0);
}

createIndexes();
