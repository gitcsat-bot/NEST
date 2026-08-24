# Product Requirements Document

# NEST — Networked Equipment & Stock Tracker
**COEP Satellite Initiative — Internal Virtual Warehouse & Physical Asset Management System**

Document version: 1.0
Status: Draft for architecture & implementation kickoff
Owner: Product / Engineering — COEP Satellite Initiative

---

## 1. Executive Summary

NEST is a purpose-built, internally hosted web application that gives the COEP Satellite Initiative a single, authoritative digital record of every physical asset it owns or holds — from RF connectors and ICs to oscilloscopes and flight-candidate PCB assemblies. It replaces spreadsheets, group-chat messages, and institutional memory with a searchable, auditable, role-gated system of record.

NEST is treated as a production system, not a student project artifact: it will hold sensitive information (who has what equipment, procurement costs, storage locations, project associations) and will be reachable from the public internet on a dedicated domain. Accordingly, this PRD treats security, auditability, and operational reliability as first-class product requirements, not add-ons.

The MVP focuses on: authenticated inventory CRUD with RBAC, a flexible location hierarchy, individually-tracked vs. quantity-based assets, check-out/check-in and transfer workflows, full audit logging, attachment handling, and a dashboard giving the team situational awareness of the warehouse. Later phases add granular permissions, project-based procurement tracking, advanced reporting, and integrations.

---

## 2. Product Vision

Every physical item the Initiative owns — no matter how small (a resistor) or how critical (a flight PCB) — should have a single, trustworthy digital identity: what it is, where it is, who is responsible for it, and what has happened to it. Any team member should be able to answer "do we have this, and where is it?" in seconds, and any lead should be able to answer "who last touched this, and when?" without asking around.

NEST should feel closer to a well-designed internal tool than an enterprise ERP: fast, minimal, opinionated about the workflows that actually matter to a student satellite team, and honest about what it doesn't try to do.

---

## 3. Problem Statement

Today, asset knowledge is fragmented across spreadsheets, WhatsApp/Slack messages, physical labels, and individual memory. This causes:

- Duplicate procurement (buying parts the team already has, because nobody could confirm stock).
- Lost or misplaced equipment, especially test instruments and small high-value components.
- No accountability trail when equipment is damaged, lost, or goes missing during handoffs between members/generations of students.
- No way to answer "which components are on subsystem X" or "what did we buy for project Y."
- Spreadsheets have no access control, no audit trail, and are trivially corrupted (accidental edits, deleted rows) with no recovery path.
- Knowledge loss during team turnover (student teams graduate; tribal knowledge leaves with them).

NEST solves this by making inventory tracking a first-class, low-friction, secure workflow instead of an afterthought.

---

## 4. Goals

- Provide one authoritative source of truth for all physical assets.
- Make recording an action (receive, store, issue, move, return, retire) faster than *not* recording it.
- Give administrators and leads full traceability: who did what, when, from where.
- Support both serialized/individually-tracked assets and bulk quantity-based inventory in the same system.
- Be secure enough to safely expose on the public internet without a VPN.
- Be simple enough that a new second-year student can use it correctly within five minutes, unguided.
- Be maintainable by a rotating student engineering team (i.e., not overly clever, well documented, boring technology where possible).

## 5. Non-Goals

NEST explicitly does **not** attempt to be, at least in MVP/Phase 1–2:

- A full ERP, accounting, or financial reconciliation system.
- A procurement approval / purchase-order workflow engine (it records procurement facts, it does not manage vendor negotiation or approval chains).
- A project management / task tracking tool (Jira/Trello replacement).
- A PLM (Product Lifecycle Management) or full electronic design/BOM management system, though it should interoperate loosely with BOM concepts (see §11).
- A barcode/RFID physical scanning platform in MVP (explicitly deferred to Phase 2/3, see §35–36).
- A multi-tenant SaaS product — NEST is single-organization, self-hosted for the COEP Satellite Initiative.

---

## 6. Target Users

| User type | Description | Typical needs |
|---|---|---|
| Regular Member | Subsystem team member (mechanical, electrical, RF, software, etc.) | Search inventory, check availability, check out/in parts, view what they're responsible for |
| Subsystem Lead / Authorized Contributor | Trusted member with edit rights | Register new assets, correct records, manage transfers, resolve discrepancies |
| Inventory/Stores Manager | Person(s) responsible for physical stores | Full inventory CRUD, location management, reconciliation, receiving procurement |
| Administrator | Faculty advisor, team captain, or senior lead | User management, role assignment, security settings, full audit visibility, system configuration |
| Auditor/Reviewer (Phase 2) | Faculty/alumni reviewing team operations | Read-only access to inventory + audit trail |

---

## 7. User Roles and Permissions

RBAC is mandatory for MVP; a more granular, permission-based (rather than fixed-role) model is a defined extension path (see §32).

### 7.1 MVP Roles

| Role | Description | Key capabilities |
|---|---|---|
| `viewer` | Default authenticated member | Read inventory per visibility rules; view own assignments/checkouts |
| `contributor` | Authorized member (subsystem lead or delegate) | Everything `viewer` can, plus: create/edit assets, check-out/check-in, transfer, upload attachments, create reservations |
| `stores_manager` | Physical stores owner(s) | Everything `contributor` can, plus: manage locations, adjust quantities, mark damaged/lost, retire/dispose assets, reconcile stock |
| `admin` | Team leadership / faculty advisor | Everything above, plus: user management, role assignment, security configuration, full audit log access, system settings |

### 7.2 Permission Principles

- **Least privilege by default**: new accounts start as `viewer`; elevation is explicit and logged.
- **Destructive and administrative actions require step-up verification** (see §14.6) — e.g., permanent deletion, role changes, user deactivation.
- **Read access can be scoped** (Phase 2) — e.g., a sensitive/high-value asset category (flight hardware, security-relevant items) may be restricted to specific roles or project members, while the general catalog remains open to all authenticated members.
- Anonymous/unauthenticated access is **not** supported — NEST is an internal system; all routes require authentication except login, password reset, and health check endpoints.

### 7.3 Extensibility to Granular Permissions (Phase 2+)

Roles are implemented as a thin layer over an underlying **permission** system (`permissions` table + `role_permissions` mapping), so that Phase 2 can introduce fine-grained, resource-scoped permissions (e.g., "edit assets in category RF only," "approve transfers for Project X") without a schema rewrite. See §21 data model and §32.

---

## 8. Core User Stories

| # | As a... | I want to... | So that... |
|---|---|---|---|
| U1 | Member | search for a part by name or part number | I know if we already have it before buying a new one |
| U2 | Member | see where a specific component is physically stored | I can go get it without asking around |
| U3 | Member | check out a test instrument | there's a record of who has it |
| U4 | Contributor | register a newly procured batch of resistors | the stock count is accurate |
| U5 | Contributor | transfer a PCB assembly from the lab to the integration room | the location stays correct |
| U6 | Stores manager | mark an oscilloscope as "under repair" | others don't try to check it out |
| U7 | Stores manager | see all assets flagged low-stock | we can plan procurement |
| U8 | Admin | see who deleted or modified a record and when | we can investigate discrepancies |
| U9 | Admin | enable 2FA requirement for all contributors+ | account takeover risk is reduced |
| U10 | Member | view the history of an asset (who used it, where it's been) | I can trust the system's record |
| U11 | Contributor | attach a datasheet and photo to a new IC entry | others can identify/use the part correctly |
| U12 | Lead | see which components were procured for Project "CanSat-25" | I can report project spend/usage |
| U13 | Admin | revoke a departed member's access immediately | there's no lingering account risk |
| U14 | Member | see a clear error when I try to check out something already issued | I don't create conflicting records |

---

## 9. Functional Requirements

Format: **ID | Description | Priority | Role(s) | Expected Behavior | Acceptance Criteria | Security Considerations**

### 9.1 Authentication & Account Management

| ID | Description | Priority | Role | Expected Behavior | Acceptance Criteria | Security Considerations |
|---|---|---|---|---|---|---|
| FR-AUTH-01 | Email + password login | P0 | All | User authenticates with email/username + password | Valid credentials issue a session; invalid credentials show generic error | Passwords hashed with Argon2id; generic "invalid credentials" message (no user enumeration) |
| FR-AUTH-02 | TOTP-based 2FA | P0 | All (mandatory for contributor+) | User enrolls an authenticator app; prompted for code at login | Login fails without valid TOTP once enrolled; recovery codes issued at enrollment | Secrets encrypted at rest; rate-limited code attempts |
| FR-AUTH-03 | Password reset via email token | P0 | All | User requests reset; receives time-limited single-use link | Link expires in ≤30 min, single use, invalidates existing sessions on completion | Token is high-entropy, hashed at rest, no user enumeration on request |
| FR-AUTH-04 | Account lockout / progressive throttling | P0 | All | Repeated failed logins slow/lock the account temporarily | After N failed attempts, exponential backoff; account not permanently locked without admin path | Mitigates brute force & credential stuffing (see §16) |
| FR-AUTH-05 | Session management (list/revoke active sessions) | P1 | All | User can view and revoke their own active sessions | Revoking a session invalidates it server-side within seconds | Prevents persistence after device loss/theft |
| FR-AUTH-06 | Admin-forced logout / account deactivation | P0 | Admin | Admin can deactivate a user, immediately killing all sessions | Deactivated user cannot authenticate or use existing session | Critical for offboarding graduating/departing members |
| FR-AUTH-07 | Step-up re-authentication for sensitive actions | P1 | Contributor+ | Role change, permanent delete, security setting change require re-entering password/2FA | Action blocked without fresh verification (≤5 min) | Reduces impact of hijacked idle sessions |

### 9.2 Inventory & Asset Management

| ID | Description | Priority | Role | Expected Behavior | Acceptance Criteria | Security Considerations |
|---|---|---|---|---|---|---|
| FR-INV-01 | Create asset record (individually tracked) | P0 | Contributor+ | Form to register a serialized asset with full metadata | Record created with generated Asset ID, audit entry written | Server-side validation, ownership fields not client-settable |
| FR-INV-02 | Create quantity-based inventory record | P0 | Contributor+ | Register a bulk item with quantity + unit | Quantity adjustable via explicit transactions, not raw overwrite | Quantity changes recorded as transactions (append-only ledger), not silent edits |
| FR-INV-03 | Edit asset metadata | P0 | Contributor+ | Update fields on an existing record | Diff captured in audit log (before/after) | Mass-assignment protection: explicit allow-list of editable fields per role |
| FR-INV-04 | View asset detail page | P0 | Viewer+ | Full metadata, current status, location, history timeline | Page loads in <1s for typical record | IDOR protection: authorization check on every fetch, not just UI hiding |
| FR-INV-05 | Soft delete / archive asset | P0 | Stores mgr/Admin | Archive removes from active views, retains full record | Archived items excluded from default search, recoverable by admin | No hard delete from UI in MVP; hard delete restricted to admin w/ step-up + reason field |
| FR-INV-06 | Check-out asset | P0 | Contributor+ | Assign asset to a member, status → "issued" | Cannot check out an already-issued serialized asset (race-safe) | DB-level unique/constraint or transaction lock to prevent double-issue |
| FR-INV-07 | Check-in asset | P0 | Contributor+ | Return asset, status → "available" (or condition-flagged) | Prompts for condition on return | Records who checked in, discrepancy flagged if condition changed |
| FR-INV-08 | Transfer asset between locations | P0 | Contributor+ | Update current location, log transfer event | Location history append-only | — |
| FR-INV-09 | Assign asset to project | P1 | Contributor+ | Link asset/quantity consumption to a project | Reporting can filter by project | — |
| FR-INV-10 | Reserve asset/quantity | P1 | Contributor+ | Mark asset reserved for future use, optional expiry | Reserved items shown as unavailable but distinct from issued | Prevent reservation hoarding — reservations auto-expire (configurable) |
| FR-INV-11 | Report damage/loss | P0 | Contributor+ | Flag asset condition, optional free-text note | Status visible on dashboard "requires attention" | — |
| FR-INV-12 | Repair workflow | P1 | Stores mgr+ | Status → "under repair", optional vendor/cost note | Cannot be checked out while under repair | — |
| FR-INV-13 | Retirement / disposal | P1 | Stores mgr/Admin | Final status change with reason + date | Retired assets excluded from availability, retained in history | Requires confirmation dialog (destructive-adjacent) |
| FR-INV-14 | Asset relationships (parent/child, e.g., PCB → components) | P1 | Contributor+ | Link assets as components of an assembly | Viewing a PCB assembly lists linked components | — |
| FR-INV-15 | Bulk quantity adjustment (stock take/reconciliation) | P1 | Stores mgr+ | Adjust counted quantity with reason code | Adjustment logged as a distinct transaction type ("reconciliation") | Requires reason; large deltas flagged for review |

### 9.3 Search & Dashboard

See §12 and §13 for detailed requirements; functional entries summarized:

| ID | Description | Priority | Role | Notes |
|---|---|---|---|---|
| FR-SEARCH-01 | Full-text + field search across assets | P0 | Viewer+ | Indexed on name, ID, part number, manufacturer, serial, category, location, project, status |
| FR-SEARCH-02 | Filter/sort by status, category, location, project | P0 | Viewer+ | Combinable filters, URL-shareable filter state |
| FR-DASH-01 | Overview dashboard | P0 | Viewer+ (content scoped by role) | See §13 |

### 9.4 Reporting & Exports

| ID | Description | Priority | Role | Expected Behavior | Acceptance Criteria | Security Considerations |
|---|---|---|---|---|---|---|
| FR-RPT-01 | Monthly inventory report generation | P1 | Admin | Admin can generate a point-in-time snapshot report of the warehouse (total assets, quantities, issued/reserved/damaged breakdown, recent activity for the period) for a selected month | Report reflects data as of generation time; historical months can be regenerated on demand from audit/transaction history, not just the current state | Report generation restricted to `admin` role only (contains org-wide sensitive data); generation itself is audit-logged |
| FR-RPT-02 | Download report as .xlsx | P1 | Admin | Report available as a cleanly formatted Excel workbook (labeled headers, frozen header row, appropriate column widths/number formats, no raw dump of internal DB fields) | File opens correctly in Excel/Sheets with readable formatting, not just raw CSV-in-xlsx | Generated server-side; no user-supplied formulas/macros in output (avoids formula-injection risk if any cell content originates from free-text fields like notes) |
| FR-RPT-03 | Download report as .pdf | P1 | Admin | Same report content rendered as a paginated, print-ready PDF (cover summary + tables, consistent branding/header) | Renders correctly across standard PDF viewers; multi-page tables paginate cleanly with repeated headers | Generated server-side from the same data source as the .xlsx (single source of truth, no drift between formats) |
| FR-RPT-04 | Report access control & delivery | P0 | Admin | Reports are generated/downloaded through an authenticated, admin-gated endpoint | Non-admin roles cannot access the report generation/download endpoints, including by direct URL (IDOR check) | Files served via short-lived signed URL or authenticated download stream — never written to a publicly accessible path; download event recorded in audit log (§17) |

**Report contents (recommended default):** total assets & total quantity, assets currently issued, low-stock items, damaged/lost/under-repair assets, current reservations, new registrations in the period, transfers in the period, and administrative/security summary (login failures, role changes) — mirroring the dashboard's data (§13) but as a durable, shareable snapshot.

**Generation model:** Reports are computed on demand from live data (not pre-materialized), given the team's scale (§27 performance targets comfortably support this). A background job (§23 worker) is recommended if generation time exceeds a couple of seconds, to avoid blocking the request thread — the job emails/notifies the admin with a download link once ready (P2 refinement of FR-RPT-01).

### 9.5 Attachments

| ID | Description | Priority | Role | Expected Behavior | Acceptance Criteria | Security Considerations |
|---|---|---|---|---|---|---|
| FR-FILE-01 | Upload attachment to asset (datasheet, photo, invoice, manual, certificate) | P0 | Contributor+ | File associated with asset record | Type/size validated client + server | See §18 for full secure upload requirements |
| FR-FILE-02 | Delete attachment | P1 | Contributor+/owner | Soft-delete with audit entry | — | Only uploader or stores mgr/admin can delete |
| FR-FILE-03 | View/download attachment | P0 | Viewer+ | Served via signed, time-limited URL | No direct public bucket access | Prevents hotlinking/leakage of internal docs |

---

## 10. Inventory Lifecycle

NEST models inventory state as an explicit lifecycle with defined transitions, implemented as an enumerated `status` field plus an append-only `transactions`/`events` log (never overwritten history).

**States (serialized assets):**
`registered → available → reserved → issued → available` (loop) ; branches: `available/issued → damaged → under_repair → available|retired`; `available → lost`; `available|damaged|lost → retired → disposed`.

**States (quantity inventory):**
Quantity itself isn't a "status" — instead, the record has a running `quantity_on_hand`, and every change (receive, issue/consume, return, adjust, dispose) is a signed transaction row. Status flags like `low_stock` are derived (quantity ≤ reorder threshold), not manually set.

**Lifecycle stages covered:** procurement receipt → registration → storage → check-out → check-in → transfer → assignment (member/project) → reservation → consumption (quantity items) → repair → loss/damage reporting → retirement → disposal → archival.

**Rule:** Only `stores_manager`/`admin` can perform retirement, disposal, and hard reconciliation adjustments. `contributor` can perform day-to-day check-out/in/transfer/damage-report.

---

## 11. Asset and Location Model

### 11.1 Individually Tracked vs. Quantity-Based

NEST distinguishes two asset kinds at the schema level, sharing a common base:

- **Serialized/Individual Asset** (`asset_instance`): one row = one physical unit. Has serial number (if applicable), individual status, individual location, individual history. Example: a specific Rigol oscilloscope, a specific flight PCB assembly.
- **Quantity Inventory** (`inventory_item`): one row = a stock line at a location, with `quantity_on_hand`, `unit`, reorder threshold. Example: "10kΩ 0805 resistor, Qty 480, Box R-14." Movements are transactions (receive/issue/adjust/transfer), not new rows per unit.

Both share a common `asset_definition`/`catalog` concept (name, category, manufacturer, part number, datasheet link, description) so a "10kΩ resistor" catalog entry can have multiple `inventory_item` stock rows across locations, while a specific "Oscilloscope #3" is one `asset_instance` tied to one catalog/model entry.

### 11.2 Recommended Location Hierarchy

A strict 6-level fixed hierarchy (Warehouse → Room → Rack → Shelf → Box → Position) is often more rigidity than a small student team needs everywhere, but is exactly right for small-parts storage. NEST recommends a **flexible, self-referencing location tree** rather than fixed levels:

```
locations (
  id, name, type (warehouse|room|cabinet|rack|shelf|bin|box|position|other),
  parent_location_id (nullable, self-FK), 
  description, is_active
)
```

This lets teams model `Warehouse → Room → Rack → Shelf → Box → Position` where useful (e.g., passive components), but also shorter paths like `Lab Room → Bench` for a test instrument, without schema changes. Any asset/inventory row references a single current `location_id`; the tree can be walked to render a breadcrumb ("Warehouse A / Electronics Room / Rack 3 / Shelf B / Box 12").

### 11.3 Asset Relationships

A generic `asset_relationships` table (`parent_asset_id`, `child_asset_id`, `relationship_type`) supports hierarchies like `Satellite Subsystem → PCB → Assembly → Component` without hardcoding a fixed BOM depth. `relationship_type` values: `contains`, `mounted_on`, `subsystem_of`, `spare_for`, etc. This is intentionally generic (a graph, constrained to a DAG by validation) rather than a rigid tree, since real hardware relationships aren't always strictly hierarchical (e.g., a spare component belongs to a category but isn't "in" anything until installed).

### 11.4 Worked Examples

| Example | Model |
|---|---|
| RF component (e.g., LNA module) | `asset_instance`, category `RF`, serial number if present, linked via `asset_relationships` (`mounted_on`) to a PCB assembly once integrated |
| PCB assembly (flight candidate) | `asset_instance`, category `PCB Assembly`, children = individual ICs/passives via `contains`/`mounted_on`, parent = subsystem via `subsystem_of` |
| Test instrument (oscilloscope) | `asset_instance`, category `Instrument`, serial number mandatory, check-out/in workflow enabled, calibration due date as custom metadata (Phase 2) |
| Box of 100 resistors | `inventory_item`, quantity 100, unit "pcs", location = `Box R-14`, reorder threshold configurable |

---

## 12. Search and Filtering Requirements

| Requirement | Detail |
|---|---|
| Searchable fields | Asset name, Asset ID, part number, manufacturer, serial number, category, location (path), current user/holder, project, status |
| Search type | Combined full-text (name/description) + structured filters (status, category, location subtree, project, date ranges) |
| Performance | P0: results in <500ms for catalogs up to ~50,000 rows using DB indexes; full-text search index (e.g., Postgres `tsvector`/GIN or equivalent) |
| Sorting | By name, date added, date last modified, quantity, status |
| Location filtering | Filtering by a parent location includes all descendant locations (subtree query) |
| Saved filters/views | P2 — user-saved filter presets |
| Empty/zero-result state | Must show a clear "no results" state with suggestion to broaden filters, not a blank screen |
| Access-scoped results | Search results respect role/visibility rules — a `viewer` never sees restricted-category items even via search |

---

## 13. Dashboard Requirements

Role-aware overview shown on login/home:

| Widget | Visible to | Description |
|---|---|---|
| Total assets & total inventory quantity | All | Count of distinct asset instances + sum of quantity items |
| Currently issued assets | All | List/count of checked-out items, highlighting overdue (Phase 2: due dates) |
| Assets requiring attention | All | Damaged, lost, under repair, low-stock |
| Recently added assets | All | Last N registrations |
| Recently moved assets | All | Last N transfers |
| Recently modified records | Contributor+ | Last N edits, with actor |
| Low-stock items | All | Quantity items below reorder threshold |
| Current reservations | All | Active reservations, expiring soon |
| Security/admin alerts | Admin only | Failed login spikes, new admin actions, pending account requests, 2FA non-compliance |

Dashboard must degrade gracefully with useful empty states (e.g., "No assets checked out right now" rather than an empty table).

---

## 14. Authentication and Authorization

### 14.1 Authentication Mechanism

- Email/username + password, hashed with **Argon2id** (fallback bcrypt with cost ≥12 only if Argon2id unavailable in stack). Passwords never logged, never returned in API responses.
- Minimum password policy: length-based (≥12 chars) rather than arbitrary complexity rules; check against breached-password lists (e.g., HaveIBeenPwned k-anonymity API) at registration/reset — P1.
- Session tokens are server-validated (opaque session ID backed by server-side store, or short-lived signed JWT + refresh token with server-side revocation list). Given the need for immediate revocation (FR-AUTH-06), an **opaque server-validated session** (stored in DB/Redis) is recommended over stateless JWT for this system's scale — revocation is simpler and the user base is small enough that the lookup cost is negligible.

### 14.2 Two-Factor Authentication

- TOTP (RFC 6238) via standard authenticator apps (Google Authenticator, Authy, etc.) — no SMS 2FA (SIM-swap risk, and unnecessary cost/complexity for this use case).
- Mandatory for `contributor`, `stores_manager`, `admin` roles at launch; optional-but-encouraged for `viewer`.
- Recovery codes (10 single-use codes) issued at enrollment, stored hashed.
- Admin can require org-wide 2FA enforcement and can view (not bypass) 2FA compliance status per user.

### 14.3 Role-Based Authorization

- Every API endpoint enforces authorization **server-side**, independent of UI state. UI hiding of buttons is never treated as a security control.
- Authorization checks are centralized (middleware/policy layer) rather than duplicated ad hoc in each handler, to avoid missed checks.
- Resource-level checks (not just role-level) prevent IDOR: e.g., "can this user edit *this* asset" checks role AND, where relevant, ownership/project scope.

### 14.4 Secure Session Management

- Session cookies: `HttpOnly`, `Secure`, `SameSite=Strict` (or `Lax` if cross-site login flows require it), scoped to the application domain.
- Session expiry: idle timeout (e.g., 30–60 min) + absolute lifetime (e.g., 12 hours), configurable.
- Session ID regenerated on login and on privilege change (prevents session fixation).
- Concurrent session visibility and revocation (§9.1 FR-AUTH-05).

### 14.5 Password Recovery

- Reset flow never confirms/denies whether an email exists (generic "if this account exists, an email was sent" message).
- Reset tokens: single-use, short expiry, invalidate all existing sessions upon successful reset, cryptographically random (≥128 bits entropy), stored hashed.

### 14.6 Step-Up Verification for Sensitive Operations

Operations requiring fresh re-authentication (password and/or 2FA re-entry within a short window) regardless of existing session validity:
- Role/permission changes
- User deactivation/deletion
- Security setting changes (2FA policy, session policy)
- Hard delete of inventory records
- Bulk quantity reconciliation beyond a configurable threshold

---

## 15. Security Requirements

Each requirement below states the **threat**, **why it matters for NEST specifically**, and the **implementation approach** — not security features added by default.

| Area | Threat Addressed | Why It Matters for NEST | Implementation Approach |
|---|---|---|---|
| Input validation | Injection, malformed data corrupting inventory state | Inventory records are the core value of the product; corrupted/injected data breaks trust in the system | Server-side schema validation (e.g., JSON schema / typed DTOs) on every write endpoint; reject unknown fields (mass-assignment protection); allow-list, not deny-list |
| Output encoding | XSS via stored fields (asset names, notes, descriptions) | Notes/descriptions are free text and rendered to many users — a stored XSS payload in a "notes" field could compromise every viewer, including admins | Context-aware output encoding in templating/framework (auto-escaping by default); never use raw HTML rendering of user content; sanitize any rich-text fields with an allow-list sanitizer if rich text is ever supported |
| SQL injection | Data theft/destruction via crafted input | Full asset + user database is a high-value target | Parameterized queries / ORM only; no string-concatenated SQL; least-privileged DB user for the app (no DDL rights at runtime) |
| CSRF | Forged state-changing requests riding an authenticated session | Session cookies + browser UI mean classic CSRF risk on POST/PUT/DELETE routes | SameSite cookies as primary defense + CSRF tokens (double-submit or synchronizer pattern) on state-changing form/API requests not using a separate auth header |
| Brute force / credential stuffing | Account takeover via password guessing or leaked-credential replay | Compromised account = full visibility into internal ops, and potential inventory tampering | Rate limiting per-IP and per-account on login/2FA endpoints; progressive delay/lockout (FR-AUTH-04); breached-password check on set |
| Rate limiting (general API) | Automated scraping/abuse, DoS via expensive endpoints | Search endpoints could be abused to enumerate all inventory rapidly or exhaust DB resources | Global + per-route rate limits (e.g., token bucket) at reverse proxy/app layer; stricter limits on auth and file-upload endpoints |
| Secure file uploads | Malware, path traversal, stored XSS via filenames/content, resource exhaustion | Datasheets/photos/invoices are core to the product; uploads are a classic attack vector | See §18 in full |
| API security | Broken object-level authorization, mass assignment, excessive data exposure | Same system serves both a browser UI and (Phase 2+) programmatic access | Consistent authZ middleware; explicit response DTOs (never `SELECT *` serialized directly); versioned API; strict CORS (see below) |
| Secrets management | Leaked DB credentials, signing keys, SMTP creds, cloud storage keys | A leaked secret compromises the whole system | Secrets in environment variables / a secrets manager (e.g., Vault, cloud provider secret store), never committed to source control; distinct secrets per environment; rotation procedure documented |
| Encryption in transit | Network eavesdropping/MITM | System is internet-facing on a public domain | TLS 1.2+ enforced (HSTS), HTTP→HTTPS redirect, modern cipher suites only |
| Encryption at rest | Database/disk compromise exposing sensitive fields | 2FA secrets, password hashes, recovery codes, possibly procurement cost data | Full-disk/volume encryption at infrastructure level; application-level encryption for especially sensitive columns (2FA secret, recovery codes) using a KMS-backed key, not a hardcoded key |
| Secure DB configuration | Default credentials, open ports, excessive privileges | Common cause of real-world breaches (Shodan-indexed default Mongo/Postgres instances) | DB not exposed to public internet (private network/VPC only); strong unique credentials; least-privilege app DB role; regular patching |
| Audit logging | No accountability for changes, insider threats | Explicit product requirement (§17) | Append-only audit log, separate from operational tables |
| Tamper-resistant logs | Attacker or malicious insider covering tracks | Audit trail is only useful if it can't be silently edited | Logs written with no `UPDATE`/`DELETE` grants for the app role; consider write-once storage or periodic export/hash-chaining to external storage for high assurance (Phase 2/3) |
| Admin activity monitoring | Privilege abuse | Admins have broad power; must be monitorable | All admin actions logged with actor, target, before/after; optional alerting on sensitive admin actions (e.g., new admin created) |
| Account lockout / throttling | See brute force above | — | — |
| Dependency/vulnerability management | Supply-chain and known-CVE exploitation | Student-maintained codebases often drift out of date | Automated dependency scanning (e.g., `npm audit`/Dependabot/Renovate), scheduled patch cadence, pinned lockfiles |
| Security headers | Clickjacking, MIME sniffing, XSS amplification | Cheap, high-value defense-in-depth | `Content-Security-Policy`, `X-Frame-Options: DENY` (or CSP `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security` |
| Secure cookies | Session theft via XSS/network | — | `HttpOnly`, `Secure`, `SameSite`, scoped `Path`/`Domain` |
| CORS policy | Unauthorized cross-origin API use | API may later be used by scripts/integrations | Deny-by-default CORS; explicit allow-list of trusted origins (e.g., the app's own frontend domain); no `Access-Control-Allow-Origin: *` on authenticated routes |
| Backup security | Backup theft/exposure = full data breach without touching prod | Backups are often the weakest link | Encrypted backups, access-restricted storage, backups excluded from public buckets, tested restore process |
| Disaster recovery | Extended downtime or data loss | Team relies on NEST for physical operations | See §25 |
| Data retention | Indefinite storage of stale/sensitive data | Balance auditability vs. data minimization | Defined retention policy for logs and archived records (see §29); reviewed periodically, not unlimited by default |
| OWASP Top 10 coverage | Broad class of common web vulnerabilities | Baseline hygiene for any internet-facing app | Requirements above map to: A01 Broken Access Control, A02 Crypto Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfig, A06 Vulnerable Components, A07 Auth Failures, A08 Data Integrity Failures, A09 Logging Failures, A10 SSRF |
| Unauthorized inventory manipulation | Malicious/accidental corruption of the core data asset | This *is* the product's value | RBAC + audit + append-only transaction ledger for quantities (§10) + confirmation on destructive actions |
| Privilege escalation | User granting themselves/others elevated rights | Catastrophic if successful | Role changes restricted to `admin`, require step-up auth, logged; server never trusts client-supplied role/permission fields |
| Mass assignment / IDOR | Editing fields or records not intended to be user-controlled | Common real-world API bug class | Explicit per-endpoint field allow-lists; resource ownership/authorization check on every object access by ID |
| Accidental/malicious deletion | Data loss, sabotage | Inventory records represent real physical/financial value | Soft-delete by default; hard delete restricted + logged + confirmation; recycle-bin/restore window (P1) |
| Secure deployment practices | Misconfigured production exposing dev tools/debug info | Common source of real breaches | Debug mode off in prod, no verbose stack traces to clients, environment-specific configs, infra-as-code reviewed |
| Production secrets isolation | Dev/staging secrets or access leaking into prod, or vice versa | Prevents cross-environment compromise | Fully separate credentials, DB instances, and secret stores per environment (§23) |
| Regular security updates | Unpatched known vulnerabilities | Ongoing risk, not one-time | Scheduled patch review (e.g., monthly), automated alerts for critical CVEs |

---

## 16. Threat Model

Format: **Threat → Attack Surface → Impact → Mitigation → Detection → Recovery**

| Threat | Attack Surface | Impact | Mitigation | Detection | Recovery |
|---|---|---|---|---|---|
| Credential theft (phishing, leaked reuse) | Login form, password reset | Account takeover, data exposure | 2FA mandatory for privileged roles; breached-password checks; unique salted hashes | Alert on login from new device/location (P2); failed-login monitoring | Force password reset + session revocation for affected account; review audit log for actions taken under compromised session |
| Account takeover | Auth endpoints | Attacker acts as legitimate user; inventory tampering; data exfiltration | 2FA, rate limiting, session binding, step-up auth for sensitive ops | Anomalous activity alerts, admin dashboard alerts | Revoke sessions, force reset, review/rollback audit-logged changes |
| Brute-force attack | Login, 2FA verification endpoints | Credential/2FA guessing | Rate limiting + progressive lockout + CAPTCHA fallback (P2) | Spike alerting on failed attempts | Temporary IP/account block, notify affected user |
| Privilege escalation | Role/permission update endpoints, mass assignment bugs | Attacker/insider gains admin rights | Server-side role enforcement, allow-listed fields, step-up auth for role changes, admin-only role endpoints | Audit log review, alert on any role elevation | Revert role, forced session revocation, incident review |
| Unauthorized inventory modification | Asset CRUD endpoints | False stock data, sabotage, cover-up of theft | RBAC, resource-level authZ, audit trail, append-only quantity ledger | Diff-based audit log, anomaly review (e.g., mass edits) | Restore from audit log / backup, revert record |
| Malicious file upload | Attachment upload endpoint | Malware distribution, stored XSS, server compromise via file parsing | Type/content validation, size limits, isolated storage, no execution permissions, AV scanning (see §18) | Upload logging, AV scan alerts | Quarantine/delete file, review who accessed it |
| API abuse / scraping | Search & list endpoints | Data exfiltration of full inventory/user data | Rate limiting, pagination limits, authZ on every endpoint | Rate-limit trigger logs | Block source, rotate any exposed tokens |
| Database compromise | DB server, exposed ports, leaked credentials | Full data breach, tampering | DB not internet-exposed, least-privilege roles, encrypted at rest, network segmentation | DB access logging, unusual query pattern alerts (P2) | Rotate credentials, restore from clean backup, forensic review |
| Insider threat | Any authenticated privileged account | Data theft, sabotage, unauthorized disposal of assets | Least privilege, mandatory audit trail for all mutating actions, step-up auth on destructive ops | Regular audit log review by admin, alerts on bulk deletions | Revoke access, investigate via immutable audit log |
| Session hijacking | Cookie theft via XSS/network sniffing | Full account impersonation | HttpOnly/Secure/SameSite cookies, TLS everywhere, XSS defenses, session binding to IP/UA (soft check, P2) | New-session alerts (P2) | Revoke sessions, force reset |
| Supply-chain vulnerabilities | npm/pip/etc. dependencies, CI pipeline | Malicious code execution in app or build | Dependency scanning, lockfiles, minimal dependency footprint, review before upgrading major versions, CI secrets scoped minimally | Automated vulnerability scan alerts | Patch/rollback dependency, rebuild & redeploy, audit CI logs |
| Server compromise | Host OS, exposed services, reverse proxy | Full system compromise | Hardened OS image, firewall (only 443/80 exposed), no unnecessary services, regular patching, SSH key-only access | Host-level monitoring/IDS (P2), unusual outbound traffic alerts | Isolate host, restore from IaC + backups, rotate all secrets |
| Data destruction / ransomware | File storage, database | Loss of entire inventory history | Immutable/offsite backups, least-privilege prevents lateral movement, no app-level access to backup deletion | Backup integrity checks, unexpected mass-deletion alerts | Restore from offsite backup, verified via periodic restore drills |
| Automated scanning/exploitation | Any public endpoint | Discovery and exploitation of known vulnerabilities | Security headers, patched dependencies, WAF/reverse-proxy filtering (P2), no default/debug endpoints exposed | Reverse proxy/WAF logs, anomaly detection | Patch, block source IP ranges, post-incident review |

**Note:** Security through obscurity (hiding admin URLs, relying on "nobody will find it") is explicitly not treated as a control anywhere in this model — every mitigation above assumes the attacker knows the system exists and its general architecture.

---

## 17. Audit and Logging Requirements

### 17.1 Principles

- Audit logs are **append-only**: the application's database role has `INSERT` but no `UPDATE`/`DELETE` grant on audit tables.
- Every audit entry captures: **actor** (user ID, or "system"), **action type**, **target entity + ID**, **before/after diff** (for modifications), **timestamp (UTC)**, and **originating session ID / IP address / user agent** where applicable.
- Audit logs are queryable by admins with filters (actor, entity, action type, date range) and are never editable through the UI.

### 17.2 Events Logged (minimum set — P0)

| Category | Events |
|---|---|
| Authentication | Login success/failure, logout, password change, password reset requested/completed, 2FA enrolled/disabled/used, session revoked |
| Inventory | Asset created, modified (with diff), archived, hard-deleted, quantity transaction (receive/issue/adjust/consume) |
| Movement | Check-out, check-in, transfer (from → to location), reservation created/cancelled/expired |
| Assignment | Assigned to member, assigned to project |
| Files | Attachment uploaded, attachment deleted |
| Access control | Role changed, permission changed, user created, user deactivated/reactivated, user deleted |
| Admin | Security setting changed, bulk operations performed |

### 17.3 Retention & Integrity

- Audit logs retained for a minimum of 24 months (configurable; see §29 data retention).
- P2: periodic export of audit log hashes to an external/immutable store (e.g., signed export to object storage with object-lock) to detect any tampering even by a compromised app-DB admin.

---

## 18. Attachment and File Management

| Requirement | Detail |
|---|---|
| Allowed types (MVP) | PDF (datasheets, invoices, manuals, certificates), common image formats (JPEG, PNG, WebP) |
| File size limits | Configurable cap (e.g., 25 MB/file) enforced client + server side |
| Storage location | Files stored **outside** the web root, in object storage (e.g., S3-compatible bucket) or a dedicated non-executable volume — never directly served from an app-writable directory |
| Filename handling | Original filename stored as metadata only; actual stored filename is a generated UUID to prevent path traversal / collision / injection via filename |
| Content validation | Server-side MIME/type verification via file signature (magic bytes), not just extension or client-provided `Content-Type` |
| Malware scanning | Uploaded files scanned by an antivirus engine (e.g., ClamAV) before being marked available; files pending/failed scan are not downloadable |
| Access control | Files served via short-lived signed URLs or an authenticated proxy endpoint that re-checks authorization on every request — never a public bucket URL |
| Image handling | Images re-encoded/stripped of EXIF metadata on upload (privacy + defends against embedded payloads) — P1 |
| No execution | Storage bucket/volume configured with no execute permissions; PDFs viewed via browser-native/PDF.js rendering rather than triggering local app execution |
| Deletion | Soft-delete (marked deleted, retained for audit/recovery window) then periodic hard purge per retention policy |

---

## 19. UX/UI Requirements

- **Design language**: clean, minimal, high information density where it matters (tables, search results) but generous whitespace in forms; a single consistent design system (component library) rather than ad hoc styling per page.
- **Desktop-first, responsive**: primary workflows (registration, search, dashboard) optimized for desktop/laptop use in a lab setting; core flows (search, check-out, view detail) must remain fully usable on mobile for quick lookups in the physical stores room.
- **Navigation**: persistent primary navigation (Dashboard, Inventory, Locations, Projects, Admin [role-gated]); breadcrumbs on detail/location pages.
- **Status indicators**: consistent color-coded badges for status (available/issued/reserved/damaged/under repair/lost/retired) used identically across dashboard, search results, and detail pages.
- **Forms**: accessible labels, inline validation with specific error messages ("Serial number is required for category 'Instrument'" not "Invalid input"), sensible defaults, autosave draft for long forms (P2).
- **Destructive actions**: always require explicit confirmation (modal with the item name typed or clicked-through), and are visually distinct (e.g., red/warning styling) from routine actions.
- **Empty states**: every list/table has a designed empty state with a clear next action ("No assets in this location yet — Add one").
- **Error handling**: user-facing errors are specific and actionable; internal errors never leak stack traces or internal identifiers to non-admin users.
- **Performance feel**: optimistic UI updates for common actions (check-out/in) with rollback on failure; skeleton loading states, not blank screens.

---

## 20. Accessibility Requirements

- Target **WCAG 2.1 AA** for core workflows (search, view, register, check-out/in).
- Full keyboard navigability for all interactive elements; visible focus states.
- Sufficient color contrast for status badges (do not rely on color alone — pair with icon/text label, important for damaged/available distinction).
- Semantic HTML and ARIA labeling for form fields, tables, and modals.
- Screen-reader-friendly error messaging (errors announced, associated with the relevant field via `aria-describedby`).
- Responsive text sizing; no fixed-pixel text that breaks browser zoom.

---

## 21. Data Model

### 21.1 Mandatory Entities (MVP)

| Entity | Purpose |
|---|---|
| `users` | Accounts, credentials (hash), 2FA secret, status |
| `roles` | Fixed role set (viewer/contributor/stores_manager/admin) |
| `permissions` | Underlying permission atoms (Phase-2-ready even if not exposed granularly in MVP UI) |
| `role_permissions` | Mapping roles → permissions |
| `asset_catalog` | Canonical "type" definition: name, category, manufacturer, part number, datasheet link, description |
| `asset_instances` | Individually tracked physical units (serialized) |
| `inventory_items` | Quantity-based stock rows (catalog + location + quantity) |
| `inventory_transactions` | Append-only ledger of quantity changes (receive/issue/adjust/consume/transfer) |
| `locations` | Self-referencing location tree |
| `asset_relationships` | Parent/child links between asset instances (assemblies, subsystems) |
| `checkouts` | Check-out/check-in records for asset instances |
| `transfers` | Location-change history for asset instances |
| `reservations` | Future-use holds on instances or inventory quantity |
| `attachments` | File metadata linked to catalog/instance/inventory records |
| `audit_logs` | Append-only record of all logged events (§17) |
| `security_events` | Auth-specific events (login attempts, 2FA changes) — may be unified with `audit_logs` or kept separate for clearer security review |
| `sessions` | Active session records for revocation support |

### 21.2 Optional / Phase 2+ Entities

| Entity | Purpose |
|---|---|
| `projects` | Named initiatives (e.g., "CanSat-25", "CubeSat Payload") for assignment/reporting |
| `project_assignments` | Links assets/inventory consumption to projects |
| `suppliers` | Vendor directory |
| `procurement_records` | Purchase records (supplier, cost, order date, linked to received inventory) |
| `categories` (normalized) | If category list grows beyond a simple enum, normalize into its own table with hierarchy |
| `calibration_schedule` | For instruments requiring periodic calibration |
| `notifications` | In-app/email notifications (low stock, overdue checkout, reservation expiring) |

### 21.3 Core Relationships (simplified)

```
users ──< sessions
users ──< audit_logs (actor)
users >──< roles  (via user_roles, or single role_id on user for MVP simplicity)
roles ──< role_permissions >── permissions

asset_catalog ──< asset_instances
asset_catalog ──< inventory_items ──< inventory_transactions

locations ──< locations (self-referencing parent)
locations ──< asset_instances (current_location_id)
locations ──< inventory_items (location_id)

asset_instances ──< checkouts
asset_instances ──< transfers
asset_instances ──< attachments
asset_instances >──< asset_instances (via asset_relationships: parent/child)

inventory_items ──< reservations
asset_instances ──< reservations

[Phase 2] projects ──< project_assignments >── asset_instances / inventory_items
[Phase 2] suppliers ──< procurement_records ──< inventory_transactions / asset_instances
```

**Design note:** MVP intentionally keeps `users.role_id` as a single FK (simple RBAC) rather than a many-to-many `user_roles` table, since the initial role set is small and fixed. The `role_permissions` layer is still built from day one so Phase 2 granular permissions don't require a breaking migration — only `roles`/`permissions` content and a `user_roles` bridge table need to be added later.

---

## 22. API Requirements

- RESTful JSON API (or GraphQL if the team has strong prior experience — see §38 alternatives) versioned from day one (`/api/v1/...`).
- Every endpoint requires authentication except `/auth/login`, `/auth/reset-password`, `/health`.
- Consistent error envelope (`{ "error": { "code", "message" } }`) without leaking stack traces.
- Pagination on all list endpoints (cursor or offset-based), with a maximum page size enforced server-side.
- Explicit response DTOs/serializers — never dump raw DB rows (avoids leaking internal-only fields like password hashes, soft-delete flags).
- Idempotency for state-changing operations where feasible (e.g., check-out uses a unique constraint to prevent double-submit race conditions).
- CORS locked to the known frontend origin(s) only (§15).
- API rate limiting per §15.
- OpenAPI/Swagger spec maintained for internal documentation (P1) — valuable given student team turnover.
- Report export endpoints (`/api/v1/reports/monthly?month=...&format=xlsx|pdf`) are admin-gated like any other route (§9.4) and return either a signed download URL or a streamed file with appropriate `Content-Disposition`/`Content-Type` headers — never a public/static path.

---

## 23. Deployment Architecture

### 23.1 Recommended Architecture (technology-agnostic)

```
                     [ Users - HTTPS ]
                            |
                    [ Reverse Proxy / TLS termination ]
                    (nginx / Caddy / cloud LB)
                            |
              ┌─────────────┴─────────────┐
        [ Frontend (static build) ]   [ Backend API service ]
        served via CDN / same proxy         |
                                     ┌───────┴────────┐
                              [ Relational DB ]   [ Object storage ]
                              (Postgres, private)  (attachments, private,
                                                     signed-URL access)
                                        |
                                [ Background worker(s) ]
                                (AV scanning, email, exports)
```

- **Frontend**: static SPA build (or server-rendered) served behind the reverse proxy / CDN.
- **Backend**: single API service (monolith is appropriate at this scale — see §38); stateless where possible so it can be horizontally scaled if ever needed.
- **Database**: managed or self-hosted PostgreSQL, private network only, automated backups.
- **File storage**: S3-compatible object storage (self-hosted MinIO or a cloud provider), private bucket, signed URLs.
- **Reverse proxy**: nginx or Caddy handling TLS termination, security headers, and basic rate limiting; Caddy is attractive for automatic HTTPS certificate management with low operational overhead for a student-run system.
- **Background worker**: for AV scanning, email sending (password reset, notifications), and scheduled jobs (reservation expiry, low-stock digest).

### 23.2 Environment Separation

| Environment | Purpose | Notes |
|---|---|---|
| Development | Local/dev machines | Seed/fixture data only, never real user data |
| Staging | Pre-production validation | Mirrors prod config, separate DB/secrets, may use anonymized data copies |
| Production | Live system | Fully isolated credentials, secrets, and infrastructure from dev/staging |

- Distinct `.env`/secret sets per environment; production secrets never present on developer machines or in CI logs.
- Database migrations applied through a controlled process (see §31), never manually against production.

### 23.3 Domain & HTTPS

- Dedicated subdomain/domain (e.g., `nest.coepsatelliteinitiative.org`).
- Automatic TLS certificate issuance/renewal (Let's Encrypt via Caddy, or cloud-managed certs).
- HSTS enabled once HTTPS is confirmed stable.

---

## 24. Infrastructure Requirements

- Firewall: only 443 (and 80 for redirect) exposed publicly; SSH restricted to key-based auth from known IPs/VPN where feasible.
- OS and container images kept patched on a defined cadence.
- Infrastructure defined as code (e.g., Docker Compose for a system this size, or Terraform if the team anticipates cloud scaling) so environments are reproducible and not hand-configured.
- Resource sizing: modest — a small VM (2–4 vCPU, 4–8GB RAM) is expected to comfortably serve this workload; right-size based on actual usage post-launch.
- Health check endpoint for uptime monitoring and load balancer/orchestrator probes.

---

## 25. Backup and Disaster Recovery

| Requirement | Detail |
|---|---|
| Database backups | Automated daily full backups + continuous WAL/point-in-time recovery if supported by chosen DB hosting |
| Backup retention | Minimum 30 days rolling, plus monthly archives retained 12 months |
| Backup encryption | Backups encrypted at rest, access restricted to admin/infra role, stored in a separate account/location from production (protects against single-account compromise) |
| File storage backups | Object storage versioning/replication enabled |
| Restore testing | Quarterly restore drill to verify backup integrity and document restore time |
| RTO / RPO (target) | RPO ≤ 24 hours (P0), RTO ≤ 8 hours for full system restore (P1 target, refine once real usage patterns known) |
| Disaster scenarios covered | DB corruption, accidental mass deletion, host compromise/ransomware, provider outage |

---

## 26. Monitoring and Observability

- **Uptime monitoring**: external health-check ping on the public domain (P0).
- **Application logging**: structured logs (JSON) for requests, errors, and background jobs; centralized log aggregation (even a simple hosted log service is sufficient at this scale) — P1.
- **Error tracking**: exception tracking (e.g., Sentry or self-hosted equivalent) capturing stack traces server-side only, with sensitive data scrubbed — P1.
- **Security monitoring**: alerting on failed-login spikes, new admin account creation, mass-deletion events, repeated authorization failures — P1/P2.
- **Metrics**: basic request latency/error-rate dashboards (P2).

---

## 27. Performance Requirements

| Metric | Target |
|---|---|
| Page load (dashboard, search) | <2s on typical campus network, <1s server response for cached/indexed queries |
| Search response | <500ms for typical queries (see §12) |
| Concurrent users | System must comfortably support 50–100 concurrent authenticated users (realistic team size), with headroom to 300+ without redesign |
| File upload | Support files up to configured max size (§18) without blocking the UI (async/progress indicator) |

---

## 28. Reliability Requirements

- Target uptime: 99% (student-run, non-mission-critical-in-real-time system; realistic rather than aspirational enterprise SLA).
- Graceful degradation: if file storage/AV scanning is temporarily unavailable, inventory CRUD should still function (attachments queued/retried) rather than the whole app failing.
- No single point of failure in the *data* layer beyond what backups mitigate (i.e., backups are the primary reliability control at this scale, not multi-region failover).

---

## 29. Privacy and Data Governance

- NEST stores personal data limited to what's operationally necessary: name, email, role, and activity history of team members. No unnecessary PII collected.
- Access to another member's activity history is limited to `stores_manager`/`admin` (a `viewer` sees who currently holds an asset, not that user's full personal history) — this balances accountability with reasonable member privacy.
- Data retention: audit logs retained per §17.3; deactivated user accounts retain historical audit attribution (for record integrity) but personal login credentials are invalidated immediately on deactivation.
- Departing-member data: on graduation/departure, accounts are deactivated (not deleted) by default to preserve audit/history integrity; full deletion available to admin on request, subject to organizational policy (see Open Questions §41).

---

## 30. Testing Strategy

| Level | Coverage |
|---|---|
| Unit tests | Business logic: RBAC checks, inventory state transitions, quantity transaction math, validation rules |
| Integration tests | API endpoints end-to-end against a test DB, including authZ negative cases (e.g., viewer cannot delete) |
| Security tests | Automated dependency scanning in CI; periodic manual review/pen-test pass before major releases (P1); explicit test cases for IDOR, mass assignment, and auth bypass attempts |
| E2E tests | Critical user flows: login+2FA, register asset, check-out/in, transfer, search |
| Load/performance tests | Basic load test against §27 targets before production launch (P1) |
| Accessibility tests | Automated a11y linting (e.g., axe) in CI + periodic manual keyboard/screen-reader pass |

---

## 31. CI/CD Requirements

- Automated pipeline: lint → unit tests → build → integration tests → dependency/security scan → deploy to staging → (manual approval) → deploy to production.
- Database migrations run as an explicit, reviewed step in the pipeline (never ad hoc against prod); migrations must be backward-compatible or paired with a defined rollout plan (avoid breaking deploys).
- Secrets injected via CI secret store, never hardcoded in pipeline config or source.
- Rollback procedure defined (redeploy previous build artifact; migration rollback plan documented per migration where feasible).
- Branch protection + required review before merge to main/production branch.

---

## 32. Future Extensibility

- **Granular permissions**: move from fixed roles to a `permissions` + `user_roles`/scoped-permission model already laid out in the schema (§21), enabling per-category or per-project permission scoping.
- **Barcode/QR scanning**: mobile-friendly scan-to-checkout using generated QR labels per asset/location (natural Phase 2/3 addition given the location/asset ID model already supports it).
- **Procurement workflow**: supplier + purchase-order tracking feeding directly into `inventory_transactions` receipts.
- **Notifications**: email/Slack/Discord alerts for low stock, overdue checkouts, reservation expiry.
- **Calibration tracking**: due-date tracking and alerts for test instruments.
- **Reporting/exports**: project-based usage reports, CSV/PDF export of inventory snapshots.
- **API integrations**: webhook or API access for other internal tools (e.g., a documentation wiki linking live to asset status).

---

## 33. MVP Scope

**Included (P0 unless noted):**
- Auth: login, 2FA (mandatory for contributor+), password reset, lockout/throttling, session management, step-up auth for sensitive ops.
- RBAC with 4 fixed roles.
- Asset catalog + individually tracked asset instances + quantity-based inventory items.
- Flexible location hierarchy (self-referencing tree).
- Check-out/check-in, transfer, damage/loss reporting, repair status, retirement (soft-delete/archive).
- Asset relationships (parent/child) — basic (P1, targeted for MVP if timeline allows, otherwise first item in Phase 2).
- Full-text + filtered search.
- Role-aware dashboard.
- Secure attachment upload/download (PDF, images) with AV scanning.
- Full audit logging (§17).
- Production deployment with the architecture in §23, backups (§25), and baseline security headers/CORS/rate limiting (§15).

**Explicitly excluded from MVP** (see §35–36): projects/procurement entities, barcode scanning, notifications, calibration tracking, reporting/export, granular per-resource permissions, external integrations.

---

## 34. (see §33 above — MVP Scope covers this; §34 reserved per outline)

*Note: Per the requested outline, MVP Scope is fully covered in §33. Sections 35–36 below detail Phase 2 and Phase 3.*

---

## 35. Phase 2 Features

- Projects entity + project assignment/reporting.
- Suppliers + procurement records, linked to receipt transactions.
- Granular, resource-scoped permissions layered onto existing role/permission schema.
- Notifications (low stock, overdue checkout, reservation expiring) via email.
- Saved search filters/views.
- Signed-URL image EXIF stripping and thumbnailing.
- Security monitoring/alerting (failed-login spikes, admin-action alerts).
- Restricted/sensitive category visibility scoping.
- Restore window for soft-deleted/archived records via UI (currently admin-only via §9.2 FR-INV-05).

## 36. Phase 3 Features

- Barcode/QR-based scan-to-checkout, printable asset/location labels.
- Calibration schedule tracking for instruments.
- Extended reporting: project-based usage reports and CSV export, building on the monthly .xlsx/.pdf report shipped as part of core reporting (§9.4).
- Read-only auditor/reviewer role.
- Public API for internal tool integrations, with API key management.
- Hash-chained/externally-anchored audit log export for elevated tamper evidence.
- Multi-warehouse support if the Initiative ever operates from more than one physical site simultaneously.

---

## 37. Acceptance Criteria (Product-Level)

- A new member can find out, unaided, whether a given part is in stock and where it is within 30 seconds of logging in.
- A contributor can register a newly received box of components (catalog entry + inventory item + location) in under 2 minutes.
- Every create/modify/delete/transfer/checkout action is visible in the audit log with correct actor, timestamp, and diff within the same session.
- Attempting to check out an already-issued serialized asset is blocked with a clear error, with no race condition allowing double-issue under concurrent requests.
- A deactivated user cannot log in or use an existing session immediately after deactivation.
- The dashboard accurately reflects real-time counts (issued, low-stock, requiring attention) with no manual refresh needed beyond page load.

---

## 38. Security Acceptance Criteria

- No P0/P1 findings in an independent security review (or self-conducted OWASP-based checklist review) prior to production launch, covering: auth bypass, IDOR, mass assignment, injection, XSS, CSRF, insecure file upload, and broken access control.
- 2FA cannot be bypassed for contributor+ accounts once enrollment is enforced.
- All state-changing endpoints reject requests without valid CSRF protection where cookie-based auth is used.
- Uploaded files are rejected if their actual content type (magic bytes) doesn't match an allow-listed type, regardless of extension or declared `Content-Type`.
- Audit log entries cannot be modified or deleted through any application code path (verified by attempting via API with admin credentials — must fail).
- Rate limiting demonstrably throttles a simulated brute-force attempt against the login endpoint.
- Secrets are absent from source control history (verified via scan) and from client-side bundles.
- TLS configuration scores at minimum "A" on a standard SSL/TLS configuration test at launch.

---

## 39. Recommended Technology Stack

No specific stack is mandated by strong architectural necessity; the system is a fairly standard CRUD-heavy, auth-heavy, RBAC web application. Recommendations below optimize for **team familiarity, maintainability by rotating students, strong ecosystem support for the security requirements above, and low operational overhead**.

| Layer | Recommended | Rationale | Alternatives |
|---|---|---|---|
| Frontend | React (or Vue) + TypeScript, component library (e.g., Tailwind + a headless component set) | Large ecosystem, easy to onboard new student contributors, strong typing reduces bugs | Vue + TypeScript; Svelte if team prefers smaller footprint |
| Backend | Node.js (NestJS or Express) with TypeScript, or Python (FastAPI/Django) | Both have mature auth/RBAC libraries, ORM support, and are commonly taught; FastAPI/Django especially strong if team has more Python experience | Django (batteries-included, strong admin/audit ecosystem) is a particularly good fit given the RBAC + audit-heavy requirements |
| Database | PostgreSQL | Strong relational integrity, JSONB for flexible metadata fields, full-text search (GIN/tsvector) covers §12 without a separate search engine at this scale | MySQL/MariaDB if team has stronger prior experience |
| ORM | Prisma (Node) or Django ORM / SQLAlchemy (Python) | Parameterized queries by default (SQL injection mitigation), migration tooling built in | — |
| Auth | Custom auth using framework-native session handling + `otplib`/`pyotp` for TOTP, Argon2id via `argon2` library | Full control over security posture matches the detailed requirements above; avoids external auth-vendor dependency for a small internal tool | Auth0/Clerk/Supabase Auth if the team prefers not to own auth code — trades control for reduced maintenance burden |
| File storage | S3-compatible object storage (self-hosted MinIO, or a cloud provider free/low tier) | Signed URLs, versioning, separation from app server | Cloud provider managed storage (S3/GCS/Azure Blob) |
| Reverse proxy / TLS | Caddy | Automatic HTTPS, simple config, good fit for a small self-managed deployment | nginx + certbot |
| Hosting | Single VM (Docker Compose) on a low-cost VPS, or a PaaS (Render/Railway/Fly.io) | Matches team scale; avoids premature Kubernetes complexity | Kubernetes only if the Initiative already operates other services that way |
| Background jobs | A lightweight queue (e.g., BullMQ on Redis, or Celery on Python) | Needed for AV scanning, email, scheduled reservation expiry | Simple cron-based scripts if job volume stays low |
| AV scanning | ClamAV (self-hosted, called from background worker) | Free, well-established, integrates via CLI/daemon | Cloud-based file-scanning API if budget allows |
| Monitoring/error tracking | Self-hosted or free-tier Sentry; UptimeRobot (or similar) for uptime | Low/no cost, adequate for scale | Any equivalent APM |
| CI/CD | GitHub Actions | Free for student/education orgs, integrates directly with GitHub | GitLab CI |
| Report generation | `xlsx`/`exceljs` (Node) or `openpyxl` (Python) for .xlsx; a headless HTML-to-PDF renderer (e.g., Puppeteer/`weasyprint`) or a PDF library (`pdfkit`/`reportlab`) for .pdf | Both formats generated from the same underlying report data/template to avoid drift (§9.4) | Cloud document-generation API if the team prefers not to self-host rendering |

**Monolith recommendation**: A single well-structured backend service (not microservices) is strongly recommended. At this scale, microservices add operational and cognitive overhead with no corresponding benefit, and would work against maintainability by a rotating student team (§Non-Goals philosophy).

---

## 40. Key Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Student team turnover mid-development or post-launch | Loss of institutional knowledge, stalled maintenance | Strong documentation, boring/mainstream tech choices, onboarding guide, avoid overly clever architecture |
| Self-hosted infrastructure neglect (patching, backups) post-launch | Security drift, eventual compromise or data loss | Automate as much as possible (CI security scans, automated backups, managed TLS); assign a rotating "infra owner" responsibility |
| Underestimating auth/security implementation effort | Rushed, incomplete security controls at launch | Treat §15/§16/§38 as launch-blocking (P0), not nice-to-have |
| Race conditions in check-out / quantity transactions | Double-issued assets, incorrect stock counts | DB-level constraints/transactions for state-changing operations (§9.2 FR-INV-06, FR-INV-15) |
| Schema rigidity limiting future asset types/relationships | Costly migrations later | Flexible catalog/instance/inventory split and generic `asset_relationships` (§11) designed for this up front |

## 41. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Low adoption — team reverts to spreadsheets/chat if NEST is slower than the old way | System becomes shelfware, data goes stale | Prioritize speed of common actions (check-out/in, quick search) in MVP; minimize required fields at registration |
| Data entry burden discourages accurate use | Inventory drifts from physical reality | Bulk-friendly workflows for receiving large component batches; low-friction quantity adjustment |
| Incomplete initial data migration from existing spreadsheets | Poor first impression, duplicate/missing records at launch | Plan a dedicated data-import/cleanup effort before/at launch (see Open Questions) |
| Role misconfiguration (too many admins, too few contributors) | Either bottlenecks or excessive risk exposure | Document a recommended role-assignment policy at launch; review periodically |

---

## 42. Open Questions

The following are explicitly **not decided** by this PRD and should be resolved by the team before/during implementation, rather than assumed:

1. **Organizational ownership of the "stores_manager" role** — is this a fixed elected position, a rotating responsibility, or assigned per-subsystem? Affects whether the role should be per-location-scoped in the future.
2. **Sensitive/restricted asset categories** — does the Initiative have any assets (e.g., export-controlled hardware, ITAR-adjacent components, flight-critical hardware) requiring restricted visibility beyond standard RBAC in MVP, or is that acceptable to defer to Phase 2 scoped permissions?
3. **Data retention / deletion policy for departing members** — should personal accounts and their audit attribution be fully deletable on request (e.g., for privacy/GDPR-style compliance if applicable), or retained indefinitely for historical integrity? This PRD assumes deactivation-not-deletion by default (§29) but this is an organizational policy decision, not a technical one.
4. **Hosting budget and ownership** — who pays for and administers the production VM/domain/TLS long-term, and what happens during summer/inter-semester gaps when active student maintainers may be unavailable?
5. **Existing spreadsheet data migration** — scope, format, and cleanup effort required to import current inventory records is unknown and should be scoped separately before launch.
6. **Legal/compliance requirements** — does COEP or the Initiative have any institutional data-handling policy that NEST must comply with beyond the general security posture defined here?
7. **Definition of "high-value" or "requires attention" thresholds** — dashboard low-stock and attention thresholds (§13) need team-specific defaults (e.g., reorder quantity per category) that this PRD cannot assume.
8. **Two-factor enforcement for `viewer` role** — currently optional-but-encouraged (§14.2); team should decide if this should be mandatory for all accounts given the sensitivity of even read access to internal ops data.
9. **Backup/DR budget** — offsite backup storage and restore-drill cadence (§25) has a cost/effort trade-off that should be explicitly sized against available team capacity.
10. **API/integration plans** — whether any Phase 3 external integration (e.g., a documentation wiki, Discord bot) is actually planned affects whether API-key management (§36) should be pulled earlier into the roadmap.

---

## 43. Implementation Roadmap (Indicative)

| Phase | Focus | Rough Duration |
|---|---|---|
| 0 — Foundations | Repo setup, CI/CD skeleton, auth + RBAC, base data model, deployment pipeline to staging | 3–4 weeks |
| 1 — MVP Core | Asset/inventory CRUD, locations, check-out/in, transfer, search, dashboard, attachments, audit logging | 6–8 weeks |
| 2 — Security Hardening & Launch Prep | Full §15/§16/§38 checklist, pen-test/self-review pass, backup/DR validation, production cutover | 2–3 weeks |
| 3 — Phase 2 Features | Projects/procurement, granular permissions, notifications, monitoring/alerting | Ongoing, post-launch |
| 4 — Phase 3 Features | Barcode scanning, calibration tracking, reporting/export, integrations | Future, as capacity allows |

---

*End of document.*
