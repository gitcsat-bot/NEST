// Enumerations shared between backend and frontend.
// Source of truth: NEST Database Design §3 (Enumerated Types).
// Any value added here must be added to the corresponding Postgres
// ENUM type in the same PR (Implementation Plan §7, "Audit vocabulary
// maintenance" — the same discipline applies to every shared enum).

export enum UserRole {
  VIEWER = 'viewer',
  STUDENT = 'student',
  CONTRIBUTOR = 'contributor',
  STORES_MANAGER = 'stores_manager',
  ADMIN = 'admin',
}

// Collected at registration alongside the 9-digit college MIS ID (see
// the doc comment on `misId` in schema.prisma) — a simple demographic
// field, not used to gate any functionality.
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum LocationType {
  WAREHOUSE = 'warehouse',
  ROOM = 'room',
  CABINET = 'cabinet',
  RACK = 'rack',
  SHELF = 'shelf',
  BIN = 'bin',
  BOX = 'box',
  POSITION = 'position',
  OTHER = 'other',
}

export enum LocationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  LOCKED = 'locked',
}

// TDS §4.1 — state machine transitions are enforced server-side only;
// this enum exists so the frontend can render the correct status badge
// (UI/UX Spec §2.2) and the correct context-sensitive primary action
// (UI/UX Spec §5.7.1). It must never be used to derive an allowed
// transition on the client — that decision belongs to the backend.
export enum AssetStatus {
  REGISTERED = 'registered',
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  ISSUED = 'issued',
  DAMAGED = 'damaged',
  UNDER_REPAIR = 'under_repair',
  LOST = 'lost',
  RETIRED = 'retired',
  DISPOSED = 'disposed',
}

export enum InventoryTransactionType {
  RECEIVE = 'receive',
  ISSUE = 'issue',
  CONSUME = 'consume',
  RETURN = 'return',
  ADJUST = 'adjust',
  TRANSFER_OUT = 'transfer_out',
  TRANSFER_IN = 'transfer_in',
  RECONCILIATION = 'reconciliation',
  DISPOSE = 'dispose',
}

// Transaction types that require a non-empty `reason` field.
// Mirrors the `chk_reason_required` constraint (Database Design §4.10).
export const REASON_REQUIRED_TRANSACTION_TYPES: ReadonlySet<InventoryTransactionType> = new Set([
  InventoryTransactionType.ADJUST,
  InventoryTransactionType.RECONCILIATION,
  InventoryTransactionType.DISPOSE,
]);

export enum ReservationStatus {
  ACTIVE = 'active',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum AttachmentStatus {
  PENDING_SCAN = 'pending_scan',
  AVAILABLE = 'available',
  QUARANTINED = 'quarantined',
  FAILED = 'failed',
}

export enum RelationshipType {
  CONTAINS = 'contains',
  MOUNTED_ON = 'mounted_on',
  SUBSYSTEM_OF = 'subsystem_of',
  SPARE_FOR = 'spare_for',
}

export enum PolymorphicTargetType {
  ASSET_INSTANCE = 'asset_instance',
  INVENTORY_ITEM = 'inventory_item',
}

// Phase-1-lite MVP enum — see the note on `Material`/`InventoryRequest`
// in schema.prisma. Not part of the original Database Design §3 list.
export enum InventoryRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// Simplified status-transition table for the Materials MVP. Mirrors the
// "UX convenience ONLY" contract that ROLE_HIERARCHY documents above —
// the frontend uses this to grey out invalid options in the status
// picker, but MaterialsService re-validates every transition server-side
// independent of this table (see Security Design §6). This is
// intentionally coarser than the full TDS §4.1 state machine (no
// per-transition endpoints, no reservation/checkout side effects) — it
// exists to make "student changes material status" a real, working
// feature now, and is the natural seed for the full state machine when
// Individually Tracked Assets (Implementation Plan §4.3) is built.
export const MATERIAL_STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  [AssetStatus.REGISTERED]: [AssetStatus.AVAILABLE, AssetStatus.DAMAGED, AssetStatus.RETIRED],
  [AssetStatus.AVAILABLE]: [AssetStatus.ISSUED, AssetStatus.RESERVED, AssetStatus.DAMAGED, AssetStatus.LOST, AssetStatus.RETIRED],
  [AssetStatus.RESERVED]: [AssetStatus.AVAILABLE, AssetStatus.ISSUED],
  [AssetStatus.ISSUED]: [AssetStatus.AVAILABLE, AssetStatus.DAMAGED, AssetStatus.LOST],
  [AssetStatus.DAMAGED]: [AssetStatus.UNDER_REPAIR, AssetStatus.RETIRED, AssetStatus.DISPOSED],
  [AssetStatus.UNDER_REPAIR]: [AssetStatus.AVAILABLE, AssetStatus.DAMAGED, AssetStatus.RETIRED],
  [AssetStatus.LOST]: [AssetStatus.AVAILABLE, AssetStatus.RETIRED],
  [AssetStatus.RETIRED]: [AssetStatus.DISPOSED],
  [AssetStatus.DISPOSED]: [],
};

// Role capability matrix — TDS §5.1 / UI/UX Spec §6.
// This is the frontend's authoritative source for which nav items and
// action buttons render for a role. It is a UX convenience ONLY — see
// Security Design §6: it must never be treated as an enforcement
// mechanism. The backend's RolesGuard (apps/backend/src/auth/guards)
// re-checks every one of these server-side, independent of this table.
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VIEWER]: 0,
  [UserRole.STUDENT]: 1,
  [UserRole.CONTRIBUTOR]: 2,
  [UserRole.STORES_MANAGER]: 3,
  [UserRole.ADMIN]: 4,
};

export const roleAtLeast = (role: UserRole, minimum: UserRole): boolean => {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
};
