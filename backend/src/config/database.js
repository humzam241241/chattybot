const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const { Pool } = require("pg");

function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);

    // Supabase pooler expects port 6543 (not 5432). Keep env var unchanged by rewriting here.
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      if (!url.port || url.port === "5432") url.port = "6543";

      // Some Supabase-provided pooler strings include pgbouncer=true; pg treats unknown params
      // as startup parameters which can break Supavisor. Strip it defensively.
      url.searchParams.delete("pgbouncer");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Pooler connections can be slightly slower to establish on cold start.
  connectionTimeoutMillis: 10000
});

pool.connect()
  .then(client => {
    console.log("[DB] Database connection verified");
    client.release();
  })
  .catch(err => {
    console.error("[DB] STARTUP CONNECTION FAILED:", err.message);
  });

module.exports = pool;
