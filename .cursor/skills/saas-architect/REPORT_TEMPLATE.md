## SaaS Architecture Report (ChattyBot)

### Executive summary
- What the system is today (1–2 sentences)
- Biggest scaling/white-label risks (3 bullets)
- Highest-leverage recommendations (3 bullets)

### Current architecture snapshot (evidence-based)
- **System boundaries**: backend API, widget, admin, analytics, workers
- **Primary data flows**: widget bootstrap → chat → storage/analytics; ingestion; reporting
- **External dependencies**: Postgres/Supabase/pgvector, OpenAI, Playwright, Twilio, Stripe, email

### Multi-tenant architecture (tenant isolation)
- **Tenant model**: what defines a tenant; how `site_id` is created, carried, and validated
- **Authn/authz**: how identity is established; where `checkSiteAccess(user, siteId)` is enforced
- **Tenant scoping**: schema constraints + query patterns + service boundaries
- **Leakage risks**: joins, caches, background jobs, exports, admin endpoints

### White-label platform design
- **Branding surface area**: widget UI, colors, copy, bot persona, suggested questions, emails/SMS
- **Domains**: customer domains, widget hosting, API domains, admin domains
- **Integrations per tenant**: webhooks, SMTP, Twilio, analytics sinks
- **Recommended “tenant config contract”**: versioned schema and rollout approach

### Per-client configuration model
- **Configuration layers**: defaults → global settings → per-site overrides (what exists today)
- **Contract & validation**: recommended typed/schema validation and compatibility strategy
- **Public vs private config**: what should be exposed by `/site-config/:site_id`
- **Caching & invalidation**: per-tenant cache keys, TTL, safe invalidation
- **Feature flags / entitlements**: plan enforcement, usage limits, gated features

### Infrastructure scalability
- **API**: statelessness, horizontal scaling, DB connection pooling, rate limiting
- **Workers**: scheduling model, queue/retry/idempotency strategy, per-tenant throttling
- **Ingestion**: concurrency/backpressure, quotas, cost controls
- **Vector search**: index strategy, growth plan, partitioning triggers
- **Observability**: per-tenant metrics, tracing, cost telemetry, alerting

### Database design & data lifecycle
- **Schema health**: tenant columns, UUID PKs, FKs enforcing tenant relationships
- **Indexes**: hottest query paths; `site_id`-leading indexes where needed
- **Retention & privacy**: transcripts, embeddings, exports; deletion/archival strategy
- **Scaling options**: single shared DB vs schema-per-tenant vs DB-per-tenant (triggers + trade-offs)

### Phased roadmap
#### Now (0–4 weeks)
- [ ] …

#### Next (1–3 months)
- [ ] …

#### Later (3–12 months)
- [ ] …

### Risks & mitigations
- Risk → mitigation → detection signal

### Evidence (files examined)
- `path/to/file`: why it matters

### Assumptions
- …

### Open questions
- …

