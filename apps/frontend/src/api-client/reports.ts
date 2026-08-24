import { apiRequest } from './client';
import { SecurityReportDto, LoginReportDto, InventoryReportDto } from '@nest/shared-types';

export async function fetchSecurityReport(days = 30): Promise<SecurityReportDto> {
  return apiRequest<SecurityReportDto>(`/reports/security?days=${days}`);
}

export async function fetchLoginReport(days = 30): Promise<LoginReportDto> {
  return apiRequest<LoginReportDto>(`/reports/logins?days=${days}`);
}

export async function fetchInventoryReport(): Promise<InventoryReportDto> {
  return apiRequest<InventoryReportDto>('/reports/inventory');
}
