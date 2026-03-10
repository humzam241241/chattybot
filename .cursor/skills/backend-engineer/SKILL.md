---
name: backend-engineer
description: Specialist in Node.js SaaS backend development for this repository (Express + pg + Supabase auth). Implements backend routes and services, writes parameterized SQL queries, maintains thin-route service architecture, enforces tenant isolation via site_id, and applies backend authorization patterns (userAuth + checkSiteAccess + app_users.is_admin). Use when creating/modifying backend API endpoints, database queries, migrations, or multi-tenant authorization logic.
---

# Backend Engineer (Node.js SaaS)

## Scope

Use this skill when working in `backend/` to:
- implement or modify Express routes
- add/refactor service-layer logic in `backend/src/services/`
- write SQL queries against Postgres via `pg` (`backend/src/config/database.js`)
- add migrations in `backend/migrations/`
- enforce tenant isolation and authorization

## Non-negotiables (security + tenancy)

- **Tenant isolation**: any query involving leads, conversations, files, analytics, reports, or usage MUST filter by `site_id`.
- **Authorization**: for tenant-bound data, call `checkSiteAccess(pool, req.user, siteId)` and fail with its `status/error`. Never rely on frontend session data for permissions.
- **Admin rights**: come ONLY from `app_users.is_admin` (set on `req.user` by `userAuth`).
- **SQL safety**: never interpolate user input into SQL. Use `pool.query(sql, params)` with placeholders.
- **Avoid SQL string concatenation**: prefer single, fixed SQL statements with optional filters expressed via SQL (see patterns below).

## Repository architecture (follow it)

- **Routes stay thin**: routes should only validate input, call service functions, and return responses.
- **Business logic lives in services**: put logic in `backend/src/services/*`.
- **DB access**: use `pool` from `backend/src/config/database.js`.
- **Auth**: `userAuth` sets `req.user` (DB row from `app_users`) and `req.supabaseUser`.
- **Site authorization**: `checkSiteAccess(pool, user, siteId)` is the standard gate.

## Default implementation workflow

1. **Locate the right route file** in `backend/src/routes/` (or create one and mount it in `backend/src/app.js`).
2. **Add/adjust validation** using `express-validator` (match existing style).
3. **Authenticate**:
   - for admin API: ensure the endpoint is under `/api/admin/*` (mounted with `userAuth` in `backend/src/app.js`) or add `userAuth` middleware explicitly when needed.
4. **Authorize**:
   - if request is scoped to a site, call `checkSiteAccess(...)` early using the `site_id` from params/body.
5. **Delegate to service**:
   - implement service function in `backend/src/services/` (pure-ish logic + DB calls).
6. **Return** minimal JSON and appropriate HTTP status codes.

## Patterns to copy-paste (preferred)

### Route skeleton (thin)

- Validate input with `express-validator`
- Fail fast on validation errors
- Check site access (tenant + auth)
- Call a service

Pseudocode shape:

```js
router.post(
  '/:site_id/something',
  userAuth,
  requirePaidOrTrial,
  [param('site_id').isUUID(), body('x').isString().isLength({ max: 200 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { site_id } = req.params;
    const access = await checkSiteAccess(pool, req.user, site_id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const data = await someService.doThing({ siteId: site_id, ...req.body });
    return res.json(data);
  }
);
```

### SQL patterns (no string-building, parameterized)

**Optional filters** without dynamic SQL:

```sql
SELECT ...
FROM leads
WHERE site_id = $1
  AND ($2::text IS NULL OR lead_rating = $2::text)
  AND ($3::timestamptz IS NULL OR created_at >= $3::timestamptz)
ORDER BY created_at DESC
LIMIT $4;
```

Pass `null` for unused filters; keep the SQL text constant.

**Dynamic ORDER BY** (only allowlisted fields):

Use a fixed ORDER BY with CASE:

```sql
ORDER BY
  CASE WHEN $2 = 'created_at' THEN created_at END DESC,
  CASE WHEN $2 = 'updated_at' THEN updated_at END DESC,
  created_at DESC
```

Never inject column names directly.

### Tenant-bound lookups by id

When fetching a tenant object by id, always include `site_id`:

```sql
SELECT *
FROM conversations
WHERE id = $1 AND site_id = $2;
```

If you only have the object id, first fetch its `site_id`, then run `checkSiteAccess`, then fetch related data with `site_id` filtering.

## Service layer guidelines

- **Function signature**: accept a single object `{ siteId, user, ... }` to make `siteId` explicit.
- **Return shape**: return plain objects to routes; let the route decide HTTP details.
- **Errors**:
  - throw an error with `status`/`statusCode` for expected failures (e.g., 404/409)
  - let unexpected errors bubble to the global error handler
- **Cross-service calls**: prefer small focused services over one mega-service.

## Migrations (tenant-safe schema)

When adding tables that store customer data:
- include `site_id uuid NOT NULL`
- primary keys are UUID
- add FKs that enforce tenant relationships (e.g., `FOREIGN KEY (site_id) REFERENCES sites(id)`)
- add appropriate indexes like `(site_id, created_at)` for tenant queries
- place migration files in `backend/migrations/` with the existing numbering style

## Review checklist (before finishing)

- [ ] Route remains thin (validation + service call + response)
- [ ] All tenant data queries include `site_id = $n`
- [ ] `checkSiteAccess(pool, req.user, siteId)` is used for site-scoped endpoints
- [ ] No SQL interpolation; all queries use placeholders
- [ ] No permission checks rely on frontend/session claims
- [ ] Admin-only behavior is gated by `req.user.is_admin`

