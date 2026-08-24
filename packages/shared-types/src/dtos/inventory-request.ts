import { InventoryRequestStatus } from '../enums';

export interface InventoryRequestDto {
  id: string;
  material_id: string;
  material_name: string;
  requested_by_user_id: string;
  requested_by_display_name: string;
  requested_quantity: number;
  reason: string | null;
  status: InventoryRequestStatus;
  reviewed_by_user_id: string | null;
  reviewed_by_display_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CreateInventoryRequestDto {
  requested_quantity: number;
  reason?: string | null;
}
