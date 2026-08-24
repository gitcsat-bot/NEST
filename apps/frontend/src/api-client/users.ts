import { apiRequest } from './client';
import { UserDto, PaginatedResponse } from '@nest/shared-types';

export async function listUsers(query: {
  role?: string;
  is_active?: boolean;
  has_pending_role?: boolean;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<UserDto>> {
  const params = new URLSearchParams();
  if (query.role) params.append('role', query.role);
  if (query.is_active !== undefined) params.append('is_active', String(query.is_active));
  if (query.has_pending_role !== undefined) params.append('has_pending_role', String(query.has_pending_role));
  if (query.page) params.append('page', String(query.page));
  if (query.page_size) params.append('page_size', String(query.page_size));
  const qs = params.toString();
  return apiRequest<PaginatedResponse<UserDto>>(`/users${qs ? `?${qs}` : ''}`);
}

export async function approveUserRole(id: string): Promise<UserDto> {
  return apiRequest<UserDto>(`/users/${id}/approve-role`, { method: 'POST' });
}

export async function rejectUserRole(id: string): Promise<UserDto> {
  return apiRequest<UserDto>(`/users/${id}/reject-role`, { method: 'POST' });
}

export async function deactivateUser(id: string): Promise<UserDto> {
  return apiRequest<UserDto>(`/users/${id}/deactivate`, { method: 'POST' });
}

export async function reactivateUser(id: string): Promise<UserDto> {
  return apiRequest<UserDto>(`/users/${id}/reactivate`, { method: 'POST' });
}

export async function updateProfile(body: { displayName?: string; misId?: string; gender?: string }): Promise<UserDto> {
  return apiRequest<UserDto>('/users/me/profile', {
    method: 'PATCH',
    body,
  });
}

export async function updatePassword(body: { currentPassword: string; newPassword: string }): Promise<UserDto> {
  return apiRequest<UserDto>('/users/me/password', {
    method: 'PATCH',
    body,
  });
}
