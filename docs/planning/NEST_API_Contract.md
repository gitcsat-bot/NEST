# NEST — API Contract

**Inputs:** NEST PRD v1.0, System Instructions, NEST ADR (approved), NEST Technical Design Specification (approved), NEST Database Design (approved)
**Scope note:** This is the authoritative request/response contract for `/api/v1`. It specifies every resource shape, every endpoint's request and response schema, status codes, and error conditions, at a level detailed enough to generate an OpenAPI document and client/server types from directly. It is a specification, not application code — no handlers, no framework decorators, no implementation logic.

---

## 1. Conventions

### 1.1 Base URL & Versioning
All endpoints are rooted at `/api/v1`. Breaking changes get a new version prefix (`/api/v2`); additive changes (new optional fields, new endpoints) do not.

### 1.2 Authentication
Session cookie (`HttpOnly`, `Secure`, `SameSite`), sent automatically by the browser. No `Authorization: Bearer` header in MVP (no external API consumers per PRD Non-Goals). Every endpoint requires a valid, non-revoked session **unless explicitly listed in §2 (Public Endpoints)**.

### 1.3 CSRF
State-changing requests (`POST`/`PATCH`/`PUT`/`DELETE`) require a CSRF token, delivered via a `X-CSRF-Token` header, validated against a value tied to the session (synchronizer pattern), per PRD §15/System Instructions §22. Not repeated per-endpoint below — it applies uniformly to all non-`GET` requests on authenticated routes.

### 1.4 Standard Envelopes

**Success (single resource):** the resource object directly, no wrapper.

**Success (list):**
```
{
  "items": [ ... ],
  "total": <integer>,
  "page": <integer>,
  "page_size": <integer>
}
```
`page` defaults to `1`, `page_size` defaults to `25`, capped at `100` (server-enforced regardless of what the client requests).

**Error:**
```
{
  "error": {
    "code": "<SCREAMING_SNAKE_CASE>",
    "message": "<human-readable, actionable>",
    "field_errors": [ { "field": "serial_number", "message": "Serial number is required for this asset category." } ]  // present only for VALIDATION_ERROR
  }
}
```

### 1.5 Standard Status Codes

| Code | Meaning | When |
|---|---|---|
| 200 | OK | successful read or non-creating write |
| 201 | Created | successful resource creation |
| 204 | No Content | successful action with no response body (e.g., logout) |
| 400 | Bad Request | `VALIDATION_ERROR` — malformed or disallowed fields |
| 401 | Unauthorized | no/invalid/expired session |
| 403 | Forbidden | authenticated but not authorized (role or resource-policy failure), or `STEP_UP_REQUIRED` |
| 404 | Not Found | resource doesn't exist, is soft-deleted and caller lacks visibility, or (for attachments) isn't in `available` status |
| 409 | Conflict | domain-rule violation — invalid state transition, double checkout, insufficient quantity, uniqueness collision |
| 422 | Unprocessable Entity | file upload fails signature/type validation |
| 429 | Too Many Requests | rate limit exceeded |
| 500 | Internal Server Error | unhandled failure; body never contains stack traces or internals |

### 1.6 Common Error Codes

`VALIDATION_ERROR · INVALID_CREDENTIALS · TWO_FACTOR_REQUIRED · TWO_FACTOR_INVALID · ACCOUNT_LOCKED · SESSION_EXPIRED · STEP_UP_REQUIRED · FORBIDDEN · NOT_FOUND · INVALID_STATE_TRANSITION · ASSET_ALREADY_ISSUED · INSUFFICIENT_QUANTITY · LOCATION_CYCLE · RELATIONSHIP_CYCLE · DUPLICATE_SERIAL_NUMBER · FILE_TYPE_REJECTED · FILE_TOO_LARGE · RATE_LIMITED · INTERNAL_ERROR`

### 1.7 Common Field Types Referenced Below

`UUID` (string, RFC 4122) · `ISODateTime` (string, RFC 3339 UTC, e.g. `"2026-08-09T14:30:00Z"`) · `Enum<...>` (one of the listed literal strings).

---

## 2. Public Endpoints (No Session Required)

`POST /auth/login` · `POST /auth/2fa/verify` · `POST /auth/password-reset/request` · `POST /auth/password-reset/confirm` · `GET /health/live` · `GET /health/ready`

`POST /auth/register` is **excluded from this list pending the open item noted in the TDS (§17)** — see §3.1 below.

Every other endpoint in this document requires an authenticated session and is subject to the role column stated for it.

---

## 3. Resource Schemas

Reusable object shapes referenced by multiple endpoints. Fields marked `(internal)` are never present in any request DTO — they are server-set only.

### 3.1 `User`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| email | string | |
| display_name | string | |
| role | Enum<viewer,contributor,stores_manager,admin> | (internal on write) |
| is_active | boolean | (internal on write) |
| totp_enabled | boolean | (internal) |
| created_at | ISODateTime | |
| deactivated_at | ISODateTime \| null | |

`password_hash`, `failed_login_count`, `locked_until` are never serialized in any response, at any role.

### 3.2 `Session`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| created_at | ISODateTime | |
| last_seen_at | ISODateTime | |
| expires_at | ISODateTime | |
| ip_address | string | |
| user_agent | string | |
| is_current | boolean | computed: true if this is the session making the request |

### 3.3 `Location`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | |
| type | Enum<warehouse,room,cabinet,rack,shelf,bin,box,position,other> | |
| parent_location_id | UUID \| null | |
| description | string \| null | |
| is_active | boolean | |
| breadcrumb | string[] | computed, e.g. `["Warehouse A", "Electronics Room", "Rack 3"]`, included on `GET /locations/:id` only |

### 3.4 `AssetDefinition`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | required |
| category | string | required |
| manufacturer | string \| null | |
| part_number | string \| null | |
| datasheet_url | string \| null | |
| description | string \| null | |
| created_at / updated_at | ISODateTime | |

### 3.5 `AssetInstance`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| display_code | string | (internal, server-generated) |
| asset_definition | AssetDefinition (summary: id, name, category) | expanded on read |
| serial_number | string \| null | |
| status | Enum — see TDS §4.1 | (internal — set only via lifecycle endpoints, §7.2–7.10) |
| current_location | Location (summary: id, name, breadcrumb) | expanded on read |
| current_holder | User (summary: id, display_name) \| null | (internal) |
| project_id | UUID \| null | |
| condition_note | string \| null | |
| created_at / updated_at | ISODateTime | |

### 3.6 `InventoryItem`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| asset_definition | AssetDefinition (summary) | |
| location | Location (summary) | |
| unit | string | |
| quantity_on_hand | integer | (internal — never client-settable directly) |
| reorder_threshold | integer \| null | |
| low_stock | boolean | computed: `quantity_on_hand <= reorder_threshold` |
| created_at / updated_at | ISODateTime | |

### 3.7 `InventoryTransaction`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| type | Enum — see TDS §4.2 | |
| quantity_delta | integer | signed |
| reason | string \| null | |
| related_location | Location (summary) \| null | |
| project_id | UUID \| null | |
| actor | User (summary) | |
| created_at | ISODateTime | |

### 3.8 `Checkout`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| asset_instance_id | UUID | |
| held_by | User (summary) | |
| checked_out_by | User (summary) | |
| checked_out_at | ISODateTime | |
| checked_in_at | ISODateTime \| null | |
| checked_in_by | User (summary) \| null | |
| condition_at_checkin | string \| null | |

### 3.9 `MovementEvent`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| target_type | Enum<asset_instance,inventory_item> | |
| target_id | UUID | |
| from_location | Location (summary) \| null | |
| to_location | Location (summary) | |
| moved_by | User (summary) | |
| moved_at | ISODateTime | |
| reason | string \| null | |

### 3.10 `Reservation`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| target_type | Enum<asset_instance,inventory_item> | |
| target_id | UUID | |
| reserved_for | User (summary) | |
| requested_by | User (summary) | |
| quantity | integer \| null | required for `inventory_item` targets |
| status | Enum<active,fulfilled,cancelled,expired> | (internal) |
| expires_at | ISODateTime \| null | |

### 3.11 `AssetRelationship`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| parent_asset_id | UUID | |
| child_asset_id | UUID | |
| relationship_type | Enum<contains,mounted_on,subsystem_of,spare_for> | |
| created_at | ISODateTime | |

### 3.12 `Attachment`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| target_type | Enum<asset_instance,inventory_item> | |
| target_id | UUID | |
| original_filename | string | display only |
| detected_mime_type | string \| null | |
| size_bytes | integer | |
| status | Enum<pending_scan,available,quarantined,failed> | (internal) |
| uploaded_by | User (summary) | |
| uploaded_at | ISODateTime | |

`storage_key` is never serialized to any client — the download endpoint resolves it server-side.

### 3.13 `AuditLogEntry`
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| actor | User (summary) \| null | null = system-initiated |
| action | string | closed vocabulary, e.g. `"asset.checked_out"` |
| target_type | string | |
| target_id | UUID \| null | |
| before_state | object \| null | |
| after_state | object \| null | |
| ip_address | string \| null | |
| created_at | ISODateTime | |

---

## 4. Auth (`/auth`)

### `POST /auth/login`
Public. Rate-limited (strict tier, §11).

**Request**
| Field | Type | Required |
|---|---|---|
| email | string | yes |
| password | string | yes |

**Response `200`** (if no 2FA enrolled): `{ "user": User, "session": Session }`, sets session cookie.
**Response `200`** (if 2FA enrolled): `{ "two_factor_required": true, "pending_token": string }` — no session cookie set yet; `pending_token` is short-lived and single-purpose, submitted to `/auth/2fa/verify`.
**Errors:** `401 INVALID_CREDENTIALS` (generic, identical for wrong password and nonexistent email) · `403 ACCOUNT_LOCKED` · `429 RATE_LIMITED`

### `POST /auth/2fa/verify`
Public (requires a valid `pending_token` from login). Rate-limited (strict tier).

**Request**
| Field | Type | Required |
|---|---|---|
| pending_token | string | yes |
| code | string | yes | 6-digit TOTP, or a recovery code |

**Response `200`:** `{ "user": User, "session": Session }`, sets session cookie.
**Errors:** `401 TWO_FACTOR_INVALID` · `401 SESSION_EXPIRED` (pending_token expired) · `429 RATE_LIMITED`

### `POST /auth/2fa/enroll`
Auth required (self).

**Response `200`:** `{ "provisioning_uri": string, "recovery_codes": string[] }` — recovery codes returned **once**, never retrievable again (PRD §14.2).

### `POST /auth/logout`
Auth required. **Response `204`.** Revokes current session.

### `GET /auth/sessions`
Auth required (self). **Response `200`:** `Session[]` (not the paginated envelope — bounded, per-user list).

### `DELETE /auth/sessions/:id`
Auth required (self; a session can only revoke its own user's other sessions). **Response `204`.**
**Errors:** `404 NOT_FOUND` (session doesn't belong to caller — returned as 404, not 403, to avoid confirming another user's session ID exists)

### `POST /auth/password-reset/request`
Public. Rate-limited.

**Request:** `{ "email": string }`
**Response `200`:** `{ "message": "If an account exists for this email, a reset link has been sent." }` — identical response regardless of whether the email exists (PRD §14.5).

### `POST /auth/password-reset/confirm`
Public.

**Request:** `{ "token": string, "new_password": string }`
**Response `200`:** `{ "message": "Password updated." }` — invalidates all existing sessions for the user.
**Errors:** `400 VALIDATION_ERROR` (token invalid/expired/used, or password policy failure — message does not distinguish "invalid" from "expired" to avoid token-guessing signal)

### `POST /auth/step-up`
Auth required (self).

**Request:** `{ "password": string, "totp_code": string | null }`
**Response `200`:** `{ "step_up_verified_until": ISODateTime }`
**Errors:** `401 INVALID_CREDENTIALS` · `401 TWO_FACTOR_INVALID`

---

## 5. Users & Roles (`/users`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /users` | admin | query: `role?, is_active?, page?, page_size?` | paginated `User[]` |
| `GET /users/:id` | admin, or self | — | `User` |
| `PATCH /users/:id/role` | admin (+step-up) | `{ "role": Enum<...> }` | `User` — `403 STEP_UP_REQUIRED` if not fresh; `400 VALIDATION_ERROR` if `id` equals caller's own id (self-role-change forbidden per PRD §14) |
| `POST /users/:id/deactivate` | admin (+step-up) | `{}` | `User` — revokes all sessions for the target user synchronously before responding |
| `POST /users/:id/reactivate` | admin (+step-up) | `{}` | `User` |

---

## 6. Locations (`/locations`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /locations` | viewer+ | query: `parent_id?, is_active?` | `Location[]` (flat; client composes tree from `parent_location_id`, or use `parent_id` to fetch one level) |
| `GET /locations/:id` | viewer+ | — | `Location` (with `breadcrumb`) |
| `POST /locations` | stores_manager+ | `{ "name": string, "type": Enum<...>, "parent_location_id": UUID \| null, "description": string? }` | `201`, `Location` |
| `PATCH /locations/:id` | stores_manager+ | `{ "name"?, "type"?, "parent_location_id"?, "description"? }` | `Location` — `409 LOCATION_CYCLE` if the new parent would create a cycle |
| `POST /locations/:id/archive` | stores_manager+ | `{}` | `Location` (`is_active: false`) — `409 VALIDATION_ERROR` if active children or active occupants (assets/inventory) still reference it |

---

## 7. Catalog & Individually Tracked Assets

### 7.1 Catalog (`/asset-definitions`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /asset-definitions` | viewer+ | query: `category?, q?, page?, page_size?` | paginated `AssetDefinition[]` |
| `GET /asset-definitions/:id` | viewer+ | — | `AssetDefinition` |
| `POST /asset-definitions` | contributor+ | `{ "name": string, "category": string, "manufacturer"?, "part_number"?, "datasheet_url"?, "description"? }` | `201`, `AssetDefinition` |
| `PATCH /asset-definitions/:id` | contributor+ | any subset of the create fields | `AssetDefinition` — diffed into audit log |

### 7.2 Asset Instances (`/assets`) — CRUD & Read

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /assets` | viewer+ | query: see §7.11 | paginated `AssetInstance[]` |
| `GET /assets/:id` | viewer+ | — | `AssetInstance` |
| `POST /assets` | contributor+ | `{ "asset_definition_id": UUID, "serial_number"?: string, "current_location_id": UUID, "project_id"?: UUID, "condition_note"?: string }` | `201`, `AssetInstance` (status `registered`) — `409 DUPLICATE_SERIAL_NUMBER` if serial already in use |
| `PATCH /assets/:id` | contributor+ | `{ "serial_number"?, "project_id"?, "condition_note"? }` — **never** `status`, `current_holder_user_id`, `current_location_id` (those move only via the domain-operation endpoints below) | `AssetInstance` |
| `GET /assets/:id/history` | viewer+ | query: `page?, page_size?` | paginated union of `MovementEvent`, `Checkout`, and relevant `AuditLogEntry` summaries, sorted by timestamp desc |
| `POST /assets/:id/archive` | stores_manager+ | `{}` | `AssetInstance` (soft-deleted) |
| `DELETE /assets/:id` | admin (+step-up) | `{ "reason": string }` | `204` — hard delete, only permitted per PRD FR-INV-05; `reason` required and audited |

### 7.3 Check-Out / Check-In (`/assets/:id/checkout`, `/checkin`)

`POST /assets/:id/checkout` — contributor+
**Request:** `{ "held_by_user_id": UUID, "expected_return_at"?: ISODateTime }`
**Response `201`:** `Checkout`
**Errors:** `409 ASSET_ALREADY_ISSUED` · `409 INVALID_STATE_TRANSITION` (e.g., asset is `under_repair`)

`POST /assets/:id/checkin` — contributor+
**Request:** `{ "condition"?: Enum<good,damaged,lost>, "condition_note"?: string }`
**Response `200`:** `Checkout` (with `checked_in_at` populated) — if `condition` is `damaged`/`lost`, the asset's status transitions accordingly in the same operation (a single API call, per PRD FR-INV-07's "prompts for condition on return")
**Errors:** `409 INVALID_STATE_TRANSITION` (no open checkout exists)

### 7.4 Transfer (`/assets/:id/transfer`)

`POST /assets/:id/transfer` — contributor+
**Request:** `{ "to_location_id": UUID, "reason"?: string }`
**Response `201`:** `MovementEvent`

### 7.5 Damage / Loss (`/assets/:id/report-damage`, `/report-loss`)

`POST /assets/:id/report-damage` — contributor+
**Request:** `{ "condition_note": string }`
**Response `200`:** `AssetInstance` (status → `damaged`)

`POST /assets/:id/report-loss` — contributor+
**Request:** `{ "condition_note"?: string }`
**Response `200`:** `AssetInstance` (status → `lost`)
**Errors (both):** `409 INVALID_STATE_TRANSITION`

### 7.6 Repair (`/assets/:id/repair/start`, `/repair/complete`)

`POST /assets/:id/repair/start` — stores_manager+
**Request:** `{ "vendor"?: string, "cost_note"?: string }`
**Response `200`:** `AssetInstance` (status → `under_repair`)

`POST /assets/:id/repair/complete` — stores_manager+
**Request:** `{ "outcome": Enum<repaired,unrepairable> }`
**Response `200`:** `AssetInstance` (status → `available` if `repaired`, → `retired` if `unrepairable`)

### 7.7 Retirement / Disposal

`POST /assets/:id/retire` — stores_manager/admin
**Request:** `{ "reason": string }`
**Response `200`:** `AssetInstance` (status → `retired`)

`POST /assets/:id/dispose` — stores_manager/admin (+step-up if configured threshold applies, per TDS §4.1)
**Request:** `{ "reason": string, "disposal_date": ISODateTime }`
**Response `200`:** `AssetInstance` (status → `disposed`)
**Errors (both):** `409 INVALID_STATE_TRANSITION` · `403 STEP_UP_REQUIRED`

### 7.8 Relationships (`/assets/:id/relationships`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /assets/:id/relationships` | viewer+ | — | `{ "parents": AssetRelationship[], "children": AssetRelationship[] }` |
| `POST /assets/:id/relationships` | contributor+ | `{ "child_asset_id": UUID, "relationship_type": Enum<...> }` | `201`, `AssetRelationship` — `409 RELATIONSHIP_CYCLE` if it would create one |
| `DELETE /assets/:id/relationships/:relId` | contributor+ | — | `204` |

### 7.9 Inventory Items (`/inventory-items`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /inventory-items` | viewer+ | query: see §7.11 | paginated `InventoryItem[]` |
| `GET /inventory-items/:id` | viewer+ | — | `InventoryItem` (includes `recent_transactions: InventoryTransaction[]`, last 10) |
| `POST /inventory-items` | contributor+ | `{ "asset_definition_id": UUID, "location_id": UUID, "unit": string, "initial_quantity"?: integer, "reorder_threshold"?: integer }` | `201`, `InventoryItem` — `initial_quantity` (if provided) is recorded as a `receive` transaction in the same operation, never written directly to `quantity_on_hand` |
| `PATCH /inventory-items/:id` | contributor+ | `{ "reorder_threshold"? }` — **never** `quantity_on_hand` | `InventoryItem` |

### 7.10 Inventory Transactions (`/inventory-items/:id/transactions`)

`GET /inventory-items/:id/transactions` — viewer+, paginated `InventoryTransaction[]`

`POST /inventory-items/:id/transactions` — contributor+ for `receive`/`issue`/`consume`/`return`/`transfer_out`; stores_manager+ for `adjust`/`reconciliation`/`dispose` (role check depends on `type`, enforced server-side)
**Request:** `{ "type": Enum<...>, "quantity_delta": integer, "reason"?: string, "related_location_id"?: UUID, "project_id"?: UUID }`
`reason` is required (400 if absent) when `type` is `adjust`, `reconciliation`, or `dispose`.
**Response `201`:** `InventoryTransaction`
**Errors:** `409 INSUFFICIENT_QUANTITY` (would drive `quantity_on_hand` negative) · `403 STEP_UP_REQUIRED` (reconciliation delta magnitude ≥ `large_reconciliation_threshold`)

`POST /inventory-items/:id/transfer` — contributor+
**Request:** `{ "to_location_id": UUID, "quantity": integer, "reason"?: string }`
**Response `201`:** `{ "transfer_out": InventoryTransaction, "transfer_in": InventoryTransaction, "movement_event": MovementEvent }` — creates or reuses the destination `InventoryItem` row for `(asset_definition_id, to_location_id)`.

### 7.11 Shared Query Parameters — `/assets`, `/inventory-items`, `/search`

| Param | Type | Notes |
|---|---|---|
| q | string | full-text query |
| status | Enum (repeatable) | asset instances only |
| category | string | |
| location_id | UUID | includes descendants (subtree, per TDS §9.2) |
| project_id | UUID | |
| holder_id | UUID | asset instances only |
| date_from / date_to | ISODateTime | filters on `created_at` unless the endpoint documents otherwise |
| sort | Enum<name,created_at,updated_at,quantity,status> | |
| sort_dir | Enum<asc,desc> | default `asc` |
| page / page_size | integer | |

---

## 8. Reservations (`/reservations`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `GET /reservations` | viewer+ (own only) / contributor+ (all, with `?all=true`) | query: `status?, target_type?, page?, page_size?` | paginated `Reservation[]` |
| `POST /reservations` | contributor+ | `{ "target_type": Enum<...>, "target_id": UUID, "reserved_for_user_id": UUID, "quantity"?: integer, "expires_at"?: ISODateTime }` | `201`, `Reservation` |
| `POST /reservations/:id/cancel` | contributor+ (self, if `requested_by_user_id` matches) or stores_manager+ | `{}` | `Reservation` (status → `cancelled`) |

---

## 9. Attachments (`/attachments`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `POST /attachments` | contributor+ | multipart form: `target_type`, `target_id`, `file` (PDF/JPEG/PNG/WebP; size-limited server-side) | `201`, `Attachment` (status `pending_scan`) — `422 FILE_TYPE_REJECTED` if signature check fails; `413`/`422 FILE_TOO_LARGE` if over limit |
| `GET /attachments` | viewer+ | query: `target_type, target_id` (both required) | `Attachment[]` (metadata only, no bytes) |
| `GET /attachments/:id/download` | viewer+ | — | binary stream, `Content-Disposition: attachment` — `404 NOT_FOUND` unless `status = available` (identical 404 whether the id doesn't exist, is quarantined, or caller lacks access — no status leaked to unauthorized/non-privileged callers) |
| `DELETE /attachments/:id` | uploader (self) or stores_manager+ | `{}` | `204` — soft delete |

---

## 10. Search, Dashboard, Reports, Audit, Health

### `GET /search`
viewer+. Query params per §7.11, plus `type: Enum<asset_instance,inventory_item,both>` (default `both`).
**Response `200`:** `{ "asset_instances": paginated AssetInstance[], "inventory_items": paginated InventoryItem[] }` (whichever `type` selected; both present if `both`).

### `GET /dashboard`
viewer+. No query params in MVP.
**Response `200`:** shape varies by caller role — all roles receive `totals`, `issued_summary`, `attention_summary` (damaged/lost/under_repair/low_stock counts), `recent_additions`, `recent_movements`, `low_stock_items`, `active_reservations`; `contributor+` additionally receives `recently_modified`; `admin` additionally receives `security_alerts` (failed-login spikes, recent role changes, 2FA non-compliance count). Fields absent for a role are omitted from the response entirely, not returned null (so the frontend cannot accidentally render a privileged widget from a stale client-side check).

### Reports (`/reports`)

| Endpoint | Roles | Request | Response |
|---|---|---|---|
| `POST /reports/generate` | admin | `{ "month": "YYYY-MM" }` | `202` `{ "report_id": UUID, "status": "processing" }` if enqueued to the worker, or `200` with a ready `report_id` if generated synchronously (implementation detail based on generation time, per ADR-008) |
| `GET /reports/:id` | admin | — | `{ "report_id": UUID, "status": Enum<processing,ready,failed>, "month": string }` |
| `GET /reports/:id/download` | admin | query: `format: Enum<xlsx,pdf>` | binary stream — `404` if not ready |

### `GET /audit`
admin only.
Query: `actor_id?, target_type?, action?, date_from?, date_to?, page?, page_size?`
**Response `200`:** paginated `AuditLogEntry[]`.

### Health

`GET /health/live` — public. `200 { "status": "ok" }` always if the process is up.
`GET /health/ready` — public. `200 { "status": "ready" }` or `503 { "status": "not_ready" }`; body never includes connection strings, hostnames, or error detail — only boolean-equivalent readiness.

---

## 11. Rate Limit Tiers

| Tier | Applies to | Limit shape |
|---|---|---|
| Strict | `/auth/login`, `/auth/2fa/verify`, `/auth/password-reset/request` | low fixed ceiling per IP + per account, progressive backoff on repeated failures (PRD FR-AUTH-04) |
| Upload | `POST /attachments` | moderate per-account ceiling, separate from general API tier |
| Search | `/search`, `GET /assets`, `GET /inventory-items` | moderate per-account ceiling, generous enough for normal use, tight enough to blunt bulk scraping |
| General | all other authenticated endpoints | generous per-account ceiling |

Exact numeric thresholds are an implementation-time tuning decision (to be set from expected usage patterns and validated under the Phase 2 load test), not fixed in this contract — the tiering and the requirement that every tier be independently testable (System Instructions §23) is the contractual guarantee.

---

## 12. Non-Serialization Rules (Applies Across All Endpoints)

No response, at any role, ever includes: `password_hash`, `totp_credentials.secret_encrypted` or any raw TOTP secret, recovery codes after initial enrollment display, `password_reset_tokens.token_hash` or any raw token, `sessions.id` in any listing other than the session's own record, `attachments.storage_key`, or any Postgres error text/stack trace. This is enforced by every response DTO being an explicit allow-list projection — no endpoint serializes a raw database row.

---

*End of document.*
