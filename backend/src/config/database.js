const { Pool } = require('pg');

/**
 * Supabase appends ?pgbouncer=true to their pooler connection strings as a
 * hint for ORMs (Prisma etc.) to disable prepared statements.
 * The raw `pg` library passes unknown query params as PostgreSQL startup
 * parameters — Supavisor sees an unrecognised param and throws
 * "Tenant or user not found". Strip it before creating the pool.
 */
function sanitizeConnectionString(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('pgbouncer');
    parsed.searchParams.delete('pgbouncer');   // belt-and-suspenders
    return parsed.toString();
  } catch {
    // URL parsing failed — return as-is and let pg surface the real error
    return url;
  }
}

const connectionString = sanitizeConnectionString(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  simple_query_mode: true,
});

pool.on('connect', () => {
  console.log('[DB] Client connected to Supabase');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

// Eagerly test the connection at startup so misconfiguration is caught immediately
pool.query('SELECT 1').then(() => {
  console.log('[DB] Database connection verified');
}).catch((err) => {
  console.error('[DB] STARTUP CONNECTION FAILED:', err.message);
  console.error('[DB] Check DATABASE_URL in your environment variables');
});

module.exports = pool;
