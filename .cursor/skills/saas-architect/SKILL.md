---
name: saas-architect
description: Analyze the repository and produce architecture strategies to scale the SaaS platform and support white-label deployments. Focus on multi-tenant architecture, white-label platform design, per-client configuration, infrastructure scalability, and database design. Use when the user asks for architecture reviews, scaling plans, tenant isolation, white-labeling, per-customer configuration, infrastructure, or database strategy. This skill is report-only and must not modify code.
---

# SaaS Architect (report-only)

## Operating rules (always)

- **Read-only**: do not modify code or files. Do not apply patches. Do not install dependencies. Do not run commands that write to disk or change infra state.
- **Architecture report only**: output is a markdown report with recommendations and trade-offs, grounded in repository evidence.
- **Multi-tenant security**: tenant isolation is mandatory. Any customer-data access must be scoped by `site_id`, and authorization must go through `checkSiteAccess(user, siteId)`. Admin privileges come only from `app_users.is_admin`.
- **SQL safety**: never construct SQL via string concatenation; always use parameterized queries.
- **Thin routes**: route handlers validate input, call services, return responses; business logic belongs in `backend/src/services`.
- **Ignore build artifacts**: do not treat generated output (e.g. `admin/.next/`) as source of truth; prefer `src/` and migration files.

## Quick start checklist

Copy/paste and mark as you go:

```
- [ ] Identify system boundaries (backend API, widget, admin, analytics) and data flows
- [ ] Map current tenant model (what defines a tenant, where `site_id` is enforced, authz flow)
- [ ] Inventory configuration layers (global defaults, per-site overrides, branding, domains)
- [ ] Review database schema + migrations for tenant FKs, indexes, growth limits, query patterns
- [ ] Review infrastructure topology (deployment targets, workers, queues/schedulers, caching)
- [ ] Enumerate white-label requirements (branding, custom domains, email/SMS, per-tenant integrations)
- [ ] Produce a phased roadmap (now/next/later) with risk and effort notes
```

## Workflow (use this order)

### 1) Establish today’s architecture (evidence-first)

Capture a short “current state” snapshot:

- **Repo layout**: identify major apps (`backend/`, `widget/`, `admin/`, `admin-dashboard/`).
- **Primary data flow(s)**: widget bootstrap (`/site-config/:site_id`) → chat endpoints → storage/analytics.
- **Runtime dependencies**: Postgres/Supabase, pgvector, OpenAI, file storage, background workers.

When citing evidence, reference **file paths and functions** (and line ranges when helpful).

### 2) Multi-tenant architecture analysis (tenant = `site`)

Answer explicitly:

- **Tenant identifier**: where `site_id` originates (embed code, routes, DB), and where it is validated.
- **Authn/authz**: how admin/user identity is established; how `checkSiteAccess` is applied.
- **Tenant scoping guarantees**:
  - schema-level (FKs and tenant columns)
  - query-level (`WHERE site_id = $1`)
  - service boundaries (central helpers vs ad hoc checks)

Flag any “foot-guns” that can cause cross-tenant leakage (joins by `id` without `site_id`, missing FKs, shared caches keyed too broadly, etc.).

### 3) White-label platform design (branding + domains + integrations)

Identify what’s already configurable and what needs a clearer product model:

- **Brand surface area**: widget UI, copy, bot persona, suggested questions, colors, logos, email templates, SMS identity.
- **Custom domains**:
  - widget hosting domain vs customer domain
  - API domain
  - admin domain(s)
- **Per-tenant integrations**: SMTP, Twilio numbers, webhook endpoints, analytics sinks.

Recommend a **white-label “tenant config contract”**: a single, versioned schema for what can vary per tenant (and what cannot), plus a strategy for validation and rollout.

### 4) Per-client configuration model

Based on existing layering (code defaults → global settings → per-site overrides), recommend how to evolve:

- **Config schema**: JSON schema (or typed contract) with validation, defaults, and migration strategy.
- **Delivery**: what config is safe to expose publicly via `/site-config/:site_id` vs admin-only.
- **Caching**: per-tenant cache keys, TTLs, invalidation hooks; avoid leaking config across tenants.
- **Feature flags**: per-tenant entitlements (plan, usage, gated features) and server-side enforcement.

### 5) Infrastructure scalability

Evaluate and recommend strategies for:

- **API scalability**: stateless backend, horizontal scaling, connection pooling behavior, rate limiting.
- **Workers/schedulers**: move cron-like jobs toward a queue-based design; idempotency; retries; dead-lettering.
- **Ingestion**: Playwright crawling capacity, concurrency limits, backpressure, per-tenant quotas.
- **Vector search**: index choice, dimension growth, query patterns, partitioning options at higher scale.
- **Observability**: structured logs, tracing/correlation ids, per-tenant metrics, cost telemetry (LLM tokens).

### 6) Database design (tenant-safe + growth-ready)

Review migrations and propose:

- **Tenant columns**: ensure every customer-data table includes `site_id`.
- **Keys + constraints**: UUID PKs, FKs enforcing tenant relationships, uniqueness constraints scoped by `site_id` as needed.
- **Indexes**: for hottest access paths, always include `site_id` leading where appropriate.
- **Data lifecycle**: retention policies per tenant, soft delete vs hard delete, archival strategy for transcripts/embeddings.
- **Future options**: schema-per-tenant or database-per-tenant only if/when needed; outline triggers to adopt.

## Output requirements

Produce **one** markdown report. Keep it concrete and grounded in this repo.

- Use this template: see `REPORT_TEMPLATE.md` in this skill folder.
- Include a short **“Evidence”** section with key files you relied on (paths + brief notes).
- Include a **phased roadmap** with “Now / Next / Later” and call out risks and migration steps.
- Do not propose code diffs; describe architectural changes and migration plans at a design level.

## If information is missing

Do not ask the user to confirm assumptions mid-report. Instead:

- list **Assumptions** explicitly
- list **Open questions** at the end (answerable via repo inspection or runtime configuration)

