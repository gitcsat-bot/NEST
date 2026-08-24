import { UserRole, Gender } from '../enums';

// API Contract §3.1 `User` — response shape. `password_hash` and other
// internal fields are intentionally absent; see API Contract §12
// (Non-Serialization Rules).
export interface UserDto {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  // Set when the user registered requesting a higher role than `viewer`
  // and is awaiting admin approval (POST /users/:id/approve-role) or
  // denial (POST /users/:id/reject-role). Null once resolved.
  pending_role?: UserRole | null;
  // 9-digit college MIS ID collected at registration. Nullable because
  // accounts created before this field existed (seeded/legacy) won't
  // have one — see the migration note on `misId` in schema.prisma.
  mis_id?: string | null;
  gender?: Gender | null;
  whatsapp_number?: string | null;
  subsystem?: string | null;
  team_role?: string | null;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export interface UserSummaryDto {
  id: string;
  display_name: string;
}
