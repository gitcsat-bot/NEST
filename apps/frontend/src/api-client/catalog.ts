import { apiRequest } from './client';

export interface AssetDefinitionDto {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  model_number: string | null;
  is_consumable: boolean;
  requires_return: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetDefinitionListResponse {
  items: AssetDefinitionDto[];
  total: number;
  page: number;
  page_size: number;
}

export async function listAssetDefinitions(params?: {
  search?: string;
  page?: number;
  page_size?: number;
  is_consumable?: boolean;
}): Promise<AssetDefinitionListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.is_consumable !== undefined) query.set('is_consumable', String(params.is_consumable));
  const qs = query.toString();
  return apiRequest<AssetDefinitionListResponse>(`/catalog${qs ? `?${qs}` : ''}`);
}

export async function getAssetDefinition(id: string): Promise<AssetDefinitionDto> {
  return apiRequest<AssetDefinitionDto>(`/catalog/${id}`);
}

export async function createAssetDefinition(data: {
  sku: string;
  name: string;
  description?: string;
  manufacturer?: string;
  model_number?: string;
  is_consumable?: boolean;
  requires_return?: boolean;
}): Promise<AssetDefinitionDto> {
  return apiRequest<AssetDefinitionDto>('/catalog', { method: 'POST', body: data });
}

export async function updateAssetDefinition(
  id: string,
  data: Partial<Omit<AssetDefinitionDto, 'id' | 'created_at' | 'updated_at'>>,
): Promise<AssetDefinitionDto> {
  return apiRequest<AssetDefinitionDto>(`/catalog/${id}`, { method: 'PATCH', body: data });
}

export async function deleteAssetDefinition(id: string): Promise<void> {
  return apiRequest(`/catalog/${id}`, { method: 'DELETE' });
}
