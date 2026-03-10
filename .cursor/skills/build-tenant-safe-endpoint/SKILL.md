---
name: build-tenant-safe-endpoint
description: Implement new backend data features safely in a multi-tenant app: create a SQL migration in backend/migrations, ensure customer tables include site_id with tenant-safe FKs, implement business logic in backend/src/services, add thin Express route handlers in backend/src/routes, enforce authorization with checkSiteAccess(pool, user, siteId), validate/sanitize inputs, use parameterized queries (no SQL string concatenation), and emit structured JSON logs. Use when adding new tables, new endpoints, or any leads/conversations/files/analytics/reports/usage queries.
---

# Build tenant-safe endpoint

## Operating rules (always)

- **Backend-only authz**: never rely on frontend session data for permissions.
- **Tenant isolation**: any customer-data read/write must be scoped by `site_id` and authorized via `checkSiteAccess(pool, user, siteId)` (admin derives only from `app_users.is_admin` / `req.user.is_admin`).
- **SQL safety**: never construct SQL via string concatenation/interpolation; use parameterized queries. Avoid interpolated `INTERVAL '${x} days'`-style SQL.
- **Thin routes**: route files validate input, call service functions, return responses. Business logic lives in `backend/src/services/`.

## Quick start checklist

Copy/paste and mark as you go:

```
- [ ] Migration: add/alter schema in backend/migrations (UUID PKs, site_id, tenant FKs, indexes)
- [ ] Table design: every customer-data table includes site_id; joins enforce tenant relationship
- [ ] Services: implement business logic in backend/src/services (parameterized queries)
- [ ] Routes: add/extend backend/src/routes handler (thin, validated, calls service)
- [ ] Authz: call checkSiteAccess(pool, req.user, siteId) early for tenant-bound operations
- [ ] Validation: express-validator on params/body/query; return 400 with errors array
- [ ] Logging: add structured JSON logs (no raw PII; include event, site_id, user_id, status)
```

## Workflow

### 1) Create the migration (backend/migrations)

- Add a new numbered SQL file in `backend/migrations/` (match existing naming).
- For new customer-data tables:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE`
  - Add `CREATE INDEX ... ON <table>(site_id)` and any query-critical indexes.
  - Add tenant-safe foreign keys (include `site_id` on child tables too; don’t rely on an unscoped `..._id` join).

### 2) Implement service logic (backend/src/services)

- Create/extend a service module in `backend/src/services/`.
- Service functions should:
  - Take `pool` plus explicit inputs (including `siteId`) rather than reading `req` directly.
  - Perform **only parameterized queries**.
  - Ensure every query includes a `site_id = $n` filter for tenant data.
  - Return plain JS objects (no Express `res` usage).

### 3) Add/extend a thin route handler (backend/src/routes)

- Add `express-validator` rules for `params`, `query`, and `body`.
- Fail fast:
  - `validationResult(req)` → 400 `{ errors: errors.array() }`
  - `checkSiteAccess(pool, req.user, siteId)` → return `{ error }` with `access.status`
- Delegate to a service function and map result to HTTP response.

### 4) Enforce checkSiteAccess consistently

- Always call `checkSiteAccess(pool, req.user, siteId)` **before** any tenant data access.
- When the resource is addressed by a non-site id (e.g. `file_id`, `conversation_id`):
  - First load the row’s `site_id` using a parameterized query.
  - Then call `checkSiteAccess` using that `site_id`.
  - Then perform the action with a `WHERE ... AND site_id = $n` guard where applicable.

### 5) Validate inputs (express-validator)

- Prefer:
  - `.isUUID()` for ids
  - `.isInt({ min, max })` / `.toInt()` for numeric query params
  - `.isString().trim().isLength({ max })` for text
- Keep validation close to the route; keep business rules in the service.

### 6) Add structured logging (JSON)

- Log **events**, not prose. Use `console.log(JSON.stringify({...}))` if no logger exists.
- Include:
  - `event`, `level`, `ts`, `site_id`, `user_id`, `route`, `method`, `status`
- Avoid logging secrets and raw PII (emails/phones/message bodies). Prefer hashes or redacted forms.

## Additional resources

- For copy/paste templates (migration + service + route + logging payloads), see [reference.md](reference.md)

