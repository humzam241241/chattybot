# Reference: search patterns for tenant security audit

This file is meant to be used alongside `SKILL.md` for fast, repeatable discovery.

## A) Find customer-data tables/collections and query entrypoints

Look for code referencing these domains (adjust to your schema):

- leads
- conversations
- files
- analytics
- reports
- usage

Recommended searches:

- Table/collection names: `leads`, `conversations`, `files`, `analytics`, `reports`, `usage`
- Common route folders: `backend/src/routes`, `backend/src/app/api`, `admin/app/api`
- Common service folders: `backend/src/services`

### Practical “starting point” search patterns (copy/paste)

- Broad domain sweep:
  - `\b(leads?|conversations?|files?|analytics|reports?|usage)\b`
- Likely backend code paths:
  - `checkSiteAccess`
  - `site_id`
  - `is_admin`

## B) Missing `site_id` filters (SQL and query-builders)

### SQL strings or .sql files

Flag SQL that touches customer-data tables but lacks `site_id` in the WHERE clause.

High-signal search ideas:

- `from leads` / `join leads`
- `from conversations` / `join conversations`
- `from files` / `join files`
- `from analytics` / `join analytics`
- `from reports` / `join reports`
- `from usage` / `join usage`

Then inspect each query and confirm:

- Reads/writes include `WHERE site_id = $1` (or equivalent parameter) using **parameters**
- Joins do not bypass tenant constraints (e.g., joining by `id` without also matching `site_id`)

Also flag SQL injection risks (often correlated with missing tenant scoping):

- Template interpolation in SQL strings: `` `...${...}...` `` or `"..." + var + "..."`
- “Dynamic where” fragments concatenated from request params

### JavaScript/TypeScript query builders / ORMs

Common patterns to audit:

- `.where({ id })` without also scoping by `site_id`
- `.eq('id', ...)` without `.eq('site_id', siteId)`
- `.findUnique({ where: { id } })` where the model is tenant-bound

Red flag: fetching a tenant object by global id, then using its `site_id` later; prefer scoping from the start when possible.

### Common “site scope present?” checks (copy/paste patterns)

- Query is explicitly scoped:
  - `\beq\(\s*['"]site_id['"]`
  - `\bwhere\([^)]*site_id`
  - `\bWHERE\b[\s\S]*\bsite_id\b` (if your search supports multiline)
- Query is probably *not* scoped (inspect hits):
  - `\beq\(\s*['"]id['"]`
  - `\bwhere\([^)]*\bid\b`
  - `\bfindUnique\b|\bfindFirst\b|\bfindOne\b`

## C) Verify `checkSiteAccess(user, siteId)` is used consistently

Search for all uses of `checkSiteAccess` and ensure it is called:

- in the route before calling services, or
- in the service before any data access (preferred for shared service functions)

Also search for places it should exist but doesn’t:

- routes/services that accept `siteId` but never call `checkSiteAccess`
- routes that accept a tenant-bound resource id (lead_id, conversation_id, file_id) and never verify it belongs to the provided/derived `siteId`

## D) Route permission leak patterns

Search for these anti-patterns and inspect hits:

- **Trusting client claims**: `isAdmin`, `role`, `permissions`, `site_id` from request body
- **Using session for authz**: `session.site_id`, `session.isAdmin`, `req.session.*` for authorization decisions
- **Skipping authz**: route returns data without an access check
- **Fat routes**: database queries in route handlers (bypassing service layer)

## E) Admin check must come from `app_users.is_admin`

Search for “admin” gates and confirm the source of truth is DB-backed:

Look for suspicious patterns:

- `process.env.*ADMIN*`
- email allowlists (`@company.com`, `allowedEmails`, `adminEmails`)
- client headers (`x-admin`, `x-role`)
- client claims (`jwt.claims`, `token.role`, `isAdmin` from the client)
- hardcoded user ids

Confirm the “good” pattern:

- backend loads the user from DB
- uses `app_users.is_admin` to gate admin-only behavior

## F) Vulnerability severity guidance (quick)

- **Critical**: cross-tenant read/write of sensitive data; admin escalation; unauthenticated access to tenant data
- **High**: cross-tenant metadata exposure; write/delete requiring auth but missing tenant scoping; weak admin gating
- **Medium/Low**: defense-in-depth gaps where higher-level checks exist but query-level scoping is inconsistent
