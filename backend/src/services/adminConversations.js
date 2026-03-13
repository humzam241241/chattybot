const pool = require('../config/database');

function clampInt(val, { min, max, fallback }) {
  const n = Number.parseInt(String(val), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function listConversationsForAdmin({ user, siteId = null, q = null, limit = 50, offset = 0 }) {
  const safeLimit = clampInt(limit, { min: 1, max: 200, fallback: 50 });
  const safeOffset = clampInt(offset, { min: 0, max: 50000, fallback: 0 });

  const isAdmin = Boolean(user?.is_admin);
  const ownerId = user?.id || null;

  const search = q ? String(q).trim() : null;
  const siteFilter = siteId ? String(siteId).trim() : null;

  const whereSql = `
    WHERE ($1::boolean = true OR s.owner_id = $2)
      AND ($3::uuid IS NULL OR c.site_id = $3::uuid)
      AND (
        $4::text IS NULL
        OR c.visitor_id ILIKE '%' || $4::text || '%'
        OR COALESCE(c.summary, '') ILIKE '%' || $4::text || '%'
      )
  `;

  const params = [isAdmin, ownerId, siteFilter, search, safeLimit, safeOffset];

  const countRes = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM conversations c
    JOIN sites s ON s.id = c.site_id
    ${whereSql}
    `,
    params.slice(0, 4)
  );

  const rowsRes = await pool.query(
    `
    SELECT
      c.id,
      c.site_id,
      s.company_name AS site_name,
      c.visitor_id,
      c.message_count,
      c.summary,
      c.created_at,
      c.updated_at
    FROM conversations c
    JOIN sites s ON s.id = c.site_id
    ${whereSql}
    ORDER BY c.updated_at DESC
    LIMIT $5 OFFSET $6
    `,
    params
  );

  return {
    conversations: rowsRes.rows,
    pagination: { total: countRes.rows?.[0]?.total || 0, limit: safeLimit, offset: safeOffset },
  };
}

module.exports = { listConversationsForAdmin };

