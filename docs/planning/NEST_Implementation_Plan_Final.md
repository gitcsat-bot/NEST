# NEST — Implementation Plan (Final)

**Inputs:** NEST PRD v1.0, System Instructions, NEST ADR, NEST TDS, NEST Database Design, NEST API Contract, NEST UI/UX Specification, NEST Security Design (all approved)
**Status:** Final — supersedes Part 2 ("Implementation Plan") of the original ADR/Implementation Plan/Repository Structure document. That document's Part 1 (ADRs) and Part 3 (Repository Structure) remain authoritative and unchanged; this document replaces its Part 2 with the fully detailed, artifact-referenced version now that the TDS, Database Design, API Contract, UI/UX Spec, and Security Design exist to build against.
**Purpose:** This is the execution plan. Every task below references a concrete table (Database Design), endpoint (API Contract), screen (UI/UX Spec), or acceptance criterion (Security Design §17) — nothing here is scoped from memory of the PRD alone. No code is written from this document directly; it is the ordered task list implementation begins from.

---

## 1. How to Read This Plan

- **Phases are sequential; workstreams within a phase are not** — where two workstreams have no dependency between them, they run in parallel across contributors.
- **"Unit of work"** = backend + frontend + tests + docs for that slice, per System Instructions §42 and the Definition of Done in §11. A workstream is not "done" when the API works; it's done when the corresponding UI/UX Spec screen(s) are wired to it and both are tested together.
- **Every phase ends with an explicit, checkable exit gate**, not a date. If a phase's gate isn't met, the next phase does not start, regardless of calendar pressure (this mirrors the Security Design's launch-blocking stance, applied to every phase, not just the last one).
- Given the team is a rotating group of student engineers (PRD §2, ADR context), this plan is written so that **a contributor joining mid-project can pick up any single workstream row and know exactly what "done" looks like** without needing the full history of prior discussion — that's the point of the artifact references.

---

## 2. Pre-Phase-0 Decision Gate (Blocking — Must Close Before Work Starts)

These are the open items carried through every prior document. They are listed here **one final time, as a gate**, not a fifth repetition to skim past — Phase 0 cannot start cleanly until they're answered, because they change what gets built, not just how.

| # | Decision needed | Why it blocks Phase 0 specifically | Owner |
|---|---|---|---|
| 1 | Is `POST /auth/register` enabled (self-service signup) or is NEST admin-provisioned only? | Changes whether the endpoint exists at all (API Contract §2/§4), whether the Login screen needs a "Create account" link (UI/UX Spec §5.1), and the Security Design's §3.1/§19 threat surface (open registration is itself an abuse vector) | Product owner / faculty sponsor |
| 2 | Does any MVP-launch asset category need restricted visibility beyond standard RBAC? | If yes, `asset_definitions`/`asset_instances` need a `restricted` flag added to the Database Design **before** the first migration is written, not retrofitted after data exists | Product owner |
| 3 | Audit log retention/deletion policy specifics | Determines whether the retention-sweep job (TDS §14) ships in Phase 0/1 as an active deleter or stays a flag-only job through MVP | Product owner / institutional record-keeping policy |
| 4 | `large_reconciliation_threshold` starting value | A concrete number is needed to seed `security_settings` (Database Design §4.18) in the first migration | Stores manager / product owner, based on typical inventory scale |
| 5 | Hosting budget/ownership and continuity across inter-semester gaps | Determines the actual target for `docker-compose.staging.yml`/`.prod.yml` (ADR-010) — Phase 0's deployment pipeline workstream needs a real target, not a placeholder, to be genuinely exercised rather than theoretically written | Faculty sponsor / department IT |

**Action:** these five items go to the product owner/faculty sponsor as a single decision request before any engineer is assigned Phase 0 work. Items 1–4 have a recommended default stated in the prior documents (register: admin-provisioned; restricted visibility: no unless confirmed; retention: flag-only until policy set; threshold: a placeholder needing a real number) — if no answer arrives in a reasonable window, Phase 0 proceeds with those defaults **explicitly recorded** as an assumption in `docs/architecture/adr/` as a short follow-up ADR, not silently.

---

## 3. Phase 0 — Foundations

**Target:** 3–4 weeks. **Goal:** a secure, deployable skeleton with nothing product-specific, so every later feature is built on a correct base.

| Workstream | Concrete deliverables (artifact references) | Depends on |
|---|---|---|
| Repo & tooling | Repository structure exactly as specified in the ADR Part 3; `packages/shared-types` scaffolded empty; ESLint/Prettier/TS project references | Pre-Phase-0 gate closed |
| CI/CD skeleton | `.github/workflows/ci.yml` (lint → build → unit test) running green against an empty app; branch protection on `main` | Repo & tooling |
| Database foundation | First Prisma migration from Database Design §4.1–4.5, §4.17, §4.18 (`users`, `sessions`, `totp_credentials`, `password_reset_tokens`, `permissions`, `role_permissions`, `audit_log`, `security_settings`); `nest_app`/`nest_migrator` roles and grants exactly per Database Design §7, including the `REVOKE UPDATE, DELETE ON audit_log` statement | Pre-Phase-0 gate item 2, 3, 4 |
| Auth core | Implements API Contract §4 `POST /auth/login`, `/logout`; Argon2id hashing; session issuance per TDS §12.1–12.2; UI/UX Spec §5.1 Login screen | Database foundation |
| 2FA core | API Contract §4 `/auth/2fa/verify`, `/auth/2fa/enroll`; UI/UX Spec §5.2, §5.3 screens, including the acknowledgment-gated recovery-code display | Auth core |
| Password reset | API Contract §4 `/auth/password-reset/*`; UI/UX Spec §5.4; identical-response behavior verified against Security Acceptance Criterion #15 | Auth core |
| RBAC skeleton | `RolesGuard` implementing the capability matrix in TDS §5.1 / UI/UX Spec §6; applied to a placeholder protected route to prove the pattern before real endpoints exist | Auth core |
| Step-up auth | `StepUpGuard`, `sessions.step_up_verified_at`; API Contract `/auth/step-up`; applied to the same placeholder route | RBAC skeleton |
| Audit core | `AuditService`, closed action vocabulary seeded (TDS §11.2) with at minimum the auth-flow actions listed in Security Design §11; used by every Phase 0 auth endpoint as first consumer; Security Acceptance Criterion #12 (grant-level immutability) verified here, first, while the surface area is still small | Database foundation |
| Security baseline | Security headers, CORS allow-list, CSRF token issuance/validation, rate-limit tiers (strict tier applied to auth endpoints now — API Contract §11) | Auth core |
| Infra skeleton | `infra/docker/docker-compose.dev.yml` wiring Caddy + backend + Postgres + Redis + MinIO + ClamAV locally, per the Security Design §2 topology diagram | Repo & tooling |
| Environments & deployment pipeline | Dev/staging separation with distinct `.env` templates (no committed real secrets, per Security Design §10); staging deploy from CI on merge to `main`, manual-approval gate documented even though production isn't live yet | Infra skeleton, Pre-Phase-0 gate item 5 |

**Exit gate (all must pass, not just "mostly work"):**
- A user can register (if item 1 says self-service; otherwise: an admin can provision) as viewer, log in, enroll 2FA, reset a forgotten password, and every one of those actions produces a correct audit entry — end to end, in staging, over HTTPS, CI green.
- Security Acceptance Criteria #1 (auth bypass), #12 (audit immutability), and #15 (generic auth responses) from Security Design §17 pass as automated tests, not manual spot-checks — these three are pulled forward into Phase 0's own gate specifically because they're foundational to everything after, not because Phase 2 is being skipped.

---

## 4. Phase 1 — MVP Core

**Target:** 6–8 weeks. Built in the dependency order below; each numbered group is a completable unit (backend + frontend + tests + docs, per §1) before the next starts.

### 4.1 Locations
**Backend:** Database Design §4.6 `locations` table incl. `path_cache`/cycle-prevention trigger design (§6.1); API Contract §6 all endpoints.
**Frontend:** UI/UX Spec §5.16 Locations Manager (stores_manager+); read-only breadcrumb rendering used everywhere else from here on.
**DoD addition:** cycle-prevention trigger tested with an attempted re-parent-into-own-subtree case.

### 4.2 Catalog (Asset Definitions)
**Backend:** Database Design §4.7 (incl. generated `search_vector`); API Contract §7.1.
**Frontend:** typeahead-with-inline-create pattern (UI/UX Spec §5.9's catalog sub-form) — built here since Register Asset depends on it.

### 4.3 Individually Tracked Assets
**Backend:** Database Design §4.8; API Contract §7.2 (CRUD, history, archive, hard delete); TDS §4.1 state machine — **every transition its own endpoint**, no generic status-patch.
**Frontend:** UI/UX Spec §5.7 Asset Instance Detail (all tabs except Attachments/Relationships, added in 4.9/4.8b below) and §5.9 Register Asset.
**DoD addition:** every listed transition in TDS §4.1's table has an automated test for both the allowed and a representative disallowed case (Security Acceptance Criterion #9 groundwork, done incrementally rather than all at once in Phase 2).

### 4.4 Quantity Inventory (Items + Ledger)
**Backend:** Database Design §4.9–4.10 incl. `SELECT ... FOR UPDATE` write path (TDS §8.2); API Contract §7.9–7.10.
**Frontend:** UI/UX Spec §5.8 Inventory Item Detail, §5.10 Add/Adjust Stock.
**DoD addition:** Security Acceptance Criterion #11 (quantity cannot go negative under concurrency) implemented and tested here, at the point the mechanism is built, not deferred to Phase 2 — Phase 2 *re-verifies* it as part of the full suite, it doesn't originate it.

### 4.5 Check-Out / Check-In
**Backend:** Database Design §4.11 incl. the partial unique index; API Contract §7.3.
**Frontend:** UI/UX Spec §5.11, §5.12.
**DoD addition:** Security Acceptance Criterion #10 (double check-out impossible under concurrency) — same rationale as 4.4, built and tested at origin.

### 4.6 Transfers
**Backend:** Database Design §4.12; API Contract §7.4, §7.9 (`/inventory-items/:id/transfer`).
**Frontend:** UI/UX Spec §5.13.

### 4.7 Damage / Loss / Repair / Retirement / Disposal
**Backend:** API Contract §7.5–§7.7; step-up gating on `dispose` above threshold (needs Pre-Phase-0 item 4 resolved).
**Frontend:** UI/UX Spec §5.7.1 context-sensitive actions, §5.14.

### 4.8 Asset Relationships
**Backend:** Database Design §4.14 incl. DAG-validity service check; API Contract §7.8.
**Frontend:** UI/UX Spec §5.7 Relationships tab.

### 4.9 Attachments
**Backend:** Database Design §4.15; full pipeline per Security Design §3.4/§8; API Contract §9.
**Frontend:** UI/UX Spec §5.7 Attachments tab.
**DoD addition:** Security Acceptance Criterion #8 (insecure upload) built and tested at origin — mismatched-signature file, oversized file, and an EICAR test file, all three cases, not just the happy path.

### 4.10 Search
**Backend:** TDS §9 full-text + structured filters, permission-scoped in-query (Security Design §7's URL/query validation applies here directly — sortable fields are allow-listed).
**Frontend:** UI/UX Spec §5.6, incl. URL-reflected filter state.

### 4.11 Dashboard
**Backend:** API Contract §10 `/dashboard`, role-varied payload shape.
**Frontend:** UI/UX Spec §5.5, incl. the admin-only Security widget fed by the audit actions catalogued in Security Design §11.

### 4.12 Reservations
**Backend:** Database Design §4.13; API Contract §8; worker auto-expiry job.
**Frontend:** UI/UX Spec §5.15 My Checkouts & Reservations.

**Phase 1 exit gate** (mirrors System Instructions §47 Product Acceptance Gate, now stated against actual built screens/endpoints rather than abstractly):
- A new viewer can find an asset and its location in under the search performance target using the Search Results screen (§5.6).
- A contributor can register an asset (§5.9) and receive stock (§5.10) without needing help.
- Every inventory-changing action in §4.3–§4.9 produces a correct, complete audit record — spot-checked against the Audit Log screen (§5.19), not just the database.
- Security Acceptance Criteria #10 and #11 pass under an actual concurrent-load test script, not just unit-level mocking.
- Deactivating a user (§5.18) immediately revokes their sessions — re-verified here against the real Users Management screen, having been built in Phase 0 against a placeholder.
- Dashboard counts (§5.5) match the underlying ledger exactly, cross-checked with the reconciliation query (Database Design §6.2).
- Search results respect role/visibility rules under an automated test that logs in as each role and confirms result-set differences match expectations.
- Attachment download (§9 of API Contract) is unreachable without authorization — an IDOR test specifically against this endpoint, not just the general suite.

---

## 5. Phase 2 — Security Hardening & Launch Prep

**Target:** 2–3 weeks. **This phase is launch-blocking** — a failure here blocks production deployment regardless of schedule (Security Design §17, ADR).

| Workstream | Deliverable |
|---|---|
| Full Security Acceptance Criteria run | All 20 criteria in Security Design §17 executed as automated (where feasible) or documented manual tests, including the ones built-and-verified incrementally in Phase 1 (re-run as part of the *complete* suite, since a full-system pass can surface interactions a per-feature test wouldn't) |
| Reports | FR-RPT-01–04 / API Contract §10 Reports endpoints + UI/UX Spec §5.17, if not already pulled forward — admin-only, non-blocking for other Phase 1 workstreams, so it's safe to land here without having held anything else up |
| Accessibility pass | Automated scan (axe or equivalent) + manual keyboard-only and screen-reader walkthrough of the core flows named in UI/UX Spec §11, against the WCAG AA requirements stated there |
| Performance validation | Search <500ms, dashboard load, <2s typical page load (PRD §27) under synthetic load at 50–100 concurrent simulated users |
| TLS / headers verification | External TLS grade scan; header presence check (Security Acceptance Criteria #16, #17) |
| Backup/restore drill | Executed end-to-end at least once against a non-production environment, runbook written from the drill itself (Criterion #18) |
| Dependency/secret scanning as a real gate | Confirmed to actually fail a build on a deliberately introduced test case, then reverted (Criterion #20) |
| Rate limiting verification | Each tier's threshold actually engages under load (Criterion #19) — this is also where the Pre-Phase-0-deferred numeric tuning (Security Design §19) gets its first real-data-informed pass |
| Production cutover | Environment separation double-checked, DNS/TLS live, monitoring/alerting (Sentry, uptime) confirmed receiving real signals, rollback plan documented |

**Phase 2 exit gate:** all 20 Security Acceptance Criteria pass; the Product Acceptance Gate from Phase 1 still passes against the production-configured environment (not just staging); the accessibility and performance passes are clean; the backup restore drill is documented as successfully completed.

---

## 6. Phase 3+ — Post-Launch (Explicitly Out of Scope Here)

Not designed or built now: projects/procurement as a full workflow, granular category-level permissions (beyond the seam already in `permissions`/`role_permissions`), notifications, barcode/QR scanning, calibration tracking, an auditor role, tamper-evident audit export, multi-warehouse features, bulk multi-select actions, dashboard personalization. Each, when scheduled, gets its own short design addendum (a new TDS section + Security Design §3 threat-model addition, per Security Design §18) before implementation — this plan is not the place those additions get improvised into the MVP scope.

---

## 7. Cross-Phase Workstreams

These run continuously across all phases, not as a discrete step:

| Workstream | Ongoing responsibility |
|---|---|
| Testing | Unit tests land with the code that needs them (not batched at phase end); integration tests per module; the security-specific tests called out in Phase 1/2 above are the acceptance layer on top of, not instead of, ordinary test coverage |
| Documentation | `docs/` tree (per ADR Part 3) kept current as each workstream lands — an endpoint that exists but isn't reflected in `docs/api/openapi.yaml`, or a decision made that isn't recorded in `docs/architecture/adr/`, is treated as incomplete work, not a follow-up task |
| Code review | Every PR checked against the security-specific checklist in Security Design §18 in addition to ordinary code quality |
| Audit vocabulary maintenance | As each new domain operation ships, its action string is added to the closed vocabulary (TDS §11.2) in the same PR — never introduced as a free-form string and cleaned up later |

---

## 8. Milestone Summary

| Milestone | Marks |
|---|---|
| M0 — Pre-Phase-0 gate closed | Product owner has answered all 5 items in §2 (or explicit assumption-ADRs are recorded) |
| M1 — Phase 0 exit | Auth/2FA/reset/audit skeleton live in staging, CI green, Criteria #1/#12/#15 passing |
| M2 — Phase 1 core complete | All twelve Phase 1 workstreams (§4.1–4.12) individually meet their DoD |
| M3 — Phase 1 exit | Full Product Acceptance Gate (§4, end) passes |
| M4 — Phase 2 exit / Launch readiness | All 20 Security Acceptance Criteria pass; accessibility, performance, backup drill clean |
| M5 — Production cutover | Live, monitored, rollback plan on file |

No calendar dates are fixed here beyond the rough per-phase week ranges already stated in §3–§5 — a rotating student team's actual velocity should set real dates once Phase 0 is underway and the team's throughput is observable, rather than this document guessing it upfront.

---

## 9. Risk Register

| Risk | Likelihood context | Mitigation already designed in | Residual owner action |
|---|---|---|---|
| Pre-Phase-0 decisions stall waiting on the product owner | Moderate — academic-calendar stakeholders can be slow to respond | Explicit default + assumption-ADR fallback (§2) | Set a concrete response deadline when the request goes out |
| Team turnover mid-phase (semester boundary) | High, structurally, for this team | Repository structure + this plan's artifact-referencing design specifically so a new contributor can resume a workstream from its DoD row alone | Maintain `docs/development/local-setup.md` and this plan as the two documents a new contributor reads first |
| Concurrency bugs (double-issue, negative stock) slip through Phase 1 despite the DB-level guarantees | Low — the guarantees are DB-enforced, not just application logic, per Database Design §5 | Partial unique index, `FOR UPDATE` + check constraint | Still run the explicit concurrent-load tests (§4.4/§4.5 DoD) — a DB constraint stops the invalid state, but the *test* is what confirms the application surfaces the resulting conflict as a clean, understandable error rather than an ugly failure |
| Hosting continuity across semester gaps (Pre-Phase-0 item 5) | Real, structural | Docker Compose reproducibility (ADR-010) means redeploying after a gap is mechanical, not a rebuild | Ensure whoever owns hosting continuity has access to the CI/CD secrets store, not just one graduating student |
| Scope creep — a Phase 3+ item gets pulled into MVP under pressure | Moderate, common on any project | Explicit Phase 3+ exclusion list (§6) with the "own design addendum required" rule | Any such request gets redirected to "add a TDS/Security Design addendum first," not built ad hoc |

---

## 10. Ownership Model (Suggested, for a Small Rotating Team)

Given the team composition assumed by the PRD/ADR, a lightweight ownership split is enough — this is a recommendation, not a rigid RACI:

- **One rotating "tech lead" role** per semester/term, responsible for the Pre-Phase-0 gate, phase exit-gate sign-off, and keeping this plan's milestone table current — the one artifact a new tech lead reads on day one to understand exactly where the project stands.
- **Feature workstreams (§4.1–4.12)** assigned to whoever's available, each pulling its own backend+frontend+tests as one unit rather than splitting backend/frontend across different people for the same workstream, to keep the "unit of work" principle in §1 real rather than aspirational.
- **Security Design §17's criteria** are owned collectively at Phase 2, ideally by whoever didn't build the feature being tested (a basic peer-review-of-security principle), since a builder is the person least likely to find their own oversight.

---

## 11. Definition of Done (Restated, Authoritative)

A workstream is done when, and only when, all of the following are true — this is the same bar stated in the ADR and Security Design, collected here once as the single checklist every PR is measured against:

1. Backend implemented per the Database Design and API Contract for that resource, exactly (no undocumented field, endpoint, or behavior).
2. Frontend implemented per the UI/UX Specification for the corresponding screen(s), including its specified empty/loading/error states.
3. Every state-changing endpoint has a role check, a resource-level check where addressed by ID, an allow-listed request DTO, and an audit event written in the same transaction as the state change.
4. Automated tests cover the happy path, the documented error codes, and any concurrency/race condition explicitly called out for that workstream.
5. Any new free-text or file-accepting field goes through the existing output-encoding/upload-validation pipeline — never a new, unreviewed path.
6. Documentation (`docs/api/openapi.yaml`, and `docs/architecture/adr/` if a new decision was made) is updated in the same PR, not a follow-up.
7. The workstream's specific DoD addition (where one is called out in §4 above) passes.

---

*End of document.*
