# NEST — Technical Design Specification (TDS)

**Project:** Networked Equipment & Stock Tracker (COEP Satellite Initiative)
**Inputs:** NEST PRD v1.0, NEST Software Engineering System Instructions, NEST ADR / Implementation Plan / Repository Structure (approved)
**Document status:** Detailed design — precedes implementation
**Scope note:** This document specifies *what* the system's data, state machines, APIs, and cross-cutting mechanisms look like, at a level detailed enough to implement directly from. It contains schema definitions, endpoint catalogs, and DTO field lists as design artifacts — it does not contain application code.

---

## 1. Purpose & How to Read This Document

The ADR fixed *which technologies* NEST is built from and *why*. This TDS fixes *how the MVP is shaped* on top of those technologies: every table, every state transition, every endpoint's authorization rule, and every cross-cutting mechanism (audit, concurrency, search, attachments) required to satisfy the PRD's functional and security requirements.

Every design decision below traces back to a PRD requirement ID or a System Instructions section. Section 16 (Traceability Matrix) makes that mapping explicit. Where the PRD left something an open question (§42), this document does not resolve it — it designs the schema so the answer can be added later without a rewrite, and flags it.

---

## 2. Module Map (Recap, for Reference)

Matches the backend module boundaries fixed in the Repository Structure:

`auth · users · roles · permissions · assets · inventory · locations · checkouts · transfers · reservations · relationships · attachments · search · dashboard · reports · audit · security · health`

Each module owns its own tables and exposes a service-layer interface; no module reads another module's tables directly (ADR-001).

---

## 3. Domain Model & Data Dictionary

### 3.1 Entity Overview

```
users ──< sessions
users ──< totp_credentials (1:1)
users ──< password_reset_tokens
users ──< audit_log (actor)

locations ──< locations (self-referencing, parent_location_id)

asset_definitions ──< asset_instances
asset_definitions ──< inventory_items

asset_instances ──< checkouts
asset_instances ──< movement_events (transfers)
asset_instances ──< reservations
asset_instances ──< attachments (polymorphic target)
asset_instances ──< asset_relationships (as parent or child)

inventory_items ──< inventory_transactions
inventory_items ──< movement_events (transfers, where applicable)
inventory_items ──< reservations
inventory_items ──< attachments (polymorphic target)

projects ──< checkouts / inventory_transactions (optional tag, nullable FK)

audit_log: append-only, references actor + polymorphic target
```

Two schema-level conventions apply throughout:

- **Polymorphic targets** (attachments, reservations, movement events) use a `(target_type, target_id)` pair rather than a nullable FK per possible parent type, since both `asset_instance` and `inventory_item` can be attached to, reserved, or moved. `target_type` is a constrained enum, not a free string.
- **Soft delete** is a `deleted_at timestamptz null` column, never a physical `DELETE`, on every table where the PRD requires archive/recoverability (asset_instances, inventory_items, attachments, projects). Hard delete is a separate, admin-only, step-up-gated, audited operation restricted to the specific tables the PRD allows it on (asset_instances, per FR-INV-05).

### 3.2 `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| email | citext | unique, not null | login identifier |
| password_hash | text | not null | Argon2id |
| display_name | text | not null | |
| role | enum(`viewer`,`contributor`,`stores_manager`,`admin`) | not null, default `viewer` | never client-settable on write (PRD §7.2) |
| is_active | boolean | not null, default true | false = deactivated, blocks auth (FR-AUTH-06) |
| totp_enabled | boolean | not null, default false | derived convenience flag |
| totp_required | boolean | not null | computed from role + org policy at read time, not stored redundantly — see §12 |
| failed_login_count | integer | not null, default 0 | reset on success; drives progressive throttling |
| locked_until | timestamptz | null | temporary lock window (FR-AUTH-04) |
| created_at / updated_at | timestamptz | not null | |
| deactivated_at | timestamptz | null | set by admin action, immutable once set except by reactivation flow |

No `deleted_at` — users are deactivated, never deleted, to preserve audit attribution (System Instructions §39, PRD §29). `email` retained even after deactivation.

### 3.3 `sessions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | equals opaque session token (or a hash of it — see §12.1) |
| user_id | uuid | FK → users, not null | |
| created_at | timestamptz | not null | |
| last_seen_at | timestamptz | not null | updated at most once per minute to avoid write amplification |
| expires_at | timestamptz | not null | absolute lifetime (ADR-005) |
| revoked_at | timestamptz | null | set on logout / admin deactivation / password reset |
| step_up_verified_at | timestamptz | null | set on fresh re-auth; checked against a ≤5 min window |
| ip_address | inet | not null | |
| user_agent | text | not null | |

Index: `(user_id, revoked_at)` for the session-listing feature (FR-AUTH-05); `expires_at` for a periodic sweep job.

### 3.4 `totp_credentials`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| user_id | uuid | PK, FK → users | 1:1 |
| secret_encrypted | bytea | not null | application-level encryption, KMS-sourced key (ADR-005) |
| enrolled_at | timestamptz | not null | |
| recovery_codes | jsonb | not null | array of `{ hash, used_at }`; codes hashed, never stored plaintext |

### 3.5 `password_reset_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → users, not null | |
| token_hash | text | not null | token itself never stored |
| expires_at | timestamptz | not null | ≤ 30 min (FR-AUTH-03) |
| used_at | timestamptz | null | single-use enforcement |
| created_at | timestamptz | not null | |

### 3.6 `permissions` / `role_permissions` (Phase-2 seam, present but not exposed in MVP UI)

| Table | Columns | Notes |
|---|---|---|
| `permissions` | `id, key (unique, e.g. "asset.write"), description` | Seeded with the fixed capability set the four MVP roles resolve to. |
| `role_permissions` | `role (enum), permission_id (FK)` | Static mapping in MVP, seeded via migration, not editable through any MVP endpoint. |

The MVP `RolesGuard` checks `user.role` directly against a static capability table in code (fast, no extra query on every request). This table exists so Phase 2's resource-scoped permission model can be introduced by changing *data*, not the authorization architecture (PRD §7.3).

### 3.7 `locations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | not null | |
| type | enum(`warehouse`,`room`,`cabinet`,`rack`,`shelf`,`bin`,`box`,`position`,`other`) | not null | |
| parent_location_id | uuid | FK → locations, null | self-referencing tree root has null parent |
| description | text | null | |
| is_active | boolean | not null, default true | |
| path_cache | ltree or text[] | maintained by trigger/service on write | denormalized ancestor path for O(1) breadcrumb + fast subtree queries (see §9.2) |

Constraint: a trigger (or service-layer check inside the same transaction) rejects a `parent_location_id` update that would create a cycle.

### 3.8 `asset_definitions` (catalog)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | not null | |
| category | text | not null | indexed, used in search/filter |
| manufacturer | text | null | |
| part_number | text | null | indexed |
| datasheet_url | text | null | |
| description | text | null | |
| search_vector | tsvector | generated column | GIN-indexed, built from name/manufacturer/part_number/description (§9.1) |
| created_at / updated_at | timestamptz | not null | |
| deleted_at | timestamptz | null | soft delete |

### 3.9 `asset_instances` (individually tracked)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | user-facing Asset ID is a short display code derived from this, e.g. `AST-000482` |
| asset_definition_id | uuid | FK → asset_definitions, not null | |
| serial_number | text | null, unique when not null | |
| status | enum — see §4.1 | not null, default `registered` | never patched directly; only via domain operations |
| current_location_id | uuid | FK → locations, not null | |
| current_holder_user_id | uuid | FK → users, null | set while `issued` |
| project_id | uuid | FK → projects, null | optional tag (FR-INV-09) |
| condition_note | text | null | free text, sanitized on output |
| created_by / updated_by | uuid | FK → users | |
| created_at / updated_at | timestamptz | not null | |
| deleted_at | timestamptz | null | soft-archive (FR-INV-05); distinct from `retired`/`disposed` status, which are lifecycle states, not deletion |
| search_vector | tsvector | generated column | includes serial number, status, denormalized location path, holder name (§9.1) |

### 3.10 `inventory_items` (quantity-based stock line)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| asset_definition_id | uuid | FK → asset_definitions, not null | |
| location_id | uuid | FK → locations, not null | |
| unit | text | not null | e.g. "pcs", "m", "g" |
| quantity_on_hand | integer | not null, check `>= 0`, default 0 | **derived/maintained value** — see §8.2 for the consistency mechanism; never written directly outside the transaction service |
| reorder_threshold | integer | null | drives `low_stock` derived flag |
| created_at / updated_at | timestamptz | not null | |
| deleted_at | timestamptz | null | |

Unique constraint: `(asset_definition_id, location_id)` — one stock line per catalog item per location; receiving more stock of the same part at the same location adjusts the existing line via a transaction, it does not create a duplicate row.

### 3.11 `inventory_transactions` (append-only ledger)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| inventory_item_id | uuid | FK → inventory_items, not null | |
| type | enum(`receive`,`issue`,`consume`,`return`,`adjust`,`transfer_out`,`transfer_in`,`reconciliation`,`dispose`) | not null | |
| quantity_delta | integer | not null | signed; sum of all deltas for an item = `quantity_on_hand` |
| reason | text | required for `adjust`/`reconciliation`/`dispose`, optional otherwise | |
| related_location_id | uuid | FK → locations, null | source/destination for transfer types |
| project_id | uuid | FK → projects, null | optional consumption tagging |
| actor_user_id | uuid | FK → users, not null | |
| created_at | timestamptz | not null | |

No `updated_at`, no `deleted_at` — this table is never updated or deleted at the application-role level (System Instructions §18/§20). A mistaken transaction is corrected by inserting a compensating transaction, never by editing history.

### 3.12 `checkouts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| asset_instance_id | uuid | FK → asset_instances, not null | |
| held_by_user_id | uuid | FK → users, not null | |
| checked_out_by_user_id | uuid | FK → users, not null | may differ from holder (e.g. a lead checks something out to a member) |
| checked_out_at | timestamptz | not null | |
| checked_in_at | timestamptz | null | null while active |
| checked_in_by_user_id | uuid | FK → users, null | |
| condition_at_checkin | text | null | |
| expected_return_at | timestamptz | null | Phase 2 due-date hook; nullable, unused by MVP UI logic |

Partial unique index: `UNIQUE (asset_instance_id) WHERE checked_in_at IS NULL` — this is the database-level guarantee that makes double-issue structurally impossible (§8.1), independent of application logic correctness.

### 3.13 `movement_events` (transfer / location history)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| target_type | enum(`asset_instance`,`inventory_item`) | not null | polymorphic target |
| target_id | uuid | not null | |
| from_location_id | uuid | FK → locations, null | null on initial registration |
| to_location_id | uuid | FK → locations, not null | |
| moved_by_user_id | uuid | FK → users, not null | |
| moved_at | timestamptz | not null | |
| reason | text | null | |

Append-only; this is the location-history ledger required by System Instructions §9.

### 3.14 `reservations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| target_type | enum(`asset_instance`,`inventory_item`) | not null | |
| target_id | uuid | not null | |
| reserved_for_user_id | uuid | FK → users, not null | |
| requested_by_user_id | uuid | FK → users, not null | |
| quantity | integer | null | set for `inventory_item` reservations only |
| status | enum(`active`,`fulfilled`,`cancelled`,`expired`) | not null, default `active` | |
| expires_at | timestamptz | null | if set, worker job auto-expires (ADR-008) |
| created_at / updated_at | timestamptz | not null | |

### 3.15 `asset_relationships`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| parent_asset_id | uuid | FK → asset_instances, not null | |
| child_asset_id | uuid | FK → asset_instances, not null | |
| relationship_type | enum(`contains`,`mounted_on`,`subsystem_of`,`spare_for`) | not null | |
| created_by | uuid | FK → users | |
| created_at | timestamptz | not null | |

Constraint: `parent_asset_id <> child_asset_id`; DAG validity (no cycles) is enforced at the service layer via a graph-reachability check inside the write transaction before insert — not enforceable as a simple DB constraint given arbitrary depth.

### 3.16 `attachments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| target_type | enum(`asset_instance`,`inventory_item`) | not null | |
| target_id | uuid | not null | |
| storage_key | text | not null, unique | UUID-based object key in MinIO (ADR-006) |
| original_filename | text | not null | display only, never trusted for type inference |
| declared_mime_type | text | not null | as sent by client, display only, never trusted |
| detected_mime_type | text | null | filled in after signature inspection |
| size_bytes | bigint | not null | |
| status | enum(`pending_scan`,`available`,`quarantined`,`failed`) | not null, default `pending_scan` | |
| uploaded_by_user_id | uuid | FK → users, not null | |
| uploaded_at | timestamptz | not null | |
| deleted_at | timestamptz | null | soft delete (FR-FILE-02) |

Only `status = 'available'` attachments are ever returned by the download endpoint, regardless of caller role (§10).

### 3.17 `projects` (lightweight tag, not a project-management entity)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | not null, unique | |
| is_active | boolean | not null, default true | |
| created_at | timestamptz | not null | |

Deliberately minimal, per PRD §5 Non-Goals — this exists solely so assets/transactions can be tagged for reporting (U12), not to manage project workflows.

### 3.18 `audit_log`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | bigint | PK, generated always as identity | monotonic, cheap append |
| actor_user_id | uuid | FK → users, null | null = system-initiated (e.g. auto-expiry job) |
| action | text | not null | e.g. `asset.checked_out`, `user.role_changed` — closed vocabulary maintained in `audit` module |
| target_type | text | not null | |
| target_id | uuid | null | null for actions with no single target (e.g. `auth.login_failed`) |
| before_state | jsonb | null | |
| after_state | jsonb | null | |
| session_id | uuid | null | |
| ip_address | inet | null | |
| user_agent | text | null | |
| created_at | timestamptz | not null, default now() | |

**Database grant:** the `nest_app` role has `SELECT, INSERT` only on `audit_log`. No `UPDATE`, no `DELETE`. This is enforced at the Postgres grant level, verified by an automated security test that attempts both as `nest_app` and asserts failure (System Instructions §46).

### 3.19 `security_settings` (single-row org configuration)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | integer | PK, check `id = 1` | enforces single row |
| require_2fa_for_viewer | boolean | not null, default false | admin-editable, step-up gated |
| session_idle_timeout_minutes | integer | not null, default 45 | |
| session_absolute_lifetime_hours | integer | not null, default 12 | |
| large_reconciliation_threshold | integer | not null | triggers step-up per PRD §14.6 |
| updated_by | uuid | FK → users, null | |
| updated_at | timestamptz | not null | |

---

## 4. State Machines

### 4.1 Asset Instance Lifecycle

States: `registered, available, reserved, issued, damaged, under_repair, lost, retired, disposed`

| From | To | Trigger (domain operation) | Allowed roles | Guard conditions |
|---|---|---|---|---|
| — | `registered` | Register asset | contributor+ | new record only |
| `registered` | `available` | Confirm/store asset | contributor+ | location assigned |
| `available` | `reserved` | Create reservation | contributor+ | no active checkout exists |
| `reserved` | `available` | Cancel/expire reservation | contributor+ / system (worker) | |
| `reserved`, `available` | `issued` | Check-out | contributor+ | no existing open `checkouts` row for this asset (DB partial-unique enforced, §3.12) |
| `issued` | `available` | Check-in (no condition issue) | contributor+ | |
| `issued` | `damaged` | Check-in with damage flag / report damage | contributor+ | |
| `available` | `damaged` | Report damage | contributor+ | |
| `available` | `lost` | Report loss | contributor+ | |
| `damaged` | `under_repair` | Begin repair | stores_manager+ | |
| `under_repair` | `available` | Repair complete | stores_manager+ | |
| `under_repair` | `retired` | Repair abandoned | stores_manager+ | |
| `available`, `damaged`, `lost` | `retired` | Retire | stores_manager/admin | reason required |
| `retired` | `disposed` | Dispose | stores_manager/admin | reason + date required, step-up if configured as large/high-value (see §12.3) |

Any transition not listed above is rejected server-side with an explicit `INVALID_STATE_TRANSITION` error — there is no generic "set status" endpoint (System Instructions §8). Each transition is its own domain operation (its own endpoint or command), each independently authorized and independently audited.

### 4.2 Inventory Transaction Types (quantity items — not a status machine, a signed ledger)

| Type | Effect on `quantity_on_hand` | Typical actor | Notes |
|---|---|---|---|
| `receive` | + | contributor+ | procurement intake |
| `issue` | − | contributor+ | quantity checked out/consumed by a member for use |
| `consume` | − | contributor+ | used up (vs. issued and expected back) |
| `return` | + | contributor+ | reverses an `issue` |
| `adjust` | ± | stores_manager+ | requires reason |
| `transfer_out` / `transfer_in` | − / + | contributor+ | paired transactions across two `inventory_item` rows (source/destination), same DB transaction |
| `reconciliation` | ± | stores_manager+ | requires reason; large deltas (≥ `security_settings.large_reconciliation_threshold`) require step-up |
| `dispose` | − | stores_manager/admin | |

`low_stock` is never a stored column on `inventory_items` for the alerting logic — it is computed as `quantity_on_hand <= reorder_threshold` at query time, so it can never drift out of sync with the ledger.

### 4.3 Reservation Lifecycle

`active → fulfilled` (converted into a checkout / issue transaction), `active → cancelled` (manual), `active → expired` (worker sweep on `expires_at`). Terminal states are not re-openable; a new reservation is created instead.

### 4.4 Attachment Lifecycle

`pending_scan → available` (clean AV result) · `pending_scan → quarantined` (detection) · `pending_scan → failed` (scanner error, retried by worker up to a bounded retry count, then surfaced to the uploader as failed) · `available → (soft) deleted` (explicit delete action, any status can be soft-deleted by an authorized actor, but `quarantined`/`failed` files are never downloadable regardless of delete state).

---

## 5. Authorization Design

### 5.1 Role Capability Matrix (MVP, static — backs the `permissions`/`role_permissions` seam described in §3.6)

| Capability | viewer | contributor | stores_manager | admin |
|---|---|---|---|---|
| Read catalog/inventory/locations (non-restricted) | ✔ | ✔ | ✔ | ✔ |
| View own checkouts/reservations | ✔ | ✔ | ✔ | ✔ |
| Create/edit asset & inventory records | | ✔ | ✔ | ✔ |
| Check-out / check-in / transfer | | ✔ | ✔ | ✔ |
| Upload attachments | | ✔ | ✔ | ✔ |
| Create reservations | | ✔ | ✔ | ✔ |
| Report damage/loss | | ✔ | ✔ | ✔ |
| Manage locations | | | ✔ | ✔ |
| Quantity `adjust`/`reconciliation` | | | ✔ | ✔ |
| Repair-status transitions | | | ✔ | ✔ |
| Retire / dispose | | | ✔ | ✔ |
| Soft-delete/archive | | | ✔ | ✔ |
| Hard delete | | | | ✔ (step-up) |
| User management / role changes | | | | ✔ (step-up) |
| Security settings | | | | ✔ (step-up) |
| Full audit log access | | | | ✔ |
| Report generation/download | | | | ✔ |

### 5.2 Two-Layer Check on Every Protected Endpoint

1. **`RolesGuard`** — role-level: does this role have the capability at all (table above)? Runs first, cheap, no DB query (static table in code).
2. **`PolicyGuard`** — resource-level: for endpoints addressed by ID (`/assets/:id`, `/attachments/:id/download`, etc.), does *this* resource fall within what the caller may act on? MVP resource-level rules are narrow (mainly: is the record soft-deleted/archived? is the attachment `available`? does the actor own this session/checkout for self-service actions like "cancel my own reservation"?) — the PRD does not require category-scoped visibility in MVP (§7.2 marks that Phase 2), but the guard exists and runs on every ID-addressed route now, so Phase 2's scoped rules are a data/config change, not a new architectural layer. This directly satisfies the IDOR requirement in PRD §14.3 and System Instructions §13 ("a user requesting `/assets/123` must be authorized to view asset 123").

Both guards run server-side, before the handler, on every non-public route. The explicit public-route list (§7) is the only exception.

### 5.3 Field-Level Write Protection

Every write endpoint has an explicit request DTO listing only the fields that role may set. Server-controlled fields (`id`, `status`, `created_by`, `current_holder_user_id`, `role` on `users`, `quantity_on_hand`) never appear in any client-facing DTO — they are set only by domain-operation service methods, never by generic field assignment. Unknown fields in a request body are rejected (`400`), not silently dropped, closing the mass-assignment class of bug at the framework validation layer (ADR-009).

---

## 6. API Design

Base path: `/api/v1`. All responses use the standard error envelope from ADR-009. All list endpoints are paginated (`page`, `page_size`, capped max page size) and return `{ items, total, page, page_size }`.

### 6.1 Auth (`/auth`)

| Method & Path | Auth | Roles | Purpose |
|---|---|---|---|
| POST `/auth/register` | public | — | creates `viewer` account (or disabled if invite-only — open item, see §17) |
| POST `/auth/login` | public | — | credential check → 2FA challenge if enrolled → session |
| POST `/auth/2fa/verify` | partial (pending session) | — | completes login |
| POST `/auth/2fa/enroll` | session | self | begins TOTP enrollment, returns provisioning URI + recovery codes (shown once) |
| POST `/auth/logout` | session | self | revokes current session |
| GET `/auth/sessions` | session | self | list own active sessions (FR-AUTH-05) |
| DELETE `/auth/sessions/:id` | session | self | revoke a specific session |
| POST `/auth/password-reset/request` | public | — | generic response regardless of email existence |
| POST `/auth/password-reset/confirm` | public (token) | — | consumes token, invalidates existing sessions |
| POST `/auth/step-up` | session | self | re-verify password/2FA, sets `step_up_verified_at` |

### 6.2 Users & Roles (`/users`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/users` | admin | paginated, filterable by role/active |
| GET `/users/:id` | admin, or self | |
| PATCH `/users/:id/role` | admin (step-up) | audited, cannot target self |
| POST `/users/:id/deactivate` | admin (step-up) | revokes all sessions immediately |
| POST `/users/:id/reactivate` | admin (step-up) | |

### 6.3 Locations (`/locations`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/locations` | viewer+ | tree or flat, `?parent_id=` for children |
| GET `/locations/:id` | viewer+ | includes breadcrumb |
| POST `/locations` | stores_manager+ | |
| PATCH `/locations/:id` | stores_manager+ | rejects a move that creates a cycle |
| POST `/locations/:id/archive` | stores_manager+ | soft — refuses if active children/contents exist |

### 6.4 Catalog (`/asset-definitions`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/asset-definitions` | viewer+ | |
| GET `/asset-definitions/:id` | viewer+ | |
| POST `/asset-definitions` | contributor+ | |
| PATCH `/asset-definitions/:id` | contributor+ | diffed into audit log |

### 6.5 Individually Tracked Assets (`/assets`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/assets` | viewer+ | filterable, respects visibility rules |
| GET `/assets/:id` | viewer+ | includes status, location, holder, relationship summary |
| POST `/assets` | contributor+ | creates in `registered`, allow-listed fields only |
| PATCH `/assets/:id` | contributor+ | metadata only, never `status`/`current_holder` |
| GET `/assets/:id/history` | viewer+ | merged timeline: movement, checkouts, transactions, audit refs |
| POST `/assets/:id/checkout` | contributor+ | domain operation, §4.1 |
| POST `/assets/:id/checkin` | contributor+ | domain operation |
| POST `/assets/:id/transfer` | contributor+ | domain operation |
| POST `/assets/:id/report-damage` | contributor+ | |
| POST `/assets/:id/report-loss` | contributor+ | |
| POST `/assets/:id/repair/start` | stores_manager+ | |
| POST `/assets/:id/repair/complete` | stores_manager+ | |
| POST `/assets/:id/retire` | stores_manager/admin | reason required |
| POST `/assets/:id/dispose` | stores_manager/admin | reason required, step-up if above threshold |
| POST `/assets/:id/archive` | stores_manager/admin | soft delete |
| DELETE `/assets/:id` | admin (step-up) | hard delete, reason required, only permitted per PRD FR-INV-05 |

### 6.6 Quantity Inventory (`/inventory-items`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/inventory-items` | viewer+ | |
| GET `/inventory-items/:id` | viewer+ | includes recent transaction slice |
| POST `/inventory-items` | contributor+ | creates the stock line at `quantity_on_hand = 0`; initial stock added via a `receive` transaction in the same request, not a raw quantity field |
| GET `/inventory-items/:id/transactions` | viewer+ | paginated ledger |
| POST `/inventory-items/:id/transactions` | contributor+ (stores_manager+ for `adjust`/`reconciliation`/`dispose`) | body: `{ type, quantity_delta, reason?, related_location_id?, project_id? }` — see §8.2 for the write path |
| POST `/inventory-items/:id/transfer` | contributor+ | paired `transfer_out`/`transfer_in` |

### 6.7 Reservations (`/reservations`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/reservations` | viewer+ | own, or all for contributor+ |
| POST `/reservations` | contributor+ | |
| POST `/reservations/:id/cancel` | contributor+ (self) or stores_manager+ | |

### 6.8 Relationships (`/assets/:id/relationships`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/assets/:id/relationships` | viewer+ | children + parents |
| POST `/assets/:id/relationships` | contributor+ | body: `{ child_asset_id, relationship_type }`, cycle-checked |
| DELETE `/assets/:id/relationships/:relId` | contributor+ | |

### 6.9 Attachments (`/attachments`)

| Method & Path | Roles | Notes |
|---|---|---|
| POST `/attachments` | contributor+ | multipart upload, `{ target_type, target_id, file }` |
| GET `/attachments?target_type=&target_id=` | viewer+ | metadata list only (no bytes) |
| GET `/attachments/:id/download` | viewer+ | proxy stream, only if `status = available`; audited |
| DELETE `/attachments/:id` | uploader, or stores_manager+ | soft delete |

### 6.10 Search & Dashboard

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/search` | viewer+ | `q`, plus structured filters listed in §9.1 |
| GET `/dashboard` | viewer+ | response shape varies by role per PRD §13 widget table |

### 6.11 Reports (`/reports`)

| Method & Path | Roles | Notes |
|---|---|---|
| POST `/reports/generate` | admin | body: `{ month }`, returns a report handle; synchronous if fast, else enqueued (ADR-008) |
| GET `/reports/:id/download?format=xlsx|pdf` | admin | proxy stream, audited |

### 6.12 Audit (`/audit`)

| Method & Path | Roles | Notes |
|---|---|---|
| GET `/audit` | admin | filters: actor, target_type, action, date range; paginated |

### 6.13 Health (`/health`)

| Method & Path | Auth | Notes |
|---|---|---|
| GET `/health/live` | public | process up |
| GET `/health/ready` | public | DB/Redis/MinIO reachability, no sensitive detail in response |

---

## 7. Public Route List (Exhaustive)

Per PRD §7.2 and System Instructions §11, the *only* routes reachable without an authenticated session are:

`POST /auth/register` (if enabled — see §17), `POST /auth/login`, `POST /auth/2fa/verify`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `GET /health/live`, `GET /health/ready`.

This list is maintained as a single explicit array checked by the global auth guard — a route is authenticated by default and must be deliberately excepted, not the reverse.

---

## 8. Concurrency & Transaction Design

### 8.1 Check-Out Race Safety (PRD FR-INV-06, System Instructions §47 acceptance gate)

The guarantee against double-issue is enforced at the database level, not application logic: the partial unique index `UNIQUE (asset_instance_id) WHERE checked_in_at IS NULL` on `checkouts` (§3.12) means two concurrent check-out requests for the same asset cannot both succeed — the second insert fails with a constraint violation, which the service layer translates into a clean `ASSET_ALREADY_ISSUED` domain error. The asset's `status` column transition to `issued` happens in the same DB transaction as the `checkouts` insert, so status and the ledger of who holds it can never disagree.

### 8.2 Quantity Consistency (PRD §20, System Instructions §20)

`inventory_items.quantity_on_hand` is maintained, not purely computed-on-read, for performance (avoiding a `SUM()` over the full ledger on every read), but it is **only ever updated inside the same transaction that inserts the corresponding `inventory_transactions` row**, using `SELECT ... FOR UPDATE` on the `inventory_items` row to serialize concurrent writers to the same stock line. The check constraint `quantity_on_hand >= 0` is the backstop: an `issue`/`consume`/`transfer_out` that would drive quantity negative fails the transaction outright rather than silently clamping to zero. A periodic reconciliation job (or an admin-triggered one) can independently recompute `SUM(quantity_delta)` from the ledger and compare against the stored value as a data-integrity check — any mismatch is itself an alertable condition, never silently auto-corrected.

### 8.3 Transfers

A transfer is one DB transaction containing: (a) the entity's location update, (b) a `movement_events` insert, and — for `inventory_item` transfers — (c) the paired `transfer_out`/`transfer_in` ledger rows. All three commit together or none do.

### 8.4 Role Changes & Other Multi-Record Transitions

Role changes, deactivation, and reconciliation each wrap their state change + audit-log insert in one transaction (System Instructions §19: "a successful modification without its audit record is a failed operation" — enforced literally by transactional atomicity, not by convention).

---

## 9. Search & Indexing Design

### 9.1 Full-Text Search

`asset_definitions.search_vector` and `asset_instances.search_vector` are Postgres **generated `tsvector` columns**, GIN-indexed, combining: name, manufacturer, part number, description (catalog level), and serial number, status label, current location's denormalized path, current holder's display name (instance level). `inventory_items` search relies on its parent `asset_definitions` vector plus its own location.

Structured filters (status, category, location subtree, project, date range) are applied as ordinary indexed `WHERE` clauses combined with the `@@` full-text match, not layered on top of it in application code — this keeps the whole query plannable by Postgres in one pass, which is how the <500ms target (PRD §12, §27) is met at the stated catalog scale (~50,000 rows) without an external search engine.

### 9.2 Location Subtree Filtering

`locations.path_cache` (an `ltree` column, or an application-maintained materialized ancestor-ID array if `ltree` is unavailable) lets "everything under Warehouse A" resolve as an indexed prefix/containment query instead of a recursive CTE per request. The value is recomputed by the location service whenever a node's parent changes, inside the same transaction as that change.

### 9.3 Access-Scoped Results

The search and list endpoints apply role/visibility filtering **inside the SQL query** (e.g., excluding soft-deleted/archived rows for non-privileged roles; in Phase 2, excluding restricted-category rows for unauthorized roles) — never by fetching broad results and filtering client-side, per PRD §12 ("never retrieve restricted data first and hide it only in the frontend").

---

## 10. Attachment Pipeline Design

```
1. Client → POST /attachments (multipart) → backend
2. Backend: validate size limit, MIME allow-list, read first bytes for
   signature (magic-byte) check → reject immediately if any check fails
3. Backend: write object to MinIO under a UUID key; insert `attachments`
   row with status = pending_scan (same transaction as the DB insert;
   object write happens first, DB row references a key that either
   becomes valid or is orphaned-and-cleaned-up by a periodic sweep if
   the DB insert fails)
4. Backend: enqueue an av-scan job (BullMQ) referencing the attachment id
5. Worker: stream object from MinIO to clamd
     - clean   → attachments.status = available, detected_mime_type set
     - infected → attachments.status = quarantined, audit event written,
                  object retained (not deleted) for admin review
     - scanner error → status stays pending_scan, job retried with backoff
                  up to a bounded count, then attachments.status = failed
6. GET /attachments/:id/download → authz check → audit event →
   only serves bytes if status == available, else 404/403 (no
   distinction that would let a caller infer *why* a file is unavailable
   beyond "not available" — avoids leaking scan-result information to
   non-privileged callers)
```

This directly implements System Instructions §21 (validate signatures, never trust extension/Content-Type, UUID filenames, no public bucket, download requires authorization) and §41 (AV/storage failure degrades to a pending/retry state, never blocks core inventory operations — check-out/check-in/registration do not depend on any attachment's scan status).

---

## 11. Audit Logging Design

### 11.1 Write Path

Every domain-operation service method that changes state calls the shared `AuditService.record(...)` **inside the same DB transaction** as the state change (not after commit, not fire-and-forget) — this is what makes "a modification without its audit record is a failed operation" (System Instructions §19) a transactional guarantee rather than an aspiration. If the audit insert fails, the whole transaction rolls back, including the state change.

### 11.2 Closed Action Vocabulary

`audit_log.action` values are a maintained enum-like constant set owned by the `audit` module (not free-form strings scattered across other modules), covering at minimum every event category in PRD §17.2: authentication events, inventory create/modify/archive/delete, quantity transactions, movement (checkout/checkin/transfer/reservation lifecycle), assignment (member/project), file events, access-control events (role/permission/user lifecycle), and admin events (security settings, bulk operations).

### 11.3 Query Design

`GET /audit` supports filtering by actor, target_type, action, and date range with pagination, backed by indexes on `(actor_user_id, created_at)`, `(target_type, target_id)`, and `(action, created_at)`.

---

## 12. Session, Authentication & Step-Up Design

### 12.1 Session Token Handling

The value stored client-side (cookie) is a high-entropy random token; the value stored server-side in `sessions.id` is either the same token (if the table is not otherwise exposed) or a SHA-256 hash of it — hashing is preferred so that a read-only DB leak does not directly yield usable session tokens, mirroring how password-reset tokens are already handled (PRD §14.5). This is a deliberate hardening choice beyond the PRD's literal minimum, consistent with System Instructions §26's "never weaken a security requirement merely to simplify implementation" running the other direction — strengthening where cheap to do so.

### 12.2 Login Sequence

1. `POST /auth/login` with email+password.
2. On invalid credentials: increment `failed_login_count`, apply progressive delay/lock per FR-AUTH-04, return the generic `INVALID_CREDENTIALS` error regardless of whether the email exists.
3. On valid credentials, if `totp_enabled`: issue a short-lived **pending** session state (not a full session) and require `POST /auth/2fa/verify`.
4. On valid TOTP (or valid recovery code, single-use, marked consumed): issue the full session, regenerate the session identifier (never reuse the pending one), reset `failed_login_count`.
5. Every step, success or failure, writes an audit event (`auth.login_succeeded` / `auth.login_failed` / `auth.2fa_verified` / `auth.2fa_failed`).

### 12.3 Step-Up Verification

`POST /auth/step-up` requires re-entering password (+ TOTP if enrolled) and sets `sessions.step_up_verified_at = now()`. The `StepUpGuard` on a protected route checks `now() - step_up_verified_at <= 5 minutes`; if absent or stale, the request is rejected with `STEP_UP_REQUIRED`, and the frontend prompts re-verification before retrying. Routes behind this guard: role/permission changes, user deactivation/deletion, security-setting changes, hard delete, and reconciliation transactions above `security_settings.large_reconciliation_threshold`.

### 12.4 2FA Enforcement Policy

`totp_required` for a given user is computed as `role IN (contributor, stores_manager, admin) OR security_settings.require_2fa_for_viewer`, evaluated at login time — not persisted per-user — so an org-wide policy change (admin toggling viewer enforcement) takes effect immediately for all viewers without a data migration.

---

## 13. Validation & Error Handling Design

- Every write DTO is defined per-endpoint with an explicit allow-list; validation runs before any handler logic executes; unrecognized fields → `400 VALIDATION_ERROR` with a field-level message (never "Invalid input" alone — PRD §25 explicitly requires actionable messages, e.g. "Serial number is required for this asset category").
- Domain-rule violations (invalid state transition, double checkout, negative stock) are distinct error codes (`INVALID_STATE_TRANSITION`, `ASSET_ALREADY_ISSUED`, `INSUFFICIENT_QUANTITY`) mapped to `409 Conflict`, distinguishable from `400` validation failures and `403` authorization failures, so the frontend can render the correct message without string-matching.
- Unhandled exceptions are caught by a global exception filter that logs full detail server-side (with request correlation ID) and returns only `{ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }` to the client — never a stack trace, ORM error, or file path (System Instructions §38).

---

## 14. Non-Functional Design Notes

- **Indexes**, beyond the GIN full-text indexes already noted: `asset_instances(status)`, `asset_instances(current_location_id)`, `inventory_items(location_id)`, `checkouts(held_by_user_id) WHERE checked_in_at IS NULL`, `audit_log(created_at)` for retention sweeps.
- **Pagination** is mandatory and capped (max page size enforced server-side) on every list endpoint, both for performance and as a rate-limiting-adjacent scraping defense (PRD §15).
- **Caching**: none introduced in MVP beyond what Postgres itself provides; dashboard/report queries are re-run per request at this scale (System Instructions §40 — measure before optimizing). If dashboard load becomes measurably slow, the first lever is materialized aggregate queries refreshed on a short interval, not a new caching subsystem — an explicitly deferred decision, not a gap.
- **Retention**: `audit_log` retained ≥24 months (PRD §17.3); a scheduled job flags (does not auto-delete) records older than the configured window pending an explicit retention-policy decision (open item, §17).

---

## 15. Deployment Topology (Design-Level, per ADR-007/010)

```
Internet
   │  :443 (TLS)
   ▼
 Caddy (reverse proxy, security headers)
   │            │
   ▼            ▼
Frontend      Backend API (NestJS) ──┬── PostgreSQL (private network)
(static)      internal port only     ├── MinIO (private network)
                                      ├── Redis (private network) ── Worker (BullMQ)
                                      └── ClamAV daemon (private network)
```

Only Caddy is publicly reachable. All other services communicate over an internal Docker network with no published ports, per ADR-007 and System Instructions §30.

---

## 16. Requirements Traceability Matrix (Representative Sample)

| PRD Requirement | TDS Section(s) |
|---|---|
| FR-AUTH-01–07 (auth, 2FA, reset, throttling, sessions, deactivation, step-up) | §3.2–3.5, §12 |
| FR-INV-01–15 (asset/inventory CRUD, checkout/checkin, transfer, damage/repair/retirement, relationships, reconciliation) | §3.9–3.15, §4, §6.5–6.8, §8 |
| FR-SEARCH-01/02 | §9 |
| FR-DASH-01 | §6.10, §5 (role-scoped) |
| FR-RPT-01–04 | §3.17, §6.11 |
| FR-FILE-01–03 | §3.16, §10 |
| §14 Authentication & Authorization | §5, §12 |
| §17 Audit and Logging Requirements | §3.18, §11 |
| §20 Inventory Integrity (System Instructions) | §3.11, §8.2 |
| §21 Attachments (System Instructions) | §10 |
| §38 Security Acceptance Criteria | §3.18 (grant test), §8.1 (concurrency test), §10 (upload validation) — implementation-time test plan, not this document |

Full bidirectional traceability (every FR-ID and every System Instructions numbered section mapped to a specific table/endpoint/mechanism) is maintained as a living spreadsheet in `docs/architecture/` once implementation begins, seeded from this table.

---

## 17. Open Items Carried Forward (Not Resolved Here)

- Whether self-service registration (`POST /auth/register`) is enabled at all, or accounts are admin-provisioned only — affects §6.1 and §7. Recommend admin-provisioned for a security-sensitive internal tool unless the team confirms otherwise; **flagging for explicit decision before Phase 0 auth work begins**, since it changes an endpoint's existence, not just its behavior.
- Restricted-category visibility (PRD §42 item 2) — the `PolicyGuard` seam (§5.2) is designed to absorb this without rearchitecting, but no `restricted` flag exists on `asset_definitions` yet; add only if the team confirms it's needed before or shortly after MVP launch.
- Audit-log retention/deletion policy specifics (PRD §42 item 3) — schema supports either outcome; the sweep job in §14 flags rather than acts until policy is set.
- `large_reconciliation_threshold` default value — needs a team-specific number, not assumed here.

---

*End of document.*
