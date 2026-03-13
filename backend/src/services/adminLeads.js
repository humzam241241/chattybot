const pool = require('../config/database');

function clampInt(val, { min, max, fallback }) {
  const n = Number.parseInt(String(val), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function listLeadsForAdmin({ user, siteId = null, q = null, rating = null, limit = 50, offset = 0 }) {
  const safeLimit = clampInt(limit, { min: 1, max: 200, fallback: 50 });
  const safeOffset = clampInt(offset, { min: 0, max: 50000, fallback: 0 });

  const isAdmin = Boolean(user?.is_admin);
  const ownerId = user?.id || null;

  const search = q ? String(q).trim() : null;
  const siteFilter = siteId ? String(siteId).trim() : null;
  const ratingFilter = rating ? String(rating).trim().toUpperCase() : null;
  const allowedRating = ['HOT', 'WARM', 'COLD'].includes(ratingFilter) ? ratingFilter : null;

  const whereSql = `
    WHERE ($1::boolean = true OR s.owner_id = $2)
      AND ($3::uuid IS NULL OR l.site_id = $3::uuid)
      AND ($4::text IS NULL OR l.lead_rating = $4::text)
      AND (
        $5::text IS NULL
        OR COALESCE(l.email, '') ILIKE '%' || $5::text || '%'
        OR COALESCE(l.phone, '') ILIKE '%' || $5::text || '%'
        OR COALESCE(l.name, '') ILIKE '%' || $5::text || '%'
        OR COALESCE(l.issue, '') ILIKE '%' || $5::text || '%'
      )
  `;

  const params = [isAdmin, ownerId, siteFilter, allowedRating, search, safeLimit, safeOffset];

  const countRes = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM leads l
    JOIN sites s ON s.id = l.site_id
    ${whereSql}
    `,
    params.slice(0, 5)
  );

  const rowsRes = await pool.query(
    `
    SELECT
      l.id,
      l.site_id,
      s.company_name AS site_name,
      l.name,
      l.email,
      l.phone,
      l.issue,
      l.lead_score,
      l.lead_rating,
      l.conversation_id,
      l.created_at
    FROM leads l
    JOIN sites s ON s.id = l.site_id
    ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT $6 OFFSET $7
    `,
    params
  );

  return {
    leads: rowsRes.rows,
    pagination: { total: countRes.rows?.[0]?.total || 0, limit: safeLimit, offset: safeOffset },
  };
}

module.exports = { listLeadsForAdmin };

