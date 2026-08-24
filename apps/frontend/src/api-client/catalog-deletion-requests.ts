import { apiRequest } from './client';
import { PaginatedResponse } from '@nest/shared-types';

// Mirrors materials.ts's InventoryRequestDto shape closely — see
// deletion-requests.service.ts's doc comment for why the two workflows
// are structured the same way.
export interface CatalogDeletionRequestDto {
  id: string;
  asset_definition_id: string;
  asset_definition_name: string;
  asset_definition_sku: string;
  requested_by_user_id: string;
  requested_by_display_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_user_id: string | null;
  reviewed_by_display_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function requestCatalogDeletion(
  assetDefinitionId: string,
  reason?: string,
): Promise<CatalogDeletionRequestDto> {
  return apiRequest<CatalogDeletionRequestDto>(`/catalog/${assetDefinitionId}/deletion-requests`, {
    method: 'POST',
    body: { reason: reason || undefined },
  });
}

export async function listCatalogDeletionRequests(query: {
  status?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<CatalogDeletionRequestDto>> {
  const params = new URLSearchParams();
  if (query.status) params.append('status', query.status);
  if (query.page) params.append('page', String(query.page));
  if (query.page_size) params.append('page_size', String(query.page_size));
  const qs = params.toString();
  return apiRequest<PaginatedResponse<CatalogDeletionRequestDto>>(`/catalog-deletion-requests${qs ? `?${qs}` : ''}`);
}

export async function approveCatalogDeletionRequest(id: string): Promise<{ deleted: true; request_id: string }> {
  return apiRequest(`/catalog-deletion-requests/${id}/approve`, { method: 'POST' });
}

export async function rejectCatalogDeletionRequest(id: string): Promise<CatalogDeletionRequestDto> {
  return apiRequest<CatalogDeletionRequestDto>(`/catalog-deletion-requests/${id}/reject`, { method: 'POST' });
}
