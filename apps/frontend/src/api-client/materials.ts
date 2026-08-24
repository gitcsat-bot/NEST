import { apiRequest } from './client';
import {
  MaterialDto,
  CreateMaterialDto,
  UpdateMaterialStatusDto,
  MaterialQueryDto,
  InventoryRequestDto,
  CreateInventoryRequestDto,
  PaginatedResponse,
} from '@nest/shared-types';

export async function listMaterials(query: MaterialQueryDto = {}): Promise<PaginatedResponse<MaterialDto>> {
  const params = new URLSearchParams();
  if (query.status) params.append('status', query.status);
  if (query.location_id) params.append('location_id', query.location_id);
  if (query.asset_definition_id) params.append('asset_definition_id', query.asset_definition_id);
  if (query.page) params.append('page', String(query.page));
  if (query.page_size) params.append('page_size', String(query.page_size));
  const qs = params.toString();
  return apiRequest<PaginatedResponse<MaterialDto>>(`/materials${qs ? `?${qs}` : ''}`);
}

export async function getMaterial(id: string): Promise<MaterialDto> {
  return apiRequest<MaterialDto>(`/materials/${id}`);
}

export async function createMaterial(data: CreateMaterialDto): Promise<MaterialDto> {
  return apiRequest<MaterialDto>('/materials', { method: 'POST', body: data });
}

export async function updateMaterialStatus(id: string, data: UpdateMaterialStatusDto): Promise<MaterialDto> {
  return apiRequest<MaterialDto>(`/materials/${id}/status`, { method: 'PATCH', body: data });
}

export async function listInventoryRequestsForMaterial(materialId: string): Promise<InventoryRequestDto[]> {
  return apiRequest<InventoryRequestDto[]>(`/materials/${materialId}/inventory-requests`);
}

export async function requestMaterialQuantity(
  materialId: string,
  data: CreateInventoryRequestDto,
): Promise<InventoryRequestDto> {
  return apiRequest<InventoryRequestDto>(`/materials/${materialId}/inventory-requests`, {
    method: 'POST',
    body: data,
  });
}

// Admin review queue — a separate top-level resource, not nested under a
// material, so the pending queue can be listed without knowing material
// ids up front (see materials.controller.ts's InventoryRequestsController).
export async function listInventoryRequests(query: {
  status?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<InventoryRequestDto>> {
  const params = new URLSearchParams();
  if (query.status) params.append('status', query.status);
  if (query.page) params.append('page', String(query.page));
  if (query.page_size) params.append('page_size', String(query.page_size));
  const qs = params.toString();
  return apiRequest<PaginatedResponse<InventoryRequestDto>>(`/inventory-requests${qs ? `?${qs}` : ''}`);
}

export async function approveInventoryRequest(id: string): Promise<InventoryRequestDto> {
  return apiRequest<InventoryRequestDto>(`/inventory-requests/${id}/approve`, { method: 'POST' });
}

export async function rejectInventoryRequest(id: string): Promise<InventoryRequestDto> {
  return apiRequest<InventoryRequestDto>(`/inventory-requests/${id}/reject`, { method: 'POST' });
}
