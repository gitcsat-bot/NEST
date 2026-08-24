import { apiRequest } from './client';
import {
  LocationDto,
  CreateLocationDto,
  UpdateLocationDto,
  LocationQueryDto,
} from '@nest/shared-types';

export async function fetchLocations(query: LocationQueryDto = {}): Promise<LocationDto[]> {
  const params = new URLSearchParams();
  if (query.parent_id !== undefined) params.append('parent_id', query.parent_id);
  if (query.is_active !== undefined) params.append('is_active', String(query.is_active));

  const queryString = params.toString();
  const path = `/locations${queryString ? `?${queryString}` : ''}`;
  return apiRequest<LocationDto[]>(path);
}

export async function fetchLocation(id: string): Promise<LocationDto> {
  return apiRequest<LocationDto>(`/locations/${id}`);
}

export async function createLocation(body: CreateLocationDto): Promise<LocationDto> {
  return apiRequest<LocationDto>('/locations', {
    method: 'POST',
    body,
  });
}

export async function updateLocation(id: string, body: UpdateLocationDto): Promise<LocationDto> {
  return apiRequest<LocationDto>(`/locations/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function updateLocationStatus(id: string, status: string): Promise<LocationDto> {
  return apiRequest<LocationDto>(`/locations/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function archiveLocation(id: string): Promise<LocationDto> {
  return apiRequest<LocationDto>(`/locations/${id}/archive`, {
    method: 'POST',
  });
}
