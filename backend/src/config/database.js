const { Pool } = require('pg');

// IPv4 is forced globally via dns.setDefaultResultOrder('ipv4first') in app.js
// which must be loaded before this module is required.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
