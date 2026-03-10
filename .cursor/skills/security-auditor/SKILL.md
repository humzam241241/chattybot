---
name: security-auditor
description: Audit the repository for security vulnerabilities with emphasis on multi-tenant isolation, authorization logic, SQL injection risks, missing permission checks, and unsafe environment variable usage. Use when the user asks for a security audit, mentions tenant isolation, authz/authn, permission checks, SQL injection, unsafe SQL, environment-variable bypasses, or data leakage across sites.
---

# Security Auditor

## Operating rules (always)

- **Backend-only authorization**: never rely on frontend session data for permission checks.
- **Multi-tenant isolation**: any customer-data access must be tenant isolated by `site_id` and authorization must go through `checkSiteAccess(user, siteId)`. Admin privileges must come only from `app_users.is_admin`.
- **SQL safety**: never construct SQL via string concatenation; always use parameterized queries.
- **Thin routes**: route handlers validate input, call service functions, return responses. Business logic lives in `backend/src/services`.
- **No env-var based access**: never grant access using email allowlists or environment variables. Env vars can configure integrations/features, not permissions.
- **Ignore build artifacts**: ignore generated output like `admin/.next/` and focus on source code and migrations.

## Required output (security report)

Produce a single markdown security report using:
- `REPORT_TEMPLATE.md`

## Quick start checklist

Copy/paste and mark as you go:

```
- [ ] Identify all entry points (API routes, server actions, RPC handlers, cron/jobs, webhooks)
- [ ] Map tenant-bound resources (leads, conversations, files, analytics, reports, usage) and their `siteId` inputs
- [ ] Audit authn/authz: checkSiteAccess usage, admin checks (app_users.is_admin), and missing permission checks
- [ ] Audit data access: every tenant-bound query filters by site_id; joins don’t bypass tenant constraints
- [ ] Audit SQL injection: no concatenated SQL, no unsafe template strings; parameter arrays/binds used everywhere
- [ ] Audit env usage: no auth bypass flags; no secrets logged; no server secrets exposed to clients
- [ ] Produce a report with evidence (file:line), severity, impact, and recommended fixes
```

## Workflow

### 1) Inventory entry points and data domains

Focus on code paths that can read/write:
- leads, conversations, files, analytics, reports, usage
- billing/subscription state
- admin-only capabilities (user management, pricing overrides, site management)

Prioritize:
- public-facing endpoints (no session required)
- endpoints taking `siteId`/`site_id`/`site_id`-adjacent identifiers
- “debug” or “internal” endpoints
- webhooks and background jobs (often bypass auth by design)

### 2) Authorization and tenant isolation audit

For each endpoint/handler that touches tenant-bound data:

- Ensure it **derives/accepts** a `siteId` and **validates** it.
- Ensure it calls `checkSiteAccess(user, siteId)` (or a clearly equivalent wrapper) **before** any data access.
- Ensure **admin-only** actions check admin via `app_users.is_admin` (not env vars, not email, not client claims).
- Ensure error handling doesn’t leak cross-tenant existence (prefer “not found” / generic responses when appropriate).

Common failure modes:
- Fetching by `id` alone without also checking `site_id`
- Checking tenant access in one layer but querying in another layer without `site_id`
- Admin gates implemented as `process.env.*` toggles or email allowlists

### 3) Database query audit (tenant scoping + injection safety)

For every query touching tenant-bound data:

- **Tenant filter**: reads/writes must filter by `site_id`.
- **Join safety**: joins must not allow cross-tenant traversal (avoid `JOIN ... ON t.id = u.t_id` without also constraining `site_id`).
- **Parameterization**: confirm values are bound via parameters/binds (no string concatenation, no interpolated SQL).

If you find a violation, recommend a fix that:
- adds `site_id` to the predicate (and to tables that store customer data, if missing)
- enforces tenant relationships with foreign keys where applicable
- moves any query construction into a service layer function that takes `(siteId, ...)` explicitly

### 4) Environment variable usage audit

Search for:
- env vars used as permission gates (e.g. `BYPASS_AUTH`, `ADMIN_EMAILS`, `ALLOWLIST`, `DISABLE_AUTH`)
- secrets logged to console or returned in responses
- server-only env vars exposed to clients (e.g., Next.js `NEXT_PUBLIC_*` misuse or leaking `process.env` wholesale)

Recommendations should:
- remove env-based permission logic in favor of backend checks
- validate required env vars at startup (fail fast) rather than implicitly bypassing behavior
- redact sensitive values in logs

### 5) Produce the security report (required output)

Write a markdown report using this structure:

```
## Executive summary
- Overall posture in 3–6 bullets

## Findings (sorted by severity)
| Severity | Area | Title | Evidence | Impact | Recommended fix |
|---|---|---|---|---|---|

## Finding details
### [SEVERITY] Title
- Evidence: `path/to/file.ext:line` (include a short quoted snippet)
- What’s wrong: concise technical description
- Exploit scenario: how an attacker/cross-tenant user would abuse it
- Impact: what data/actions are exposed
- Recommended fix:
  - Minimal safe change (preferred)
  - Follow-up hardening (tests, constraints, refactor)
- Regression test plan: at least one same-tenant success + cross-tenant denial case

## High-confidence quick wins
- 3–10 bullet list of low-risk fixes

## Longer-term hardening
- structural improvements (service boundaries, helper APIs, DB constraints, security test coverage)
```

Severity guidance:
- **Critical**: cross-tenant data access; auth bypass; SQL injection on sensitive data; admin privilege escalation
- **High**: missing permission checks on sensitive ops; secrets exposure; weak tenant scoping likely exploitable
- **Medium/Low**: defense-in-depth gaps, noisy logging, missing validation, minor info leaks

## Recommended repo-wide searches (use as starting points)

Use targeted searches and then read surrounding code to confirm:

- Tenant/auth:
  - `checkSiteAccess(`
  - `is_admin`
  - `site_id` and `siteId`
- “Debug/internal” surfaces:
  - `/debug`, `debug`, `internal`, `test`, `dev`, `mock`
- SQL risk patterns (language-dependent):
  - `SELECT ` / `INSERT ` / `UPDATE ` / `DELETE `
  - template strings containing SQL keywords (e.g. `` `SELECT ${` ``)
  - `+` concatenation near SQL keywords
- Env usage:
  - `process.env`
  - `NEXT_PUBLIC_`
  - `ALLOWLIST`, `BYPASS`, `DISABLE_AUTH`, `ADMIN_EMAIL`

## Fix recommendation principles

- Prefer smallest, highest-confidence change that restores correct authorization + tenant isolation.
- If a route is “fat”, recommend moving logic into `backend/src/services` and keep handler thin.
- Prefer explicit function signatures that require `siteId` for tenant-bound operations.
- Recommend adding/adjusting tests to prevent regressions (cross-tenant denial cases are mandatory for authz fixes).

