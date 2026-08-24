import { AssetStatus } from '../enums';

// Materials MVP — see schema.prisma's `Material` model doc comment for
// why this exists ahead of the full Individually Tracked Assets design.

export interface MaterialDto {
  id: string;
  asset_definition_id: string;
  asset_definition_name: string;
  asset_definition_sku: string;
  location_id: string | null;
  location_name: string | null;
  status: AssetStatus;
  quantity_on_hand: number;
  reorder_threshold: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialDto {
  asset_definition_id: string;
  location_id?: string | null;
  status?: AssetStatus;
  quantity_on_hand?: number;
  reorder_threshold?: number | null;
  notes?: string | null;
}

export interface UpdateMaterialStatusDto {
  status: AssetStatus;
}

export interface MaterialQueryDto {
  status?: AssetStatus;
  location_id?: string;
  asset_definition_id?: string;
  page?: number;
  page_size?: number;
}
