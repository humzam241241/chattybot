---
name: tenant-security-audit
description: Audit the codebase for multi-tenant authorization flaws and tenant isolation bugs: find customer-data queries missing `site_id`, verify authorization uses `checkSiteAccess(user, siteId)`, inspect routes for permission leaks, confirm admin checks rely only on `app_users.is_admin`, and produce a vulnerability report with evidence and fixes. Use when reviewing authz/permissions, tenant isolation, `site_id` scoping, admin access, or potential data leakage across sites.
---

# Tenant security audit

## Operating rules (always)

- **Backend-only authorization**: never rely on frontend session data for permission checks.
- **Multi-tenant isolation**: any customer-data query must filter by `site_id` and authorization must go through `checkSiteAccess(user, siteId)`.
- **Admin**: admin privileges must come only from `app_users.is_admin` (no email allowlists, env flags, or client-provided claims).
- **SQL safety**: never construct SQL via string concatenation; use parameterized queries.
- **Thin routes**: route files validate input, call services, return responses. Business logic lives in `backend/src/services`.

## Quick start checklist

Copy/paste and mark as you go:

```
- [ ] Inventory all customer-data models/tables and their `site_id` usage
- [ ] Search for customer-data queries missing `site_id` filtering (and/or joins that bypass tenant constraints)
- [ ] Verify every tenant-bound code path calls `checkSiteAccess(user, siteId)` before data access
- [ ] Inspect routes for permission leaks (trusting client/session, missing authz, “fat” routes)
- [ ] Confirm admin-only behavior is gated by `app_users.is_admin` on the backend
- [ ] Produce a vulnerability report with severity, evidence (file:line), exploit scenario, and remediation
```

## Workflow

### 1) Search repository for queries missing `site_id`

Focus first on any query involving: **leads, conversations, files, analytics, reports, usage**.

- Find all read/write queries targeting customer-data tables/collections.
- Flag anything that selects/updates/deletes by `id` (or other keys) without also constraining `site_id`.
- Flag joins where `site_id` is not enforced on **both sides** (e.g., join by `id` only).
- Flag any query that takes `site_id` from the client but does not validate it and enforce access + scoping.

Use the concrete search patterns in [reference.md](reference.md).

### 2) Verify authorization uses `checkSiteAccess`

For each tenant-bound endpoint/job:

- Identify the **siteId source** (path param, body, derived from another object).
- Ensure `checkSiteAccess(user, siteId)` (or a wrapper that calls it) runs **before** any customer-data access.
- Ensure access checks are on the backend and do not depend on frontend session fields (e.g. `session.site_id`, `session.isAdmin`).
- Ensure downstream service functions do not perform “hidden” cross-tenant reads (e.g., load by `id` only).

### 3) Inspect routes for permission leaks

Route handlers should only:

1. validate input (including `siteId`)
2. call services
3. return responses

Permission-leak red flags:

- Route directly queries the database (bypassing service layer conventions).
- Route trusts client-supplied `userId`, `isAdmin`, `role`, or `site_id` without server-side verification.
- Route returns data before confirming `checkSiteAccess`.
- Route exposes an admin-only endpoint without checking `app_users.is_admin`.

### 4) Confirm admin checks rely on `app_users.is_admin`

Audit all “admin” gates:

- The gate must be enforced on the backend.
- The source of truth must be the database field `app_users.is_admin`.
- Reject patterns like: email allowlists, environment variable toggles, `x-admin` headers, client claims, or hardcoded special cases.

Use the search patterns in [reference.md](reference.md) to find likely violations.

### 5) Produce vulnerability report

Use this template. Provide **evidence** and a **specific remediation**.

```markdown
## Finding: <short title>

- **Severity**: Critical | High | Medium | Low
- **Category**: Tenant isolation | Authorization bypass | Admin escalation | Data exposure | Other
- **Affected**: <route(s)/job(s)/service(s)>

### Evidence
- `path/to/file.ts:123` — <what the code does>
- `path/to/other.sql:45` — <missing site_id filter / unsafe join / etc.>

### Impact
<What data/actions become possible cross-tenant? Who can exploit it?>

### Exploit scenario (concrete)
1. <step>
2. <step>

### Root cause
<Missing checkSiteAccess / missing site_id in query / admin gate not DB-backed / etc.>

### Recommended fix
- <code-level change, where it should live (route vs service), and how it preserves tenant isolation>
- <query fix: add site_id filter and enforce join constraints>

### Verification / tests
- <how to prove same-tenant works and cross-tenant is denied>
```

## Additional resources

- Search patterns and “what to flag”: [reference.md](reference.md)
