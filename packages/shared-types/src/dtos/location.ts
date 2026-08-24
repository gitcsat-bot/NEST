import { LocationType, LocationStatus } from '../enums';

// API Contract §3.3 `Location` — resource schema & request DTOs.

export interface LocationDto {
  id: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
  parent_location_id: string | null;
  description: string | null;
  is_active: boolean;
  breadcrumb?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateLocationDto {
  name: string;
  type: LocationType;
  parent_location_id?: string | null;
  description?: string | null;
}

export interface UpdateLocationDto {
  name?: string;
  type?: LocationType;
  parent_location_id?: string | null;
  description?: string | null;
}

export interface LocationQueryDto {
  parent_id?: string;
  is_active?: boolean;
}
