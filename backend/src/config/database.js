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

function getSafeHostLabel(raw) {
  try {
    const url = new URL(raw);
    const port = url.port ? `:${url.port}` : "";
    return `${url.hostname}${port}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

function buildCandidateConnectionStrings(raw) {
  const normalized = normalizeDatabaseUrl(raw);
  const out = [];

  // Always try the env-provided URL first (as-is).
  if (raw) out.push(raw);

  // Then try normalized (may strip pgbouncer / adjust pooler port).
  if (normalized && normalized !== raw) out.push(normalized);

  // If this is a Supabase pooler host, try both common ports.
  try {
    const url = new URL(normalized || raw);
    if (url && url.hostname.endsWith(".pooler.supabase.com")) {
      const base = new URL(url.toString());
      base.searchParams.delete("pgbouncer");

      const portA = new URL(base.toString());
      portA.port = "6543";
      const portB = new URL(base.toString());
      portB.port = "5432";

      // Prefer 6543, but keep both.
      out.push(portA.toString());
      out.push(portB.toString());
    }
  } catch {
    // ignore
  }

  // Deduplicate while preserving order.
  return [...new Set(out.filter(Boolean))];
}

const poolOptions = {
  ssl: { rejectUnauthorized: false },
  // Pooler connections can be slightly slower to establish on cold start.
  connectionTimeoutMillis: 10000,
};

let activePool = new Pool({
  connectionString,
  ...poolOptions,
});

async function verifyAndMaybeSwitchPool() {
  const candidates = buildCandidateConnectionStrings(process.env.DATABASE_URL);

  for (const candidate of candidates) {
    const label = getSafeHostLabel(candidate);
    console.log(`[DB] Attempting connection to: ${label}`);

    const testPool = new Pool({
      connectionString: candidate,
      ...poolOptions,
    });

    try {
      const client = await testPool.connect();
      client.release();

      console.log(`[DB] Database connection verified (${label})`);

      // Swap active pool to the working candidate.
      try {
        await activePool.end();
      } catch {
        // ignore
      }
      activePool = testPool;
      return;
    } catch (err) {
      console.error(`[DB] Connection failed (${label}):`, err.message);
      try {
        await testPool.end();
      } catch {
        // ignore
      }
    }
  }

  console.error("[DB] STARTUP CONNECTION FAILED: All candidates failed (check Render network + Supabase pooler)");
}

// Kick off startup verification (non-blocking)
verifyAndMaybeSwitchPool().catch((err) => {
  console.error("[DB] STARTUP CONNECTION FAILED:", err.message);
});

// Export a thin wrapper so we can switch pools if needed.
module.exports = {
  query: (...args) => activePool.query(...args),
  connect: (...args) => activePool.connect(...args),
  on: (...args) => activePool.on(...args),
  end: (...args) => activePool.end(...args),
};
