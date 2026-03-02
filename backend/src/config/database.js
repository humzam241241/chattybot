const { Pool } = require('pg');

// Render's free tier only supports IPv4 outbound connections.
// Supabase's direct connection resolves to IPv6 which causes ENETUNREACH.
// We force IPv4 by appending the family=4 query param to the connection string.
function buildConnectionString(url) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  // Only add if not already present
  if (url.includes('family=4')) return url;
  return `${url}${sep}family=4`;
}

const pool = new Pool({
  connectionString: buildConnectionString(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
