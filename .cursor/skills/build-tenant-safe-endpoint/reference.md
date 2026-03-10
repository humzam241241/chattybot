## Migration template (new tenant-scoped table)

Use in `backend/migrations/0xx_your_change.sql`:

```sql
-- Ensure gen_random_uuid() is available (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS your_table (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- tenant-safe foreign keys: include site_id on child rows too
  related_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS your_table_site_id_idx ON your_table(site_id);

-- Example tenant-safe FK pattern for child tables:
-- - child has (site_id, parent_id)
-- - parent has (id, site_id) or you enforce via join + WHERE site_id in code
```

## Service template (parameterized queries + tenant filter)

Create in `backend/src/services/<domain>.js`:

```js
async function listThingsForSite(pool, siteId, { limit = 200 } = {}) {
  const lim = Math.max(1, Math.min(500, Number(limit) || 200));

  const r = await pool.query(
    `SELECT id, site_id, created_at
     FROM your_table
     WHERE site_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [siteId, lim]
  );

  return r.rows;
}

module.exports = { listThingsForSite };
```

## Route handler template (thin route)

Add in `backend/src/routes/<route>.js`:

```js
const express = require('express');
const { param, query, body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { userAuth, requirePaidOrTrial } = require('../middleware/userAuth');
const { checkSiteAccess } = require('../services/siteAccess');
const { listThingsForSite } = require('../services/yourService');

const router = express.Router();

router.get(
  '/:site_id/things',
  userAuth,
  requirePaidOrTrial,
  [
    param('site_id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const siteId = req.params.site_id;

    const access = await checkSiteAccess(pool, req.user, siteId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    try {
      const things = await listThingsForSite(pool, siteId, { limit: req.query.limit });
      return res.json({ things });
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'things.list_failed',
        ts: new Date().toISOString(),
        site_id: siteId,
        user_id: req.user?.id || null,
        route: req.path,
        method: req.method,
        error: err?.message || String(err),
      }));
      return res.status(500).json({ error: 'Failed to list things' });
    }
  }
);

module.exports = router;
```

## Structured log payload (suggested fields)

```js
const payload = {
  level: 'info', // info|warn|error
  event: 'domain.action',
  ts: new Date().toISOString(),
  site_id: siteId,
  user_id: req.user?.id || null,
  route: req.path,
  method: req.method,
  status: 200,
  // never: raw tokens, passwords, webhook secrets
  // avoid: raw emails/phones/message bodies (use redaction)
};
console.log(JSON.stringify(payload));
```

