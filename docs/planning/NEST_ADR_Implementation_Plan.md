# NEST — Architecture Decision Record, Implementation Plan & Repository Structure

**Project:** Networked Equipment & Stock Tracker (COEP Satellite Initiative)
**Document status:** Draft for engineering kickoff — derived from NEST PRD v1.0 and NEST Software Engineering System Instructions
**Author:** Principal Software Engineer (NEST)
**Date:** 2026-08-09

This document is split into three parts:

1. **Architecture Decision Records (ADR-001 through ADR-010)** — the binding technical decisions for NEST, each with context, decision, and consequences.
2. **Implementation Plan** — phased delivery plan mapped to the PRD roadmap, with concrete workstreams, exit criteria, and open items requiring stakeholder input.
3. **Repository Structure** — the initial monorepo layout, with rationale for domain boundaries.

Nothing here implements Phase 2/3 functionality. Everything here is scoped to make the MVP (per PRD §3, §43) production-correct on day one, while leaving clean seams for Phase 2/3 (PRD §32, System Instructions §48).

---

## Part 1 — Architecture Decision Records

### ADR-001: Modular Monolith, Not Microservices

**Status:** Accepted

**Context**
NEST serves a single organization, at a scale of 50–100 concurrent users growing toward 300+ (PRD §27). The System Instructions (§4) explicitly forbid microservices, service meshes, and event-bus infrastructure absent a demonstrated requirement. The team is a rotating student engineering group; operational and cognitive overhead is a first-order cost, not an afterthought.

**Decision**
Build NEST as a single backend application ("the API") organized into strongly-bounded domain modules, backed by one PostgreSQL database, one object-storage service, one background worker process, and one reverse proxy. Domain boundaries are enforced at the code level (module structure, internal service interfaces) rather than at the network/process level.

**Consequences**
- One deployable backend artifact; one CI pipeline; one set of environment secrets to manage per environment.
- Domain modules (auth, assets, inventory, locations, checkouts, transfers, attachments, audit, etc.) must not reach into each other's persistence layer directly — they interact through service-layer interfaces. This preserves the *option* to extract a service later without a full rewrite, without paying for that flexibility today.
- Horizontal scaling, if ever needed beyond 300 users, is done by running multiple stateless API instances behind the reverse proxy, not by splitting services.

**Alternatives considered**
- *Microservices per domain* — rejected. Adds deployment, networking, and observability overhead disproportionate to team size and load; directly contradicted by System Instructions §4.

---

### ADR-002: Backend Language & Framework — TypeScript / NestJS

**Status:** Accepted

**Context**
The PRD (§39) and System Instructions (§5) allow either TypeScript/NestJS or Python/Django/FastAPI, and note Django's audit/RBAC ecosystem is a good fit. The decisive factors per System Instructions §5 are: security maturity, maintainability by a rotating student team, ecosystem quality, testing support, and operational simplicity.

**Decision**
Use **TypeScript with NestJS** for the backend.

**Rationale**
- **One language across the stack.** Frontend is React/TypeScript (ADR-003). A rotating student team benefits more from a single language and a shared type layer (`packages/shared-types`, see repo structure) than from Django's admin/audit conveniences — context-switching cost is a real onboarding tax for a team that turns over annually.
- **NestJS's module system maps directly onto the required domain boundaries** (System Instructions §6: auth, users, roles, assets, inventory, locations, checkouts, transfers, attachments, audit, security, reports, health). Each becomes a Nest module with its own controllers, services, and DTOs, which keeps ADR-001's boundary discipline enforceable rather than aspirational.
- **Guards and interceptors give a single, centralized place for server-side authorization** (System Instructions §13) — a `RolesGuard` and a resource-level `PolicyGuard` run before every handler, which is exactly the "centralized authorization middleware" the PRD (§14.3) and instructions require, and makes it structurally hard to forget an authz check.
- **Prisma (ADR-004) integrates cleanly with Nest's DI system** and generates types shared with DTOs, reducing a whole class of mass-assignment bugs by construction (allow-listed DTOs, not raw Prisma models, cross API boundaries).
- Strong testing story (Jest, supertest for integration tests) satisfies System Instructions §35 without extra tooling.

**Consequences**
- The team must be reasonably fluent in TypeScript; this is treated as an acceptable and shrinking risk given TypeScript's ubiquity in CS curricula.
- We give up Django's built-in admin site; NEST's admin/audit views are purpose-built frontend screens instead, which is preferable anyway since the PRD requires role-scoped, product-specific dashboards rather than a generic model admin.

**Alternatives considered**
- *Python/Django* — strong contender, rejected primarily on the two-language cost for a small rotating team and because Django's admin is not a substitute for NEST's audited, role-aware UI requirements.
- *Python/FastAPI* — rejected: less batteries-included than Django for auth/RBAC, and still incurs the two-language cost without Django's compensating advantages.
- *Express (no framework conventions)* — rejected: would require hand-rolling the module/guard structure NestJS provides out of the box, increasing the risk of an inconsistent or missed authorization check.

---

### ADR-003: Frontend — React + TypeScript

**Status:** Accepted

**Context**
PRD §39 and System Instructions §5 both point to React + TypeScript as the preferred direction, given ecosystem maturity and ease of onboarding new student contributors.

**Decision**
Use **React 18+ with TypeScript**, Vite as the build tool, Tailwind CSS for styling, and a headless accessible component primitive set (e.g., Radix UI primitives) as the foundation for the design system referenced in System Instructions §24.

**Consequences**
- Shared TypeScript types (API request/response DTOs) are published from `packages/shared-types` and consumed by both frontend and backend, so a backend DTO change surfaces as a frontend type error at build time rather than a runtime bug.
- Tailwind + Radix gives accessible primitives (dialogs, comboboxes, tables) without hand-building WCAG-compliant widgets from scratch — directly supports System Instructions §26.
- Frontend route protection is implemented for UX only (hiding nav items a user can't use); it is never treated as a security boundary. Every guarded action re-checks authorization server-side (ADR-002, System Instructions §13).

**Alternatives considered**
- *Vue + TypeScript* — acceptable alternative per PRD, not chosen because React has the larger pool of student-familiar contributors and a larger accessible-component ecosystem.

---

### ADR-004: Database & ORM — PostgreSQL + Prisma

**Status:** Accepted

**Decision**
Use **PostgreSQL 16+** as the single relational store, accessed through **Prisma ORM**, with Prisma Migrate for schema migrations.

**Rationale**
- PostgreSQL gives us foreign keys, check constraints, transactions, `SERIALIZABLE`/row-locking primitives for race-safe check-out (PRD FR-INV-06), and native full-text search (`tsvector`/GIN indexes) that satisfies the <500ms search requirement (PRD §12, §27) without introducing Elasticsearch/OpenSearch — consistent with System Instructions §27 ("use PostgreSQL full-text search before introducing an external search engine").
- Prisma provides parameterized queries by default (SQL-injection mitigation per System Instructions §18), a reviewable migration history (`prisma/migrations/`), and generated types that flow into DTOs.
- The runtime application DB role is created with `SELECT/INSERT/UPDATE/DELETE` on operational tables, `SELECT/INSERT` only on audit tables (no `UPDATE`/`DELETE` — enforced at the database grant level, not just application code, per PRD §17.1), and **no DDL privileges**. Migrations run under a separate, more-privileged migration role invoked only through CI/CD, never by the running application.

**Consequences**
- Two Postgres roles exist per environment: `nest_app` (runtime, least-privilege) and `nest_migrator` (DDL, CI-only). This is a small amount of extra setup that directly satisfies System Instructions §18's "runtime role must not possess unnecessary DDL privileges."
- Complex reporting queries (PRD §9.4) run against the primary read path at this scale (no read replica needed yet); this is revisited only if performance data shows it's warranted (System Instructions §40: "do not optimize prematurely").

**Alternatives considered**
- *MySQL/MariaDB* — PRD-permitted alternative, not chosen: PostgreSQL's native full-text search and stronger constraint/transaction semantics are a direct fit for the append-only ledger and search requirements without added infrastructure.

---

### ADR-005: Authentication & Session Model — Opaque Server-Side Sessions in PostgreSQL

**Status:** Accepted

**Context**
PRD §14.1 recommends an opaque server-validated session over stateless JWT, specifically because immediate revocation (FR-AUTH-06 — deactivated users must lose access immediately) is a hard requirement, and the user base is small enough that a session lookup on every request is cheap.

**Decision**
- Sessions are opaque, high-entropy tokens delivered as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (Lax rather than Strict only if a cross-site login redirect flow requires it; default to Strict otherwise).
- Session records live in a `sessions` table in PostgreSQL (not Redis): `id, user_id, created_at, last_seen_at, expires_at, revoked_at, ip_address, user_agent`. Postgres is chosen over Redis for this specific data because session/authentication state is security-critical and must not depend on a cache's persistence configuration — it lives in the same ACID store as the rest of NEST's system-of-record data. Redis (ADR-008) is reserved for the job queue, which is tolerant of data loss on restart.
- Passwords hashed with **Argon2id** (`argon2` library), tuned to current OWASP-recommended parameters, reviewed periodically.
- TOTP (RFC 6238) for 2FA; TOTP secrets and recovery codes are encrypted at rest / hashed as specified in PRD §14.2, using an application-level encryption key sourced from the environment secret store (never hardcoded).
- Step-up re-authentication (PRD §14.6) is implemented as a short-lived (`≤5 min`) `step_up_verified_at` timestamp on the session record, checked by a dedicated `StepUpGuard` on the specific sensitive endpoints listed in System Instructions §15.

**Consequences**
- Revoking a session (logout, admin deactivation, password reset) is a single `UPDATE sessions SET revoked_at = now()` — immediate and observable, satisfying PRD FR-AUTH-06 and FR-AUTH-05.
- Every authenticated request pays one indexed session lookup; at target scale (300 concurrent users) this is not a bottleneck. If it ever becomes one, an in-process/Redis session cache can be added as a read-through cache in front of Postgres without changing the source of truth — an explicit, documented future optimization, not a day-one requirement.
- Login, 2FA verification, and password-reset endpoints are behind progressive rate limiting (ADR-009) from day one.

**Alternatives considered**
- *Stateless JWT with refresh tokens* — rejected per PRD §14.1's explicit reasoning: revocation requires a server-side denylist anyway at this security bar, which erases JWT's main advantage while adding complexity.

---

### ADR-006: Object Storage & Attachment Delivery — Self-Hosted MinIO + Authenticated Download Proxy

**Status:** Accepted

**Context**
Attachments are untrusted input (System Instructions §21) and must never be publicly reachable; downloads require authorization (PRD FR-FILE-03). The PRD allows either short-lived signed URLs or an authenticated download proxy.

**Decision**
- Object storage: **MinIO** (S3-compatible), running as its own container/service, private bucket, no public read policy.
- Upload flow: client uploads to the backend API (not directly to MinIO); backend validates size limits, MIME allow-list (PDF/JPEG/PNG/WebP per PRD §21), and **file signature (magic bytes)** — never trusting filename, extension, or declared `Content-Type` — before writing the object to MinIO under a UUID-based key. The object starts in a `pending_scan` state and is not listed as downloadable.
- Scanning: upload triggers a background job (ADR-008) that streams the object to **ClamAV** (`clamd`) for scanning. On clean result, the attachment record flips to `available`; on detection, it flips to `quarantined` and is never served; on scanner failure, it stays `pending_scan` and is retried, per System Instructions §41 ("uploads should enter an appropriate pending/retry state").
- Download flow: we use an **authenticated download proxy** (`GET /api/v1/attachments/:id/download`) rather than exposing signed URLs to the client. The backend performs the same authorization check as any other resource endpoint (resource-level, not just role-level — PRD §14.3), writes an audit event, then streams the object from MinIO to the client using short-lived internal service credentials. This keeps the authorization and audit checkpoints inside the application's normal request pipeline rather than in a second, easier-to-misconfigure code path (signed-URL generation logic).

**Consequences**
- All attachment bytes flow through the backend, which is an acceptable cost at NEST's scale (photos/datasheets/invoices, not video) in exchange for a single, consistently-enforced authorization/audit checkpoint.
- If load ever makes proxying attachments a bottleneck, short-lived pre-signed URLs can be introduced later as an additive optimization behind the same authorization check, without changing the storage model.
- Soft-deleted attachments are retained (not physically removed) until a separate, explicit cleanup job runs, per System Instructions §21.

**Alternatives considered**
- *Direct pre-signed URLs to the client* — rejected as the default for MVP: it moves the authorization decision to URL-generation time rather than access time, and makes audit logging of actual downloads (vs. URL issuance) less precise. Revisit only if proxy bandwidth becomes a measured problem.

---

### ADR-007: Reverse Proxy & TLS — Caddy

**Status:** Accepted

**Decision**
Use **Caddy** as the sole public-facing entry point, terminating TLS with automatic certificate management, and reverse-proxying to the frontend static build and the backend API on internal-only ports.

**Rationale**
Automatic HTTPS with minimal configuration matches a small, rotating-team operational model (System Instructions §32). Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame protections) are set centrally at the Caddy layer where practical, with the backend also setting them as defense-in-depth (e.g., via `helmet`-equivalent Nest middleware) so no path bypasses them.

**Consequences**
Only ports 80/443 are exposed publicly. Backend, database, MinIO, Redis, and ClamAV all sit on an internal Docker network with no public port mappings (System Instructions §30).

**Alternatives considered**
*nginx + certbot* — viable, rejected only for Caddy's lower configuration/maintenance burden for a small self-managed deployment.

---

### ADR-008: Background Processing — BullMQ on Redis

**Status:** Accepted

**Decision**
Use a single background **worker process** running **BullMQ** on **Redis**, handling: antivirus scanning jobs, transactional email (password reset, notifications), scheduled reservation-expiry sweeps, and on-demand report generation when it exceeds a couple of seconds (PRD §9.4).

**Rationale**
This is the one piece of infrastructure beyond Postgres/MinIO that the PRD's own recommended stack calls for (§39), and it is required to satisfy System Instructions §41 ("an optional subsystem must not take down the core inventory system") — AV scanning and email must not block the request/response cycle for check-out, check-in, or asset registration.

**Consequences**
Redis is treated as **non-authoritative, disposable** infrastructure: job state can be lost on a Redis restart without violating any data-integrity guarantee, because inventory state itself never lives in Redis (it lives in Postgres, per ADR-004/ADR-005). This distinction — Redis for ephemeral job coordination only, Postgres for everything that must survive a restart — is the load-bearing reason ADR-005 keeps sessions out of Redis.

---

### ADR-009: API Design, Rate Limiting & CORS

**Status:** Accepted

**Decision**
- Versioned REST API under `/api/v1/`, JSON in/out, explicit response DTOs (never serializing Prisma models directly), explicit allow-listed request DTOs (`class-validator`/`class-transformer` with `forbidNonWhitelisted: true` — unknown fields are rejected, not silently dropped, per System Instructions §13/§17).
- Centralized `RolesGuard` + resource-level `PolicyGuard` on every non-public route; a short explicit list of public routes (login, password-reset request, health check) is maintained in one place, not inferred.
- Rate limiting via `@nestjs/throttler` (or equivalent) at the application layer, with stricter, progressive limits on `/auth/login`, `/auth/2fa/verify`, `/auth/password-reset`, and file upload endpoints, plus a general per-IP/per-account limit on search/list endpoints (PRD §15, §23).
- CORS is deny-by-default with an explicit origin allow-list (the app's own frontend domain per environment); no wildcard origin on authenticated routes.
- Consistent error envelope (`{ "error": { "code", "message" } }`); no stack traces, SQL errors, or internal identifiers returned to clients (System Instructions §38). OpenAPI (Swagger) spec generated from Nest decorators and published for internal reference.

**Consequences**
Every new endpoint has a checklist to satisfy before merge (auth? authz? DTO allow-list? rate limit tier? audit event? OpenAPI annotation?) — this is encoded as a PR template item, not left to memory.

---

### ADR-010: Deployment, Environments & CI/CD

**Status:** Accepted

**Decision**
- **Deployment unit:** Docker Compose, one `docker-compose.yml` per environment (dev/staging/production overlays), running: Caddy, frontend (static build served by Caddy or a minimal Node server), backend API, worker, PostgreSQL, MinIO, Redis, ClamAV. Single VPS for staging+production initially (separate hosts or at minimum fully separate containers/volumes/credentials — see Open Items).
- **CI/CD:** GitHub Actions pipeline: `lint → unit tests → build → integration tests → dependency/secret scanning → deploy to staging → manual approval → deploy to production`, exactly matching System Instructions §34. Database migrations run as an explicit, reviewed CI step using the `nest_migrator` role (ADR-004), never applied ad hoc on a running host.
- **Environments:** development, staging, production each get fully separate credentials, database, object-storage bucket, and secrets (PRD §23, System Instructions §31). No production data is ever copied into development.
- **Backups:** automated nightly PostgreSQL dumps (plus WAL archiving if RPO requires sub-24h recovery — see Open Items), encrypted, stored in a separate object-storage location from the primary MinIO bucket, with a documented, periodically-tested restore procedure (System Instructions §33 — "a backup that has never been restored is not verified").
- **Monitoring:** free/self-hosted Sentry for error tracking, an uptime checker (e.g., UptimeRobot) for availability, structured JSON logging from the backend (no secrets, no passwords/TOTP/session tokens ever logged, per System Instructions §11/§38).

**Consequences**
The entire production topology is reproducible from `docker-compose.prod.yml` plus environment-specific `.env` secrets held in GitHub Actions secrets / a secrets manager — never in source control (System Instructions §30).

**Open items requiring stakeholder decision before/at launch** (carried forward from PRD §42, not resolved by this ADR):
- Hosting budget/ownership and continuity during inter-semester gaps.
- Whether any asset categories require restricted visibility beyond standard RBAC in MVP (affects whether a `restricted` visibility flag is needed on `asset_definition`/`asset_instance` now, even if enforcement UI ships later).
- Backup retention window and offsite backup budget, which determines exact RPO/RTO.
- Whether viewer-role 2FA becomes mandatory at launch.

---

## Part 2 — Implementation Plan

The plan follows the PRD's indicative roadmap (§43) and enforces the System Instructions' Definition of Done (§51): a feature is not complete until its backend, frontend, validation, authorization, audit behavior, tests, and documentation are all done.

### Phase 0 — Foundations (target: 3–4 weeks)

**Goal:** a secure, deployable skeleton with nothing product-specific yet, so every later feature is built on a correct base.

| Workstream | Deliverables |
|---|---|
| Repo & tooling | Monorepo scaffolding (Part 3), ESLint/Prettier, TypeScript project references, `packages/shared-types` |
| CI/CD skeleton | GitHub Actions: lint, build, unit test stages wired end-to-end against an empty app; branch protection on `main`/`production` |
| Database foundation | Prisma schema for `users`, `roles`, `sessions`, `audit_log`; `nest_app`/`nest_migrator` DB role split; first migration |
| Auth core | Argon2id password hashing, login/logout, opaque session cookies, session regeneration on login, generic auth error messages |
| 2FA core | TOTP enrollment/verification, encrypted secret storage, recovery codes (hashed, single-use) |
| Password reset | Token issuance/consumption flow, generic "if this account exists" response, session invalidation on completion |
| RBAC skeleton | `viewer/contributor/stores_manager/admin` enum, `RolesGuard`, centralized policy layer stub, default-to-`viewer` on registration |
| Step-up auth | `StepUpGuard`, `step_up_verified_at` session field, applied to a placeholder sensitive endpoint to prove the pattern |
| Audit core | Append-only `audit_log` table (no UPDATE/DELETE grant), `AuditService` used by the auth flows above as the first consumers |
| Security baseline | Security headers, CORS allow-list, rate limiting on auth endpoints, CSRF strategy decision + implementation |
| Infra skeleton | Docker Compose for dev; Caddy + backend + Postgres + Redis + MinIO + ClamAV wired together locally |
| Environments | Dev/staging separation with distinct `.env` templates (no real secrets committed) |
| Deployment pipeline | Staging deploy from CI on merge to `main`, with manual-approval gate documented (even if production isn't live yet) |

**Exit criteria:** a user can register (as viewer), log in, enroll 2FA, reset a forgotten password, and every one of those actions produces a correct audit entry — end to end, in staging, over HTTPS, with CI green.

---

### Phase 1 — MVP Core (target: 6–8 weeks)

Build in the following order; each numbered group should be treated as a completable unit (backend + frontend + tests + docs) before moving to the next, per System Instructions §42.

**1. Locations**
Self-referencing `locations` tree, breadcrumb rendering, subtree query support (used by search later). CRUD restricted to `stores_manager`/`admin`.

**2. Catalog / Asset Definitions**
Shared `asset_definition` (name, category, manufacturer, part number, datasheet link, description) underlying both instance and quantity records.

**3. Individually Tracked Assets (`asset_instance`)**
Registration, metadata editing (allow-listed fields per role), soft delete/archive, status enum + explicit domain operations (no generic status-patch endpoint) implementing the lifecycle in PRD §10 / System Instructions §8.

**4. Quantity Inventory (`inventory_item` + append-only transactions)**
`quantity_on_hand` derived from a transaction ledger; receive/issue/consume/adjust/transfer transaction types; DB constraints preventing negative stock; every mutation requires actor + reason (where required) + audit event, inside the same DB transaction as the state change (PRD §20, System Instructions §20).

**5. Check-out / Check-in**
Row-level locking or a unique-constraint pattern that makes double-issue impossible under concurrent requests (this is explicitly acceptance-gated — System Instructions §47). Check-in prompts for condition; a condition change is flagged.

**6. Transfers**
Location update + append-only location-history event, in a transaction.

**7. Damage / Loss / Repair / Retirement / Disposal**
Each as an explicit domain operation with its own authorization rule (contributor can flag damage/loss; only stores_manager/admin can retire/dispose), matching the state machine in System Instructions §8.

**8. Asset Relationships**
Generic `asset_relationships` table (`parent_asset_id`, `child_asset_id`, `relationship_type`), cycle validation enforcing DAG semantics, used to render assembly/subsystem views.

**9. Attachments**
Full upload → validate → quarantine-scan → available pipeline per ADR-006; authenticated download proxy; soft delete.

**10. Search**
Postgres full-text (`tsvector`/GIN) + structured filters (status, category, location subtree, project, date range), permission-scoped at the query level (never filtered client-side), sortable, empty-state handling.

**11. Dashboard**
Role-aware widgets per PRD §13, all queries permission-scoped server-side; graceful empty states for every widget.

**12. Reservations**
Optional-expiry reservation records, auto-expiry via the Phase-0 worker, distinct from "issued" in UI and search.

**Exit criteria (mirrors System Instructions §47 Product Acceptance Gate):**
- A new viewer can find an asset and its location quickly.
- A contributor can register common inventory quickly (bulk-friendly quantity receipt).
- Every inventory-changing action produces a correct, complete audit record.
- Double checkout is impossible under a concurrent-request test.
- Deactivating a user immediately revokes their sessions.
- Dashboard counts are accurate against the underlying transaction ledger.
- Search results respect role/visibility rules under test.
- Attachments are unreachable without authorization, verified by an IDOR test.
- Quantity changes remain transactionally consistent under concurrent-load testing.

---

### Phase 2 — Security Hardening & Launch Prep (target: 2–3 weeks)

- Full pass against System Instructions §46 Security Acceptance Gate and PRD §38 Security Acceptance Criteria: auth bypass, IDOR, mass assignment, injection, XSS, CSRF, insecure upload, broken access control — each with an explicit automated or manual test.
- Dependency and secret scanning wired as a CI gate (not just a report).
- TLS configuration verified to reach an "A" grade on a standard SSL/TLS test.
- Backup + restore drill actually executed end-to-end at least once before cutover, with the runbook documented from the drill itself, not written speculatively.
- Accessibility pass: automated scan (axe or equivalent) + manual keyboard-only walkthrough of the core workflows (search, check-out, check-in, transfer, dashboard).
- Performance validation against PRD §27 targets (search <500ms, dashboard load, <2s typical page load) under a realistic synthetic load (50–100 concurrent simulated users).
- Reporting (FR-RPT-01–04) implemented here if it has not already landed in Phase 1, since it's P1 and admin-only, not a blocking MVP dependency for other workflows.
- Production cutover: environment separation double-checked, DNS/TLS live, monitoring/alerting confirmed receiving real signals, rollback plan documented.

**This phase is launch-blocking.** Per System Instructions §46, a security-critical failure found here blocks production deployment regardless of schedule pressure.

---

### Phase 3+ — Post-Launch (ongoing, out of scope for this plan)

Phase 2/3 product features (projects/procurement, granular permissions, notifications, barcode scanning, calibration, auditor role, tamper-evident audit export, multi-warehouse) are **not** designed into the MVP schema beyond the extension points already described in ADR-002 through ADR-006 (e.g., the `permissions`/`role_permissions` seam under RBAC, the generic `asset_relationships` table, the flexible `locations` tree). They are not built now, per System Instructions §48.

---

## Part 3 — Repository Structure

Single monorepo, managed with npm/pnpm workspaces. Rationale for each top-level boundary follows the System Instructions §6 requirement to separate frontend/backend/shared types/database/infra/tests/docs/CI/scripts, while grouping backend code by domain rather than by technical layer, and avoiding generic dumping-ground files.

```
nest/
├── apps/
│   ├── backend/                      # NestJS API — the modular monolith
│   │   ├── src/
│   │   │   ├── main.ts               # bootstrap, global pipes/guards/filters
│   │   │   ├── app.module.ts         # root module wiring
│   │   │   ├── config/               # typed env/config loading, no secrets committed
│   │   │   ├── auth/                 # login, sessions, 2FA, password reset, step-up
│   │   │   ├── users/                # user CRUD, deactivation, profile
│   │   │   ├── roles/                # role assignment, RBAC enum + guard
│   │   │   ├── permissions/          # thin permission-mapping seam for Phase 2 (not exposed in MVP UI)
│   │   │   ├── assets/               # asset_definition (catalog) + asset_instance
│   │   │   ├── inventory/            # inventory_item + transaction ledger
│   │   │   ├── locations/            # location tree, subtree queries, breadcrumbs
│   │   │   ├── checkouts/            # check-out / check-in domain operations
│   │   │   ├── transfers/            # location-transfer domain operations
│   │   │   ├── reservations/         # reservation create/cancel/expiry
│   │   │   ├── relationships/        # asset_relationships (DAG-validated)
│   │   │   ├── attachments/          # upload, AV-scan handoff, download proxy
│   │   │   ├── search/               # full-text + structured filter queries
│   │   │   ├── dashboard/            # role-aware aggregate queries
│   │   │   ├── reports/              # xlsx/pdf report generation (admin-only)
│   │   │   ├── audit/                # append-only audit log writer + query API
│   │   │   ├── security/             # shared guards, rate limiting, CSRF, headers
│   │   │   ├── health/               # liveness/readiness endpoints (public)
│   │   │   └── common/               # cross-cutting interceptors/filters/pipes ONLY
│   │   │                             #   (explicit exception filters, response envelopes —
│   │   │                             #    not a general-purpose utils dump)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/                     # integration + security tests (supertest)
│   │   └── package.json
│   │
│   ├── worker/                       # BullMQ background worker process
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── jobs/
│   │   │   │   ├── av-scan.job.ts
│   │   │   │   ├── email.job.ts
│   │   │   │   ├── reservation-expiry.job.ts
│   │   │   │   └── report-generation.job.ts
│   │   │   └── queues/
│   │   └── package.json
│   │
│   └── frontend/                     # React + TypeScript SPA
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/                  # routing, layout shell, providers
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── assets/
│       │   │   ├── inventory/
│       │   │   ├── locations/
│       │   │   ├── checkouts-transfers/
│       │   │   ├── attachments/
│       │   │   ├── search/
│       │   │   ├── dashboard/
│       │   │   ├── reports/
│       │   │   └── admin/            # users, roles, audit log viewer
│       │   ├── design-system/        # shared UI primitives (buttons, tables, modals, forms)
│       │   ├── api-client/           # generated/typed client over shared-types + OpenAPI
│       │   └── accessibility/        # shared a11y test helpers, focus-management utilities
│       ├── e2e/                      # Playwright/Cypress E2E specs
│       └── package.json
│
├── packages/
│   └── shared-types/                 # DTOs and enums shared between frontend and backend
│       ├── src/
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.staging.yml
│   │   └── docker-compose.prod.yml
│   ├── caddy/
│   │   └── Caddyfile
│   └── env/
│       ├── .env.example              # documented, no real values
│       └── README.md                 # what each var is, which service reads it
│
├── docs/
│   ├── architecture/
│   │   ├── adr/                      # this document's ADRs, one file per ADR going forward
│   │   └── domain-model.md
│   ├── development/
│   │   ├── local-setup.md
│   │   └── coding-standards.md
│   ├── operations/
│   │   ├── deployment.md
│   │   ├── backup-and-restore.md
│   │   ├── incident-response.md
│   │   └── maintenance-tasks.md
│   ├── security/
│   │   ├── security-controls.md
│   │   └── threat-model.md           # living copy of PRD §16, updated as the system evolves
│   └── api/
│       └── openapi.yaml              # generated, committed for reviewability
│
├── scripts/
│   ├── seed-dev-data.ts
│   ├── db-backup.sh
│   └── db-restore.sh
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # lint → unit → build → integration → scan
│       └── deploy.yml                # staging auto-deploy → manual approval → production
│
├── package.json                      # workspace root
├── pnpm-workspace.yaml
└── README.md                         # project overview + links into docs/
```

**Notes on the structure**
- No `utils.ts`/`helpers.ts`/`common.ts` catch-alls at the domain level; each backend module owns its own logic, and the top-level `common/` folder is reserved strictly for cross-cutting framework plumbing (interceptors, filters), not business logic.
- `permissions/` exists as a real but minimal module in Phase 0/1 — just enough seam (a `permissions`/`role_permissions` mapping the four MVP roles resolve through) that Phase 2's granular permissions are additive, per PRD §7.3 and System Instructions §14's requirement that the permission layer accommodate this without a rewrite.
- `docs/architecture/adr/` becomes the home for all *future* ADRs as one-file-per-decision, following the format established in Part 1 of this document.

---

*End of document.*
