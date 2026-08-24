# NEST — UI/UX Specification

**Inputs:** NEST PRD v1.0, System Instructions, NEST ADR, NEST TDS, NEST Database Design, NEST API Contract (all approved)
**Scope note:** This specifies information architecture, navigation, screen-by-screen layout and behavior, interaction and state patterns, copy/microcopy rules, and accessibility requirements — detailed enough to build the frontend directly from. It contains no code, no component markup, and no visual mockups; layout is described structurally (regions, hierarchy, content) rather than pixel-specified.

---

## 1. Design Intent

NEST is a **utility tool used by occasional, rotating users** (PRD §2: students who touch it a few times a semester, not power users who live in it daily) to answer one question fast — *where is this, and can I take it* — or to record one fact fast — *I took this / I put this back / this is damaged*. The design goal is therefore **recognition over recall, and speed over expressiveness**: every screen should be usable correctly by someone who last used NEST four months ago, without a walkthrough.

This shapes every decision below:
- Consistent, literal action labels (a button that starts a check-out says "Check out," not "Take"), because vocabulary is the only onboarding a returning user gets (System Instructions/PRD tone requirement, and generally good practice for infrequent-use tools).
- Every destructive or hard-to-reverse action gets a confirmation step that states the consequence in plain terms, not a generic "Are you sure?"
- Role differences show up as *what's on the screen*, not as disabled-but-visible controls that require the user to guess why something doesn't work — if a viewer can't check something out, there is no check-out button on their screen, not a greyed-out one (this also avoids a control implying an action the backend would reject anyway, keeping the frontend and API Contract's authorization model honest with each other, per TDS §5).

This is a utility application, not a marketing surface — the design register is clarity and restraint, not visual risk-taking. Where the org later wants a distinct visual identity (a NEST "brand"), that is a skin applied on top of this structure, not a reason to revisit the structure itself.

---

## 2. Design System Foundations

### 2.1 Token Categories (defined here at the decision level; exact hex/rem values are an implementation-time exercise against these constraints, not fixed in this document)

| Token category | Requirement |
|---|---|
| Color | One neutral scale (backgrounds, borders, text) with sufficient steps for light-mode-only MVP (dark mode is not a PRD requirement — not built); one accent color used only for primary actions and focus states, not decoration; four semantic colors — success, warning, danger, info — each meeting WCAG AA contrast against its background at the text sizes used |
| Typography | One typeface family for UI text (a system/humanist sans, optimized for data-dense tables and forms, not a display face — this is a utility, not a landing page); a monospace face reserved specifically for serial numbers, asset display codes (`AST-000482`), and audit-log diff values, so identifiers are visually distinct from prose and unambiguous (no visual confusion between `O`/`0`, `l`/`1`) |
| Spacing | A single 4px-based scale, applied consistently so density is predictable across screens (a data table and a form should feel like the same product) |
| Elevation | Two levels only — resting surface, and raised (modals/dropdowns/toasts) — this is a flat, functional tool, not a layered visual composition |
| Radius | One small radius applied consistently to inputs/buttons/cards; not zero (avoids a harsh "spreadsheet" feel) and not large (avoids a consumer-app feel mismatched to the content density) |
| Motion | Functional only: state transitions (expand/collapse, toast enter/exit, modal open/close) at a short, consistent duration; **no decorative animation**; all motion respects `prefers-reduced-motion` (System Instructions §26) |

### 2.2 Core Components (shared across every screen, specified once here rather than per-screen)

- **Data table** — sortable columns (click header), sticky header on scroll, row-level primary action always in the same rightmost position, empty state and loading state defined once (§7), row density comfortable enough for scanning a list of 50+ items without excessive scrolling on a laptop screen.
- **Status badge** — one visual treatment per `asset_status`/`attachment_status`/`reservation_status` value, using the semantic color tokens consistently (e.g., `available`/`available` = success tone, `damaged`/`lost` = danger tone, `pending_scan`/`under_repair` = warning/neutral tone) — the same status always renders identically everywhere it appears (list row, detail header, history timeline), so a user never has to re-learn what a badge means per screen.
- **Confirmation dialog** — used for every action in §9's "confirm-before-commit" list; states the object, the action, and the consequence in one sentence before the confirm button (e.g., "Retire AST-000482 — SMD Reflow Oven? This removes it from active search results. This can be undone by an admin.").
- **Toast** — confirms the completed action using the same verb the button used (button "Check out" → toast "Checked out"), per the active-voice/consistent-vocabulary principle; auto-dismisses but is also manually dismissible; errors are **not** delivered as toasts (see §8).
- **Breadcrumb** — used for location hierarchy and, on asset detail pages, for parent/child asset relationships; always clickable at every level.
- **Combobox / typeahead** — used for every "pick a location," "pick a user," "pick a catalog item" field, never a plain long `<select>` — these lists can run into the hundreds (locations, catalog) and a flat dropdown fails the speed goal.

---

## 3. Information Architecture & Navigation

### 3.1 Primary Navigation (role-filtered — items not listed for a role are absent, not disabled)

| Nav item | viewer | contributor | stores_manager | admin |
|---|---|---|---|---|
| Dashboard | ✔ | ✔ | ✔ | ✔ |
| Search / Browse | ✔ | ✔ | ✔ | ✔ |
| My Checkouts & Reservations | ✔ | ✔ | ✔ | ✔ |
| Register Asset / Add Stock | | ✔ | ✔ | ✔ |
| Locations | (read-only view under Browse) | (read-only view) | ✔ manage | ✔ manage |
| Reports | | | | ✔ |
| Users | | | | ✔ |
| Audit Log | | | | ✔ |
| Settings | | | | ✔ |

Navigation is a persistent left sidebar on desktop/tablet, collapsing to a bottom tab bar (5-item max, overflow into a "More" sheet) on mobile widths, per the responsive requirement in §10.

### 3.2 Global Elements (present on every authenticated screen)

- **Global search bar** in the top bar, always available (not just on a dedicated search page) — pressing it or a keyboard shortcut jumps straight to the search results screen, since "find a thing fast" is the single most common task (PRD §2).
- **Account menu** (top right): display name, role badge, "My sessions," "Enroll 2FA" / "2FA enabled," Logout.
- **Notification/attention indicator**: a small badge showing count of the user's own overdue/attention items (their active checkouts, their pending reservations about to expire) — not a general system notification feed (Phase 2 concept, PRD §32), just a personal-relevance count.

---

## 4. Screen Inventory

| # | Screen | Roles |
|---|---|---|
| 1 | Login | public |
| 2 | 2FA Verification | public (mid-login) |
| 3 | 2FA Enrollment | all, self-service |
| 4 | Forgot / Reset Password | public |
| 5 | Dashboard | all (role-varied widgets) |
| 6 | Search Results / Browse | all |
| 7 | Asset Instance Detail | all (role-varied actions) |
| 8 | Inventory Item Detail | all (role-varied actions) |
| 9 | Register Asset | contributor+ |
| 10 | Add / Adjust Stock | contributor+ (adjust restricted to stores_manager+) |
| 11 | Check-Out | contributor+ |
| 12 | Check-In | contributor+ |
| 13 | Transfer | contributor+ |
| 14 | Report Damage / Loss | contributor+ |
| 15 | My Checkouts & Reservations | all |
| 16 | Locations Manager | stores_manager+ |
| 17 | Reports | admin |
| 18 | Users Management | admin |
| 19 | Audit Log | admin |
| 20 | Security Settings | admin |

Each is specified below. "Layout" describes structural regions top-to-bottom or left-to-right, not pixel geometry.

---

## 5. Screen Specifications

### 5.1 Login
**Layout:** centered single-column card — NEST name/mark, email field, password field, "Sign in" primary button, "Forgot password?" link below.
**Behavior:** submitting invalid credentials shows one inline error above the form: "That email or password isn't right." (never reveals which field is wrong, matching `INVALID_CREDENTIALS`'s generic contract). On lockout, the message states the account is temporarily locked and roughly when to retry, without security-sensitive detail (e.g., without revealing the exact failed-attempt count). Successful login with 2FA enrolled routes to §5.2; without, routes directly to Dashboard.
**Empty/edge states:** none (form always has the same two fields).

### 5.2 2FA Verification
**Layout:** centered card — "Enter the 6-digit code from your authenticator app," single code input (auto-advances/auto-submits at 6 digits), "Use a recovery code instead" link (reveals a text field), "Back to login."
**Behavior:** wrong code shows inline "That code didn't work — check the time on your device and try again" (TOTP codes are time-based; this is the single most common real cause of failure here, so the message says so). A used-up recovery code shows "This recovery code has already been used."

### 5.3 2FA Enrollment
**Layout:** step 1 — QR code + manual entry key, "I've added this to my app" continue button. Step 2 — code entry to confirm. Step 3 — ten recovery codes displayed with a **prominent, un-dismissable-until-acknowledged** notice: "Save these somewhere safe. They won't be shown again." + a "Download as text file" action + a required checkbox "I've saved these codes" before "Done" is enabled.
**Behavior:** this is the one screen in NEST where the user cannot easily "come back later" for a piece of shown-once data — the design leans on friction deliberately here (System Instructions security-UX intersection), rather than a passive one-time display a user could screenshot-and-forget.

### 5.4 Forgot / Reset Password
**Layout:** request step — email field, submit → generic confirmation screen ("If an account exists for that email, we've sent a reset link.") regardless of outcome, matching the API contract exactly (no UI state ever exists that would let a user infer the email didn't match). Reset step (from emailed link) — new password field, confirm field, live password-requirement checklist (updates as the user types, not just on submit-failure).

### 5.5 Dashboard
**Layout:** a responsive grid of cards, order fixed by role (not user-customizable in MVP — PRD does not require personalization):
- All roles: **Attention** (damaged/lost/under-repair/low-stock counts, each a clickable filter into Search), **My Active Checkouts**, **My Active Reservations**, **Recent Activity** (org-wide recent movements, read-only feed).
- contributor+: **Recently Modified** (their own recent registrations/edits, a quick "did that save correctly" check).
- admin: **Security** (failed-login spikes, pending 2FA non-compliance if enforced, recent role changes) rendered visually distinct (a "for admins" section header) so it doesn't get confused with the operational widgets above it.
**Empty state:** a first-time or low-activity org sees each card's dedicated empty message (§7) rather than an empty grid — e.g., Attention with zero issues reads "Nothing needs attention right now," not a blank card.

### 5.6 Search Results / Browse
**Layout:** left filter rail (status, category, location — as a tree picker, project, date range) + top search bar + result area. Result area defaults to a combined view (asset instances and inventory items visually distinguished by a type indicator on each row) with a toggle to view just one type. Each result row shows: name/identifier, status badge, location breadcrumb (truncated with full value on hover/tap), and — for asset instances — current holder if issued.
**Behavior:** filters and query are reflected in the URL (so a search is shareable/bookmarkable and survives back-navigation) — an explicit requirement given how often "find X again" recurs for this user base. Results update on filter change without a full page reload. Sorting is a column-header click in table view.
**Empty state:** "No results for '{query}'" plus the applied filters listed as removable chips, so the user's next action (loosen a filter) is obvious rather than a dead end.
**Performance note:** loading state is a skeleton row placeholder, not a spinner-blocks-everything overlay, since the <500ms target (PRD §27) makes a heavy loading treatment feel like it's lying about the wait.

### 5.7 Asset Instance Detail
**Layout, top to bottom:**
1. Header: display code + name, large status badge, primary action button (context-sensitive — see §5.7.1), overflow menu for secondary actions.
2. Key facts row: category, manufacturer/part number, serial number, current location (breadcrumb), current holder (if issued, with a small avatar/initials).
3. Tabs: **Details** (catalog fields, condition note, project tag, edit action for contributor+), **History** (merged checkout/transfer/status timeline, newest first, each entry showing actor + timestamp + plain-language description, e.g. "Checked out to Priya Sharma"), **Relationships** (parent/child asset tree, add-relationship action for contributor+), **Attachments** (thumbnail grid for images, file-icon list for documents, upload action for contributor+).

**5.7.1 Context-sensitive primary action** (single most important interaction on this screen — the button changes with status so there is never an ambiguous default):
| Status | Primary action |
|---|---|
| available | Check Out |
| reserved | Check Out (fulfills the reservation) / Cancel Reservation |
| issued | Check In |
| damaged | Start Repair (stores_manager+) / Retire |
| under_repair | Complete Repair (stores_manager+) |
| lost, retired | (no primary action — status is terminal-ish; secondary actions only, e.g. Retire→Dispose) |

Secondary actions (overflow menu, role-filtered): Transfer, Report Damage, Report Loss, Retire, Dispose, Archive, Edit Details.

### 5.8 Inventory Item Detail
**Layout:** header with catalog name, unit, large `quantity_on_hand` figure with a low-stock indicator if applicable; location; a **Record Transaction** primary action opening a form (type selector, quantity, reason if required by type — reason field only appears for `adjust`/`reconciliation`/`dispose`, per the API contract, rather than always showing an optional field the user has to figure out is irrelevant); Recent Transactions table below (paginated, same visual pattern as Asset History).

### 5.9 Register Asset
**Layout:** single-column form, grouped: catalog selection (typeahead against `asset_definitions`, with an inline "Can't find it? Create a new catalog entry" expandable sub-form so the user doesn't need to leave the flow), serial number (optional, with inline duplicate-check feedback), location (typeahead), project tag (optional), condition note.
**Behavior:** on submit, success routes directly to the new Asset Instance Detail screen with a toast "Registered" — the user should immediately see the record they just made, not a list they have to re-find it in.

### 5.10 Add / Adjust Stock
**Layout:** catalog selection + location (same typeahead pattern as §5.9) if creating a new stock line; if the line already exists, this screen is reached from Inventory Item Detail's "Record Transaction" instead and skips straight to the transaction form.
**Behavior:** `adjust`/`reconciliation` transaction types are only offered in the type selector to stores_manager+ (role-filtered options, not disabled options), and always require the reason field, with the field labeled specifically ("Why is this being adjusted?") rather than a generic "Notes."

### 5.11 Check-Out
**Layout:** a compact modal/panel (not a full page — this is meant to be fast) launched from Asset Instance Detail or from a scanned/selected item in Search: who it's for (defaults to self, typeahead to assign to someone else), optional expected-return note. Single confirm button labeled "Check Out."

### 5.12 Check-In
**Layout:** compact modal — condition selector (Good / Damaged / Lost, three large tappable options rather than a dropdown, since this is the one moment condition actually gets recorded and it should be hard to rush past), conditional note field appears if Damaged/Lost selected.

### 5.13 Transfer
**Layout:** compact modal — destination location (typeahead), optional reason. Shows current location as read-only context above the field so the user can confirm they're moving the right thing before picking a destination.

### 5.14 Report Damage / Loss
**Layout:** compact modal — required description field, explicit reassurance microcopy ("This flags the item for review — it won't be removed from records.") since this is a self-service action a nervous first-time user might hesitate over.

### 5.15 My Checkouts & Reservations
**Layout:** two tabs — Active Checkouts (each row: item, since-when, quick Check In action inline) and Reservations (each row: item, status, expiry if set, Cancel action). This is the "what do I need to deal with" screen and is reachable in one nav click for exactly that reason.

### 5.16 Locations Manager
**Layout:** tree view (expand/collapse), each node showing name/type and an occupant count; select a node to edit in a side panel; "Add child location" action per node; drag-to-reparent is **not** built in MVP (adds significant complexity for a rare operation) — reparenting is a form field (pick new parent via the same typeahead pattern) instead.

### 5.17 Reports
**Layout:** month picker, "Generate" action, list of previously generated reports (status: processing/ready/failed) each with format-specific download links once ready. A processing report shows a determinate-feeling state ("Generating — this usually takes under a minute") rather than an indefinite spinner, and the screen can be safely navigated away from and back to without losing the job (state lives server-side per the API contract, not client-side).

### 5.18 Users Management
**Layout:** table (name, email, role, status, last active) with filters; row action opens a detail panel for role change / deactivate / reactivate, each gated by the step-up flow (§9) with a purpose-specific explanation of what step-up is asking for and why, not a generic re-login screen.

### 5.19 Audit Log
**Layout:** dense table (timestamp, actor, action, target, IP) with filters (actor, action, target type, date range); row expand reveals before/after state as a labeled diff, not raw JSON — field names mapped to their human labels (e.g. "Role: viewer → contributor," not `{"role": "viewer"} → {"role": "contributor"}`).

### 5.20 Security Settings
**Layout:** a small set of clearly-labeled toggles/fields (require 2FA for viewers, session timeout, large-reconciliation threshold) each with one sentence of plain-language consequence beneath it, all changes step-up gated and confirmed via §9's confirmation pattern before submission, since this screen edits organization-wide behavior.

---

## 6. Role-Based UI Summary (Cross-Reference)

This table is the frontend's authoritative mirror of the TDS §5.1 capability matrix — every conditional render in the frontend traces to a row here, and every row here traces to an endpoint's role requirement in the API Contract. The frontend never invents a permission distinction the backend doesn't also enforce (and vice versa is impossible by construction, since the frontend has no independent data access).

| Action visible in UI | Minimum role |
|---|---|
| View catalog/inventory/locations, search, own checkouts/reservations | viewer |
| Register/edit assets & inventory, check-out/in, transfer, upload attachments, reserve, report damage/loss | contributor |
| Manage locations, quantity adjust/reconciliation, repair transitions, retire/dispose, archive | stores_manager |
| Hard delete, user management, security settings, full audit log, reports | admin (+ step-up on the specific actions listed in TDS §12.3) |

---

## 7. Empty, Loading & Error State Copy Standard

Per the writing principle that failure and emptiness are "moments for direction, not mood" — every empty/error state in NEST follows this three-part shape: **what's true right now → why (if useful) → the one action available.**

| Situation | Pattern (not verbatim copy for every instance, but every instance follows this shape) |
|---|---|
| Empty search results | "No results for '{query}'." + active filters as removable chips |
| Empty dashboard widget | States the good news plainly ("Nothing needs attention right now") rather than a generic "No data" |
| First-time empty catalog/inventory | "No assets registered yet." + a direct "Register your first asset" action, not just an empty table |
| Loading (list/table) | Skeleton rows matching the eventual row shape, never a full-screen blocking spinner for anything on the search/browse path |
| Loading (action in progress, e.g. check-out submitting) | Button enters a disabled "in progress" label state (e.g. "Checking out…"), preventing double-submit |
| Validation error (field-level) | Inline, beside the field, stating the fix: "Serial number is required for this category," not "Invalid input" (PRD §25) |
| Domain-rule error (409, e.g. already issued) | Inline banner at the top of the action panel, plain language: "This item was just checked out by someone else. Refresh to see its current status." — explains *why* the action can't complete, since these are timing-based conflicts a user can otherwise find confusing |
| Permission error (403) | Should be rare given role-filtered UI, but if reached (e.g., stale client state after a role change): "You don't have permission to do this. If you think that's wrong, contact an admin." |
| Server error (500) | "Something went wrong on our end. Your data wasn't changed. Try again in a moment." — explicitly reassures no partial state was saved, since NEST's transactional design (TDS §8) makes that reassurance true, not just comforting |
| Network offline | A persistent, dismissible banner, not a modal — "You're offline. Changes won't save until you're reconnected." |

---

## 8. Error Presentation Placement

- **Field-level validation errors** → inline beside the field, on blur and on submit attempt.
- **Domain-rule conflicts (409) and permission errors (403)** → inline banner within the modal/panel/page where the action was attempted, **not** a toast — the user needs this message to stay visible while they decide what to do next, not disappear after a few seconds.
- **Successful actions** → toast, brief, dismissible, using the same verb as the triggering button (§2.2).
- **System-level errors (500, network)** → banner at the top of the current screen, persistent until dismissed or resolved.

---

## 9. Confirm-Before-Commit Actions

Every action in this list requires an explicit confirmation dialog stating object + action + consequence (§2.2 pattern) before the request fires — this list is the UI-layer mirror of "high-consequence" operations, roughly aligned with what the backend step-up-gates plus a few UX-only additions (transfer/checkout are frequent and reversible, so they are *not* on this list — confirming every routine action would train users to click through confirmations blindly, defeating the purpose):

Retire · Dispose · Archive · Hard Delete · Deactivate User · Change User Role · Change Security Settings · Cancel a Reservation made on someone else's behalf · Quantity Reconciliation with a large delta.

Step-up-gated actions (per TDS §12.3) additionally show, inside the confirmation dialog, a re-authentication prompt (password [+ 2FA code]) rather than a separate screen — kept in one flow so the user doesn't lose context on what they were confirming.

---

## 10. Responsive & Device Requirements

NEST is used from lab desktops, personal laptops, and occasionally phones (a student checking an item's location while standing in front of a shelf). Layout requirements:

| Breakpoint (conceptual, not pixel-fixed) | Behavior |
|---|---|
| Desktop/laptop (primary) | Full sidebar nav, multi-column dashboard grid, table views with all columns |
| Tablet | Sidebar collapses to an icon rail (expandable), dashboard grid reflows to fewer columns |
| Mobile | Bottom tab nav, dashboard cards stack single-column, tables collapse to a card-per-row layout (label: value pairs) rather than horizontal-scrolling a wide table, action modals become full-screen sheets |

Check-out/check-in/transfer flows are explicitly optimized for the mobile case (large tap targets, minimal fields, three-option condition selector in §5.12 instead of a dropdown) since "standing at the shelf" is a realistic real-world moment this tool needs to handle well, not just tolerate.

---

## 11. Accessibility Requirements (WCAG 2.1 AA — PRD §26)

- Full keyboard operability: every action reachable via Tab/Shift+Tab/Enter/Space/Escape, including modals (focus trapped inside while open, returned to the triggering element on close), the location tree (arrow-key navigation), and the combobox/typeahead components.
- Visible focus indicator on every interactive element, using the accent token, never removed via `outline: none` without an equally visible replacement.
- All color-coded information (status badges, low-stock indicators) paired with a text label or icon, never color alone.
- All non-decorative images/icons have text alternatives; decorative icons are hidden from assistive tech.
- Form fields have programmatically associated labels (not placeholder-as-label); error messages are programmatically associated with their field and announced on appearance.
- Live regions for toasts and async status changes (e.g., report generation completing) so screen-reader users receive the same "it worked" signal sighted users get from a toast.
- `prefers-reduced-motion` respected — all transitions/animations reduce to instant or near-instant.
- Minimum text contrast 4.5:1 for body text, 3:1 for large text/UI components, verified per the token set in §2.1, not assumed.
- Automated accessibility scan (axe or equivalent) plus a manual keyboard-only and screen-reader pass on the core flows (search, check-out, check-in, transfer, dashboard, registration) is a Phase 2 launch-blocking gate, per the Implementation Plan.

---

## 12. Notification & Feedback Timing Rules

- Toasts: 4–6 second auto-dismiss, pause-on-hover, manually dismissible, one at a time (queued, not stacked) to avoid overwhelming a user who fires several quick actions.
- Inline banners (409/403/500): persist until the user dismisses them or the underlying state changes (e.g., a refetch resolves the conflict).
- No blocking modal is ever used purely to convey information with no decision attached — informational content goes inline or in a toast; a modal always exists because the user must decide or provide input next.

---

## 13. Explicitly Out of Scope for MVP UI (Traceable to PRD Non-Goals / Phase 2)

Barcode/QR scanning UI, push notification center, drag-to-reparent location tree, dashboard personalization/customizable widgets, dark mode, mobile native app shell (mobile is responsive web only), bulk multi-select actions across search results (single-item actions only in MVP, per the Implementation Plan's phased ordering — bulk operations are noted as a Phase 2 admin convenience, not built now).

---

*End of document.*
