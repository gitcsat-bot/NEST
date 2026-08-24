# NEST — Security Design

**Inputs:** NEST PRD v1.0 (§14–23, §38), System Instructions (§10–23, §46), NEST ADR, NEST TDS, NEST Database Design, NEST API Contract (all approved)
**Scope note:** This consolidates and formalizes NEST's security architecture into one authoritative document: threat model, control matrix, and the specific, testable acceptance criteria that gate production launch. Earlier documents specified individual mechanisms (session design in the TDS, grants in the Database Design, error codes in the API Contract) where they were needed to complete another artifact; this document is where those mechanisms are assembled, checked for gaps against a systematic threat model, and turned into a verification plan. No code.

---

## 1. Security Objectives

Mapped to PRD §14–23 and framed as CIA triad + accountability, since NEST is a system of record (PRD §1: "the definitive source of truth for what equipment/stock exists, where it is, and who has it"):

| Objective | What it means for NEST |
|---|---|
| **Confidentiality** | Only authorized users see asset/inventory data, attachments, and personal data (who holds what); no data is reachable by URL-guessing or role-escalation |
| **Integrity** | The inventory ledger (quantities, statuses, locations, custody) cannot be altered except through the defined domain operations, and every alteration is attributable and permanent in the audit trail |
| **Availability** | Core inventory operations (search, check-out, check-in, register) never depend on optional subsystems (AV scanning, email, reporting) being healthy |
| **Accountability** | Every state-changing action is traceable to an actor, a time, and a before/after state, and that trail is itself tamper-resistant |

These four objectives, in this priority order for a conflict (integrity and accountability are non-negotiable even at some cost to convenience; availability of *optional* subsystems is explicitly allowed to degrade), are the standard NEST's security decisions are judged against below.

---

## 2. Trust Boundaries & Data Flow

```
┌─────────────┐        HTTPS only        ┌───────────────────────────┐
│   Browser    │ ───────────────────────▶ │  Caddy (TLS termination,   │
│ (untrusted)  │ ◀─────────────────────── │  security headers)         │
└─────────────┘                           └──────────────┬─────────────┘
                                                            │ internal network only
                              ┌─────────────────────────────┼──────────────────────────┐
                              ▼                              ▼                          ▼
                     ┌────────────────┐          ┌──────────────────┐        ┌──────────────────┐
                     │  Backend API    │          │   Worker process  │        │   Frontend static │
                     │  (NestJS)       │◀────────▶│   (BullMQ jobs)   │        │   build            │
                     └───────┬────────┘  Redis    └─────────┬────────┘        └────────────────────┘
                              │                                │
             ┌────────────────┼────────────────┐              │
             ▼                ▼                 ▼              ▼
     ┌───────────────┐ ┌─────────────┐  ┌──────────────┐ ┌───────────┐
     │  PostgreSQL     │ │   MinIO     │  │   ClamAV      │ │  SMTP      │
     │ (nest_app role,  │ │ (private    │  │  (clamd)      │ │ (outbound  │
     │  least priv.)    │ │  bucket)    │  │               │ │  only)     │
     └───────────────┘ └─────────────┘  └──────────────┘ └───────────┘
```

**Trust boundaries** (every crossing is a point where input is untrusted and must be (re-)validated, per System Instructions §17):

1. **Browser → Caddy/Backend** — the primary boundary; everything from here is untrusted input regardless of what the frontend already validated (frontend validation is UX, never a security control — TDS §5.3).
2. **Backend → PostgreSQL** — parameterized only (ADR-004); the backend never constructs SQL by string concatenation.
3. **Backend → MinIO** — object keys are UUIDs generated server-side, never derived from user input (System Instructions §21); the backend's MinIO credentials are scoped to the single NEST bucket.
4. **Uploaded file → ClamAV / storage** — the file itself is untrusted content until scanned; it is never served, previewed, or executed before `status = available`.
5. **Backend → SMTP** — outbound only, no user-controlled content is ever placed in an email header (mitigates header injection); email body content that includes user data (e.g., a display name) is treated as untrusted and escaped for the email format used.
6. **CI/CD → Production** — the migration role, deployment credentials, and any third-party API keys are a boundary in their own right (§9).

---

## 3. Threat Model (STRIDE, by Flow)

### 3.1 Authentication & Session Flow

| Threat (STRIDE) | Scenario | Mitigation | Where specified |
|---|---|---|---|
| Spoofing | Credential stuffing / brute force against login | Progressive rate limiting + account lockout window, generic error message (no user enumeration) | TDS §12.2, API Contract §11 |
| Spoofing | Session token theft (XSS, network sniffing, shoulder-surfing a URL) | `HttpOnly` (unreachable from JS) + `Secure` (HTTPS-only) + `SameSite` cookie; token never placed in a URL or query string | ADR-005, TDS §12.1 |
| Tampering | Forged/guessed session token | High-entropy random token, hashed at rest, checked against an exact DB match | TDS §12.1, DB Design §4.2 |
| Repudiation | User denies performing an action / disputes who checked something out | Every session-bound action is audit-logged with actor + session id + IP + timestamp, immutable | DB Design §4.17, §11 below |
| Information Disclosure | Timing or response differences reveal whether an email is registered | Identical response shape/timing target for `login` failure and `password-reset/request` regardless of account existence | API Contract §4 |
| Denial of Service | Login endpoint flooded to lock out legitimate users (lockout used as a DoS vector against a specific victim) | Lockout is time-boxed and paired with IP-based limiting so an attacker can't cheaply lock arbitrary accounts at scale; lockout messaging avoids confirming the *exact* remaining time in a way that aids timing attacks | API Contract §11 |
| Elevation of Privilege | Stolen/leaked session used after the legitimate user is deactivated | Session validity is checked against `users.is_active` on every request, not just at login — deactivation takes effect on the *next* request, not the next login | TDS §12 (session model), DB Design §4.2 |

### 3.2 Authorization Flow (every resource-addressed request)

| Threat | Scenario | Mitigation | Where specified |
|---|---|---|---|
| Elevation of Privilege | Viewer calls a contributor-only endpoint directly (bypassing the UI) | `RolesGuard` runs server-side on every non-public route, independent of frontend rendering | TDS §5.2 |
| Elevation of Privilege / Info Disclosure | IDOR — authenticated user requests a resource ID that exists but isn't theirs to see/act on (e.g., cancel someone else's reservation, download an attachment on an asset they have no access relationship to) | `PolicyGuard` resource-level check on every ID-addressed route, in addition to role check | TDS §5.2 |
| Tampering | Mass assignment — client sends `role`, `status`, `quantity_on_hand`, or `current_holder_user_id` in a body where those fields shouldn't be settable | Explicit allow-listed request DTOs, `forbidNonWhitelisted` rejection (400) of any field not on the list | ADR-009, TDS §5.3 |
| Elevation of Privilege | Self-role-change (admin promotes themselves further, or prevents their own demotion from being logged accurately) | `PATCH /users/:id/role` explicitly rejects `id == caller.id` | API Contract §5 |
| Elevation of Privilege | A sensitive action performed on a hijacked-but-still-valid session (session theft after initial login, before expiry) | Step-up re-authentication required within a short freshness window for the specific high-consequence action set | TDS §12.3 |

### 3.3 Inventory/Asset Write Flow

| Threat | Scenario | Mitigation | Where specified |
|---|---|---|---|
| Tampering | Two concurrent check-out requests for the same asset | Database-level partial unique index — the second request fails at the constraint, not just in application logic | DB Design §4.11 |
| Tampering | Quantity driven negative by a race between two concurrent `issue` transactions | `SELECT ... FOR UPDATE` row lock + `CHECK (quantity_on_hand >= 0)` constraint as backstop | TDS §8.2, DB Design §4.9 |
| Tampering | Direct manipulation of `inventory_transactions` or `audit_log` history to hide a discrepancy | Both tables: no `UPDATE`/`DELETE` grant for the runtime role, enforced at the Postgres grant level, not just application code | DB Design §7 |
| Repudiation | A quantity change or status change happens without a corresponding audit entry (e.g., a bug or a compromised process bypasses the audit call) | State change + audit insert occur in the same DB transaction — an audit-less state change is impossible by construction, not by convention | TDS §11.1, DB Design §5 |
| Tampering | Invalid state transition attempted (e.g., disposing an item that's currently issued) | Transition table enforced server-side; every transition is its own authorized, audited domain operation, no generic status-patch endpoint | TDS §4.1, API Contract §7.2–7.7 |

### 3.4 File Upload / Attachment Flow

| Threat | Scenario | Mitigation | Where specified |
|---|---|---|---|
| Tampering | Malicious file disguised via extension/Content-Type (e.g., an `.exe` renamed `.pdf`) | Signature (magic-byte) inspection server-side, never trusting filename or declared MIME type | ADR-006, DB Design §4.15 |
| Elevation of Privilege / Tampering | Uploaded file contains malware intended for a later downloader | Mandatory ClamAV scan before `status` can reach `available`; unscanned/failed files are never downloadable | ADR-006, TDS §10 |
| Information Disclosure | Direct/guessable object URL exposes a private attachment | Private bucket, no public read policy, UUID storage keys, all downloads proxied through an authorization + audit checkpoint | ADR-006 |
| Information Disclosure | Response differences between "doesn't exist," "quarantined," and "you can't see this" let an attacker infer scan results or existence | Identical `404` for all three cases | API Contract §9 |
| Denial of Service | Very large or many uploads exhaust storage/bandwidth | Server-enforced size limit (rejects before full upload accepted where feasible) + upload-tier rate limiting | API Contract §11 |

### 3.5 Data-at-Rest & Backup Flow

| Threat | Scenario | Mitigation | Where specified |
|---|---|---|---|
| Information Disclosure | Database or backup snapshot exfiltrated | TOTP secrets encrypted at application level (not just at-rest disk encryption, which a DB-level breach would bypass); password hashes are Argon2id, not reversible; backups themselves encrypted independent of the primary store's disk encryption | TDS §3.4, ADR-010 |
| Information Disclosure | Backup stored in the same location/credentials as primary data, so a single compromise takes both | Backups stored in a separate object-storage location/credential set from the primary MinIO bucket | ADR-010 |
| Availability | Backup exists but has never been tested and fails silently when actually needed | Restore drill executed and documented before production cutover, not assumed | ADR-010, Implementation Plan Phase 2 |

### 3.6 Admin & Configuration Flow

| Threat | Scenario | Mitigation | Where specified |
|---|---|---|---|
| Elevation of Privilege | Compromised admin session used to weaken org-wide security posture (disable 2FA requirement, raise reconciliation threshold to hide large adjustments) | Security-settings changes step-up gated and audited with before/after state | TDS §12.3, DB Design §4.18 |
| Repudiation | Admin denies making a configuration change | `security_settings.updated_by`/`updated_at` plus full audit_log entry for every change | DB Design §4.18 |

---

## 4. Security Controls Matrix (Summary View)

| Control | Threats mitigated | Verification method |
|---|---|---|
| Argon2id password hashing | Credential compromise via DB breach | Config review; hash format check in tests |
| TOTP 2FA + recovery codes | Credential-only compromise (phishing, reuse) | Enrollment/verify flow test; recovery-code single-use test |
| Progressive lockout + generic auth errors | Brute force, credential stuffing, user enumeration | Automated test: repeated failed logins trigger lockout; response bodies identical across valid/invalid email |
| Opaque, hashed, revocable sessions | Session theft, stale-access-after-deactivation | Test: deactivate user mid-session → next request rejected |
| Step-up re-authentication | Hijacked-session abuse of high-consequence actions | Test: sensitive action without fresh step-up → `403 STEP_UP_REQUIRED` |
| `RolesGuard` + `PolicyGuard` on every route | Broken access control, IDOR | Automated test suite: every endpoint attempted with each role, and with a valid-but-not-owned resource ID |
| Allow-listed DTOs, `forbidNonWhitelisted` | Mass assignment | Test: submit extra/forbidden fields (`role`, `status`, `quantity_on_hand`) → `400`, and confirm they had no effect |
| Parameterized queries only (Prisma) | SQL injection | Code review policy (no raw string-built SQL) + a targeted injection-payload test against a few representative endpoints |
| DB grant restrictions (`nest_app` vs `nest_migrator`, no UPDATE/DELETE on ledger/audit) | Insider or compromised-app-role tampering with history | Test: connect as `nest_app`, attempt `UPDATE`/`DELETE` on `audit_log`/`inventory_transactions` → must fail |
| File signature validation + AV scan + private storage + proxy download | Malicious upload, stored malware, unauthorized file access | Test: upload a file with a mismatched extension/signature → rejected; upload an EICAR test file → quarantined and never downloadable; attempt download without authorization → `404` |
| CSRF token on state-changing requests | Cross-site request forgery | Test: state-changing request without/with invalid CSRF token → rejected |
| Output encoding + CSP | Stored/reflected XSS | Test: submit script-tag payloads into free-text fields (condition notes, reasons, descriptions) → rendered inert on read; CSP header present and restrictive |
| Rate limiting (tiered) | Brute force, scraping, abuse | Load-style test exceeding each tier's threshold → `429` |
| TLS-only, HSTS, security headers via Caddy + backend | Network interception, clickjacking, MIME-sniffing | TLS configuration scan targeting an "A" grade; header presence test |
| Append-only audit log, transactional with state changes | Repudiation, tampering, incomplete audit trail | Test: force a mid-transaction failure → confirm neither the state change nor a partial audit row persists |
| Encrypted backups, tested restore | Data loss, backup exfiltration | Restore drill executed and documented pre-launch |
| Dependency/secret scanning in CI | Supply-chain compromise, leaked credentials | CI gate configured to fail the build on high-severity findings |

---

## 5. Authentication Design (Consolidated Reference)

Already fully specified in TDS §12 and DB Design §4.2–4.4; this section states the security *properties* those mechanisms are required to jointly guarantee, so a future change can be checked against the property rather than just the current implementation:

- A password is never recoverable from anything NEST stores (one-way hash only).
- A session, once revoked (logout, deactivation, password reset), cannot be used again — checked on every request, not cached client-side or trusted from an earlier check.
- 2FA, once enrolled, cannot be bypassed by any login path other than a valid recovery code, which is itself single-use and finite.
- Failed authentication attempts never reveal which factor (email existence, password, 2FA code) was wrong.
- A user cannot escalate their own privilege through any authenticated action available to their current role (self-role-change block, no client-settable `role` field anywhere).

---

## 6. Authorization Design (Consolidated Reference)

Already specified in TDS §5 and reflected endpoint-by-endpoint in the API Contract. The property guarantee:

- Every non-public request is authorized twice: once for "can this role ever do this" (RolesGuard) and once for "can this caller act on this specific resource" (PolicyGuard) — a role check alone is not sufficient anywhere a resource ID appears in the path.
- Authorization is evaluated **before** any handler logic runs and **before** any data is fetched for the purpose of deciding the response — NEST never fetches a restricted record and then decides whether to include it in the response (PRD §12's explicit prohibition).
- The frontend's role-filtered navigation (UI/UX Spec §6) is a UX convenience derived from the same capability matrix as the backend guards, never an independent source of truth, and never the enforcement mechanism itself.

---

## 7. Input Validation & Injection Defense

| Input class | Defense |
|---|---|
| All API request bodies | Explicit per-endpoint DTO schema, type + format validated, unknown fields rejected outright (§API Contract, ADR-009) |
| Database queries | Exclusively parameterized via Prisma; no string-concatenated SQL anywhere in the codebase (a code-review checklist item, §10) |
| Free-text fields rendered back to users (condition notes, reasons, descriptions, display names) | Output-encoded at render time by the frontend framework's default escaping (React) — never rendered via a raw-HTML injection path unless a specific, reviewed, justified exception exists (none identified for MVP) |
| File uploads | Signature validation, AV scan, private storage, proxy delivery (§3.4) |
| URL/query parameters (filters, pagination, sort) | Validated against an explicit allow-list of sortable/filterable fields and enum values — a client cannot pass an arbitrary column name or SQL fragment as a sort key |
| Search query text | Passed to Postgres full-text search via parameterized `tsquery` construction, never concatenated into a raw query string |

---

## 8. Cross-Site Scripting & Content Security Policy

- React's default JSX escaping is the primary XSS defense for all rendered user content; any future use of a raw-HTML-injection API is an explicit, reviewed exception, not a default tool.
- A Content-Security-Policy header (set at Caddy, reinforced at the backend as defense-in-depth) restricts script sources to the application's own origin, disallows inline scripts without a nonce, and disallows framing NEST from another origin (mitigates clickjacking, pairs with `X-Frame-Options: DENY`).
- File attachments are served with `Content-Disposition: attachment` (not `inline`) and a restrictive `Content-Type` derived from the *detected* (scanned) MIME type, not the client-declared one, so an uploaded HTML/SVG file cannot be rendered in-browser as an active document even if it passed the AV scan.

---

## 9. CSRF Defense

Session-cookie authentication (rather than a bearer token in a header) means CSRF is a live threat class for NEST, unlike a pure API-token architecture — addressed by:
- `SameSite=Strict` (or `Lax` only if a specific cross-site login-redirect flow requires it — default Strict, per ADR-005) as the first layer.
- A synchronizer CSRF token, delivered to the frontend and required in an `X-CSRF-Token` header on every state-changing request, as the second layer (defense-in-depth — cookie `SameSite` support varies enough across browser configurations/proxies that it is not relied on alone).
- CORS configured deny-by-default with an explicit single-origin allow-list (ADR-009), so a cross-origin script cannot make an authenticated request even before the CSRF token check is reached.

---

## 10. Secrets Management

| Secret | Storage | Access |
|---|---|---|
| Database credentials (`nest_app`, `nest_migrator`) | Environment variables injected at container start, sourced from CI/CD secret storage per environment | `nest_migrator` never present in the running backend's environment — CI-only |
| TOTP application-level encryption key | Environment variable, distinct per environment, never derived from a value also used elsewhere (e.g., not the session-signing key) | Backend + worker (if worker ever needs to touch TOTP data — currently it does not) |
| MinIO access credentials | Environment variable, scoped to the single NEST bucket only | Backend, worker |
| SMTP credentials | Environment variable | Worker (email job) |
| CSRF/session signing material | Environment variable, generated per environment, rotated on suspected compromise | Backend |

Rules (System Instructions §30, applied without exception): no secret is ever committed to source control, including in test fixtures, example `.env` files (which contain placeholder values only, clearly marked), or comments. `.env.example` in the repository documents *which* variables exist and their purpose, never real values. Secret rotation invalidates all sessions signed with the old material where applicable (session signing key rotation), documented as a deliberate, communicated operational event, not a silent one.

---

## 11. Audit Logging as a Security Control

Beyond its product role (history/traceability, per PRD §17), the audit log is itself a security control: it is the mechanism that turns "did anything unusual happen" from a question requiring forensic reconstruction into a directly queryable one. Security-relevant audit actions specifically include (non-exhaustive, closed vocabulary maintained per TDS §11.2): every login success/failure, lockout trigger, 2FA enroll/verify/failure, password reset request/completion, session revocation, every role change, every user deactivation/reactivation, every security-setting change, every hard delete, every attachment quarantine event, and every step-up verification and failure. These are the events an admin's dashboard "Security" widget (UI/UX Spec §5.5) surfaces proactively rather than requiring an admin to think to go looking for them.

**What is never logged:** passwords (hashed or plain), TOTP secrets or codes, session tokens, recovery codes, full file contents, or any field marked non-serializable in the API Contract §12 — the audit log's `before_state`/`after_state` snapshots are built from the same allow-listed projections as API responses, not raw database rows, so a sensitive field can't leak into audit history through a careless snapshot.

---

## 12. Rate Limiting & Abuse Prevention (Consolidated Reference)

Tier structure specified in API Contract §11. Security framing: the *strict* tier on auth endpoints is the primary defense against credential stuffing and account-specific brute force; the *upload* tier bounds storage/scanning-capacity abuse; the *search* tier bounds scraping of the catalog (a lower-severity but still real concern — the catalog itself is not public data, per PRD's authenticated-only model). All tiers apply per-account where the requester is authenticated and per-IP for public endpoints, so a distributed attempt against one account is still bounded, and a single IP hammering many accounts is also bounded.

---

## 13. Transport & Data-at-Rest Security

- **Transport:** TLS 1.2+ only (1.3 preferred), terminated at Caddy, automatic certificate management; internal service-to-service traffic (backend↔Postgres, backend↔MinIO, etc.) stays on the private Docker network and is not additionally TLS-wrapped in MVP — a documented, accepted trade-off given the internal network is not exposed and the hosting model is a single trusted host per environment (ADR-007), not a multi-tenant or multi-host cluster where internal traffic could be intercepted by a co-located untrusted party.
- **At rest:** disk-level encryption at the hosting provider level (standard, assumed available — an infrastructure prerequisite tracked in the deployment runbook, not re-specified here) plus **application-level encryption specifically for TOTP secrets**, which is the one field where disk encryption alone is an insufficient control against a database-level (not disk-level) compromise, per §3.5.
- **Backups:** encrypted independently, stored in a separate credential/location boundary from the primary data store (§3.5, ADR-010).

---

## 14. Dependency & Supply Chain Security

- Automated dependency vulnerability scanning runs as a CI gate (not just an informational report) — a build with a high/critical-severity known vulnerability in a direct dependency fails, per ADR-010's CI/CD pipeline shape.
- Lockfiles (`package-lock.json`/`pnpm-lock.yaml`) are committed and CI installs from the lockfile exactly (`--frozen-lockfile` equivalent), so a build is reproducible and a compromised upstream package version cannot silently substitute itself in.
- New direct dependencies are added deliberately (a PR-review expectation, §10 below) — not pulled in for a one-line convenience where the standard library or an existing dependency already covers the need, per System Instructions' general preference for minimal footprint.
- Secret-scanning (detecting accidentally committed credentials) runs as the same CI gate as dependency scanning, per ADR-010.

---

## 15. Logging & Monitoring (Security-Relevant, Beyond the Audit Log)

Distinct from the product-facing `audit_log` (§11), operational logs (structured JSON, per ADR-010) capture request-level detail for debugging and security monitoring:

- Every request logs: timestamp, method, path, status code, response time, a correlation ID, and the authenticated user id if present — **never** request/response bodies wholesale (which could contain passwords, tokens, or file content), and never headers containing credentials.
- Error-tracking (Sentry, per ADR-010) is configured with scrubbing rules for known-sensitive field names (password, token, secret, code) as defense-in-depth against a developer accidentally logging something sensitive in an exception context.
- Failed-login and lockout events feed the admin dashboard's Security widget (§11) as a near-real-time signal, not just a queryable historical log — an unusual spike is meant to be *noticed*, not just forensically available after the fact.

---

## 16. Incident Response (MVP-Scale Plan)

Given the team size (rotating student engineers) and organizational scale, this is deliberately a lightweight, documented procedure rather than a formal enterprise IR program — but it exists and is written down before launch, not improvised during an actual incident:

1. **Detection** — via Sentry alert, uptime monitor, admin-noticed dashboard anomaly, or a direct report.
2. **Triage** — an on-call/responsible admin assesses scope: is this a security incident (unauthorized access, data exposure) or an availability/bug issue? Security incidents escalate immediately to whoever holds ownership of the deployment (per the Implementation Plan's open item on hosting ownership/continuity).
3. **Containment** — for a suspected compromised account: deactivate immediately (revokes all sessions per §5). For a suspected compromised credential set (DB, MinIO, SMTP): rotate via the CI/CD secret store and redeploy; rotating invalidates sessions where applicable (§10).
4. **Investigation** — the audit log (§11) and operational logs (§15) are the primary forensic sources; `before_state`/`after_state` diffs let the team reconstruct exactly what changed.
5. **Recovery** — restore from a verified backup only if data integrity was actually compromised (not for every incident) — the tested restore procedure from ADR-010 is the mechanism, not an improvised one.
6. **Post-incident** — a short written summary (what happened, how it was found, what was done, what changes prevent recurrence) is added to `docs/operations/incident-response.md`, building institutional memory across a rotating team that would otherwise lose this knowledge every graduation cycle.

---

## 17. Security Acceptance Criteria (Launch-Blocking Test Plan)

This is the concrete, executable version of PRD §38 and System Instructions §46, and the thing Phase 2 of the Implementation Plan actually runs against before cutover. Each row must pass before production launch; a failure here blocks launch regardless of schedule (per ADR/Implementation Plan).

| # | Criterion | Test approach |
|---|---|---|
| 1 | Authentication cannot be bypassed | Attempt every protected endpoint with no session, an expired session, and a revoked session → all `401` |
| 2 | Authorization cannot be bypassed (role) | Attempt every role-restricted endpoint with each lower role → `403` |
| 3 | Authorization cannot be bypassed (IDOR) | Attempt resource-addressed endpoints with a valid ID the caller has no relationship to (e.g., another user's reservation, another user's session id) → `403`/`404` as specified per endpoint |
| 4 | Mass assignment is blocked | Submit forbidden fields (`role`, `status`, `quantity_on_hand`, `current_holder_user_id`) on every relevant write endpoint → `400`, field has no effect |
| 5 | SQL injection is not possible | Targeted payload tests against search/filter parameters and free-text fields → no query behavior change, no error leakage |
| 6 | Stored/reflected XSS is not possible | Script-tag and event-handler payloads in every free-text field → rendered inert on display |
| 7 | CSRF is blocked | State-changing request without a valid CSRF token → rejected |
| 8 | Insecure upload is not possible | Mismatched-signature file, oversized file, EICAR test file → rejected/quarantined per §3.4 |
| 9 | Broken access control (aggregate) | A full role × endpoint matrix run, not just spot checks — every cell's expected outcome (allow/deny) verified |
| 10 | Double check-out is impossible | Concurrent-request test against the same asset → exactly one succeeds |
| 11 | Quantity cannot go negative under concurrency | Concurrent-request test issuing more than available stock → total issued never exceeds on-hand |
| 12 | Audit log cannot be modified or deleted via any application path | Attempt via API with admin credentials, and directly as `nest_app` DB role → both fail |
| 13 | Deactivation takes effect immediately | Deactivate a user with an active session → their very next request is rejected, not just their next login |
| 14 | Password reset invalidates existing sessions | Complete a reset → prior session(s) for that user are rejected |
| 15 | Generic auth responses | Compare response body/timing for valid-email-wrong-password vs. nonexistent-email vs. locked-account → indistinguishable to the degree specified |
| 16 | TLS configuration meets target grade | External TLS scan reaches the ADR-specified grade |
| 17 | Security headers present and correct | CSP, HSTS, X-Content-Type-Options, X-Frame-Options (or frame-ancestors), Referrer-Policy verified on every response |
| 18 | Backup restore actually works | Full restore drill executed against a non-production environment, documented |
| 19 | Rate limiting engages at each tier | Exceed each tier's threshold → `429`, and confirm the limit resets appropriately |
| 20 | Dependency/secret scan gate is live | CI configured to fail on a deliberately introduced high-severity test vulnerability/fake secret, then reverted |

---

## 18. Secure Development Practices

- **PR checklist** (carried from the ADR, restated here as a security-specific subset): does this endpoint have an authz check (role + resource-level)? an allow-listed DTO? an audit event on every state-changing path? rate-limit tier assignment? Does any new free-text field get output-encoded on every surface it's rendered? Does any new file-accepting endpoint go through the same validation/scan pipeline as attachments, or is a new pipeline being introduced without review?
- **Least privilege by default** — a new database role, API credential, or service account starts with zero grants and is given only what its function demonstrably needs, not "safe defaults" that happen to be broad.
- **No security control is ever weakened to simplify implementation** without an explicit, documented, reviewed decision — the default posture in an ambiguous case is to keep the stricter behavior, per the System Instructions' general stance and consistent with several specific choices already made above (e.g., §12.1's session-hashing choice, which went beyond the PRD's literal minimum because it was cheap to do so).
- **Threat model is a living document** — this document's §3 is revisited whenever a new module, integration, or data flow is added (explicitly: any Phase 2 feature — barcode scanning, notifications, granular permissions, multi-warehouse — gets its own threat-model addition before it ships, not after).

---

## 19. Residual Risks & Open Items (Not Resolved Here)

| Item | Current posture | Why not fully resolved now |
|---|---|---|
| Internal service-to-service traffic is unencrypted (plaintext on the private Docker network) | Accepted for MVP, single-host deployment | Revisit if the deployment model ever moves to multiple hosts/a shared network where this boundary assumption no longer holds (flagged in ADR-010 as a topology decision, not a security oversight) |
| Exact rate-limit numeric thresholds | Tier structure fixed, numbers not | Needs real usage data to tune without either being uselessly loose or annoying legitimate bursts of normal use (e.g., a lab session where several people check items in/out in quick succession) |
| Self-service registration on/off | Undecided (TDS §17 open item) | Directly affects the threat surface of §3.1 (an open registration endpoint is itself an abuse vector — fake account creation — that a closed, admin-provisioned model avoids entirely); **recommend resolving before Phase 0 auth work begins**, as previously flagged |
| Restricted-category visibility | Schema seam exists, not enforced in MVP | Waiting on the team's confirmation of whether any MVP-launch data actually needs this, per PRD §42 |
| `large_reconciliation_threshold` value | Placeholder default | Needs a team-specific number reflecting what counts as an unusual adjustment for NEST's actual inventory scale |
| Formal penetration test | Not scoped in the Implementation Plan | The Phase 2 acceptance criteria (§17) are thorough for a launch of this scale, but are not a substitute for third-party testing if the org's risk tolerance or later scale (PRD §27's 300+ concurrent user growth path) warrants one — a decision to make at that point, not now |

---

*End of document.*
