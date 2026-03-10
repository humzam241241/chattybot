---
name: debug-failing-route
description: Debug backend failures by tracing from logs to the failing API route and its service, verifying authorization middleware, inspecting tenant-isolated parameterized database queries, checking required environment variables, applying a minimal fix, and verifying the endpoint works end-to-end. Use when the user mentions failing routes/endpoints, 4xx/5xx errors, stack traces, logs, auth/permission issues, missing env vars, or database query errors.
---

# Debug failing route

## Operating rules (always)

- **Start from evidence**: logs/stack traces → route → service → dependencies.
- **Backend-only authorization**: never rely on frontend session data for permission checks.
- **Multi-tenant isolation**: any customer-data query must filter by `site_id` and authorization must go through `checkSiteAccess(user, siteId)`. Admin is only `app_users.is_admin`.
- **SQL safety**: never construct SQL via string concatenation; use parameterized queries.
- **Thin routes**: route files validate input, call services, return responses. Business logic lives in `backend/src/services`.

## Quick start checklist

Copy/paste and mark as you go:

```
- [ ] Inspect logs; capture exact error + request path/method + correlation id/time
- [ ] Identify failing route file and corresponding service function
- [ ] Verify authn/authz path (middleware + checkSiteAccess + tenant scoping)
- [ ] Inspect DB queries for site_id filter + parameterization + correct joins/FKs
- [ ] Verify required env vars (and runtime environment) are present and non-empty
- [ ] Implement minimal fix with smallest blast radius
- [ ] Verify: reproduce locally, add/adjust test if available, confirm endpoint works
```

## Workflow

### 1) Inspect logs to identify the failing route

- Collect: **HTTP method**, **request path**, **status code**, **request id/correlation id**, and the **top stack trace frame**.
- If the app has multiple servers (web/admin/backend), ensure you’re looking at the correct process’s logs for that route.
- Prefer a concrete repro request (curl/Postman/browser steps) that matches the logged request.

### 2) Locate the corresponding service and route files

- Find the route handler by searching for the **exact path segment** or route name.
- Identify which service function it calls.
- Confirm the route stays “thin”: if the handler contains business logic, plan to move that logic into `backend/src/services`.

### 3) Check authorization middleware

Verify in order:

- **Authentication**: user identity is established on the backend (session/JWT/etc.).
- **Authorization**:
  - Any tenant-bound resource must call `checkSiteAccess(user, siteId)` (or a wrapper that does).
  - Do not grant access via email allowlists or environment variables.
  - Admin-only behavior must come from `app_users.is_admin`.
- **Tenant scoping**: request-derived `siteId` must be validated and then used consistently for access checks and DB filters.

### 4) Inspect database queries

For any query involving leads, conversations, files, analytics, reports, or usage:

- Ensure **every read/write** includes a `site_id` filter (and appropriate joins enforce tenant relationships).
- Ensure **parameterized queries** (no string concatenation).
- Verify joins don’t accidentally bypass tenant constraints (e.g., joining by id without `site_id`).
- If the failure is a migration/schema mismatch, confirm migrations live in `backend/migrations`.

### 5) Verify environment variables

- Identify which env vars the failing code path needs (API keys, DB URLs, feature flags).
- Confirm they are present in the runtime environment and are non-empty.
- If different environments exist (dev/staging/prod), verify the correct env file / deployment config is being used.
- Be alert for “truthy” string pitfalls (e.g., `"false"` vs `false`), mismatched variable names, or missing prefixes.

### 6) Implement the minimal fix

Prefer the smallest change that:

- Restores correct behavior for the failing request
- Preserves tenant isolation and backend-only permission checks
- Uses parameterized queries
- Keeps route files thin (move logic into `backend/src/services` if needed)

If multiple fixes are possible, choose the one with the **lowest blast radius** and **clearest correctness**.

### 7) Verify functionality

- Reproduce the original failing request and confirm it succeeds.
- Confirm the fix didn’t weaken authz/tenant isolation:
  - Attempt cross-tenant access and ensure it is denied.
  - Ensure queries still filter by `site_id`.
- Run the narrowest available automated check (unit/integration test, route test, or a small local repro).

## Examples (what “good” looks like)

### Example A: 500 error from missing env var

- Evidence: logs show `process.env.SOME_KEY` is undefined.
- Fix: validate env var at startup (or before use) and return a clear error; ensure deploy config sets it.
- Verify: restart server, hit endpoint, confirm it no longer errors.

### Example B: Unauthorized cross-tenant access bug

- Evidence: route reads data by `id` without checking `site_id`.
- Fix: add `checkSiteAccess(user, siteId)` and add `site_id` filter to the query using parameters.
- Verify: same-tenant access works, cross-tenant attempt is denied, tests pass.

