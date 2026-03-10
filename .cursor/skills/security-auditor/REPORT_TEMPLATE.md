## Security Audit Report (ChattyBot)

### Executive summary
- Overall security posture (3–6 bullets)
- Highest-risk items (top 3)
- Highest-leverage fixes (top 3)

### Scope & method
- **Commit/branch**: <fill in>
- **In scope**: backend routes/services, database queries, auth middleware, admin tooling, webhooks/jobs
- **Out of scope**: generated build artifacts (e.g. `admin/.next/`)
- **How assessed**: repository review + targeted searches for authz/tenancy/SQL/env risks

### Findings (sorted by severity)
| Severity | Area | Title | Evidence | Impact | Recommended fix |
|---|---|---|---|---|---|

### Finding details
#### [SEVERITY] <Title>
- **Area**: Tenant isolation | Authorization | SQL injection | Permissions | Env usage | Other
- **Evidence**:
  - `path/to/file.ext:line-line` — <1–3 line snippet or concise description>
- **What’s wrong**: concise technical description
- **Exploit scenario**: concrete abuse path (cross-tenant user / attacker)
- **Impact**: what data/actions become possible
- **Recommended fix**:
  - Minimal safe change (preferred)
  - Follow-up hardening (tests, constraints, refactor)
- **Regression test plan**:
  - Same-tenant success case
  - Cross-tenant denial case

### High-confidence quick wins
- <3–10 low-risk, high-impact fixes>

### Longer-term hardening
- Service boundaries and shared authz helpers
- Database constraints (tenant FKs, indexes, RLS if applicable)
- Security test coverage (mandatory cross-tenant denial tests)
- Logging redaction + secret scanning

### Evidence (files examined)
- `path/to/file`: why it matters

### Assumptions
- …

### Open questions
- …

