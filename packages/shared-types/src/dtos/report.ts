// Admin-only reports (Implementation Plan checklist item 5). These are
// deliberately thin, audit-log-derived summaries — not the full reporting
// subsystem the eventual Dashboard workstream (Implementation Plan §4.11)
// will build; they exist so "admin gets security/login/inventory reports"
// is a real, working feature now.

export interface AuditEventDto {
  id: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface SecurityReportDto {
  generated_at: string;
  window_days: number;
  failed_login_count: number;
  account_locked_count: number;
  two_factor_failure_count: number;
  role_change_count: number;
  deactivation_count: number;
  recent_events: AuditEventDto[];
}

export interface LoginReportDto {
  generated_at: string;
  window_days: number;
  successful_login_count: number;
  failed_login_count: number;
  unique_users_logged_in: number;
  recent_events: AuditEventDto[];
}

export interface InventoryReportDto {
  generated_at: string;
  total_materials: number;
  materials_by_status: Record<string, number>;
  low_stock_materials: {
    id: string;
    asset_definition_name: string;
    quantity_on_hand: number;
    reorder_threshold: number;
  }[];
  pending_inventory_requests: number;
}
