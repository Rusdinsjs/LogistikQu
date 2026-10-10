export interface WarehouseInfo {
  id: string;
  name: string;
  warehouse_name?: string;
  warehouse_type: 'MAIN' | 'CONTAINER';
  category: string;
  description?: string;
  is_active?: boolean;
  parent_warehouse_id?: string | null;
  parent_warehouse_ids?: string[] | null;
  supplied_sub_warehouse_ids?: string[] | null;
}

export interface WarehouseCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  role_name: string;
  role?: string;
  warehouses: WarehouseInfo[];
  permissions: string[];
  avatar_url?: string;
  email?: string;
  phone?: string;
}

export interface UpdateProfilePayload {
  username?: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  current_password?: string;
  new_password?: string;
}

export interface DemoUser {
  username: string;
  full_name: string;
  role_id: string;
  role_name: string;
  warehouses: string[];
}

export interface SparePart {
  id: string;
  part_name: string;
  category_id?: string;
  category?: string;
  brand?: string;
  equipment_category: string;
  unit_of_measure: string;
  critical_level: 'NORMAL' | 'WARNING' | 'CRITICAL';
  is_critical?: boolean;
  requires_issue_approval: boolean;
  lead_time_days: number;
  default_min_stock: number;
  default_max_stock: number;
  qr_code?: string;
  is_active: boolean;
  requires_core_return: boolean;
}

export interface UpdateSparePartPayload {
  requires_core_return?: boolean;
  requires_issue_approval?: boolean;
  critical_level?: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface CreateEquipmentPayload {
  id?: string;
  unit_number: string;
  name: string;
  equipment_type_id?: string;
  serial_number?: string;
  current_hm_km?: number;
  current_site_id?: string;
}

export interface CreateEmployeePayload {
  id?: string;
  name: string;
  department_id?: string;
  is_mechanic?: boolean;
  position?: string;
}

export interface Equipment {
  id: string;
  unit_number: string;
  ct_number?: string;
  name: string;
  model?: string;
  equipment_type?: string;
  equipment_type_id?: string;
  serial_number?: string;
  current_hm_km: number;
  current_hour_meter?: number;
  current_kilometer?: number;
  current_site_id?: string;
  status?: string;
  qr_code?: string;
  is_active: boolean;
}

export interface Employee {
  id: string;
  name: string;
  full_name?: string;
  badge_number?: string;
  department?: string;
  department_id?: string;
  is_mechanic: boolean;
  position?: string;
  role_title?: string;
  is_active: boolean;
}

export interface Site {
  id: string;
  name: string;
  site_name?: string;
  description?: string;
  location_details?: string;
  is_active: boolean;
}

export interface InventoryStockItem {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  spare_part_id: string;
  part_name: string;
  category_name?: string;
  brand?: string;
  unit_of_measure: string;
  qty_on_hand: number;
  min_stock: number;
  max_stock: number;
  safety_stock: number;
  rack_location?: string;
  critical_level: string;
  requires_issue_approval: boolean;
  requires_core_return: boolean;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  updated_at: string;
}

export interface StockMovement {
  id: string;
  warehouse_id: string;
  spare_part_id: string;
  movement_type: string;
  qty: number;
  balance_after: number;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface CreateIssueItem {
  spare_part_id: string;
  qty: number;
  unit_of_measure: string;
}

export interface CreateIssuePayload {
  warehouse_id: string;
  site_id: string;
  receiver_name: string;
  receiver_employee_id?: string;
  receiver_department?: string;
  unit_number: string;
  unit_name: string;
  unit_type: string;
  ct_number?: string;
  serial_number?: string;
  hm_km?: number;
  mechanic_name: string;
  mechanic_id?: string;
  work_order_number?: string;
  maintenance_type?: string;
  priority?: string;
  notes?: string;
  evidence_photo_url?: string;
  document_url?: string;
  items: CreateIssueItem[];
}

export interface IssueTransaction {
  id: string;
  transaction_number: string;
  warehouse_id: string;
  site_id: string;
  receiver_name: string;
  unit_number: string;
  unit_name: string;
  unit_type: string;
  mechanic_name: string;
  work_order_number?: string;
  maintenance_type?: string;
  priority: string;
  status: 'COMPLETED' | 'PENDING_APPROVAL' | 'REJECTED';
  notes?: string;
  evidence_photo_url?: string;
  document_url?: string;
  created_at: string;
}

export interface IssueDetail {
  transaction: IssueTransaction;
  items: Array<{
    id: string;
    spare_part_id: string;
    part_name: string;
    qty: number;
    unit_of_measure: string;
  }>;
}

export interface RecommendationItem {
  spare_part_id: string;
  part_name: string;
  unit_of_measure: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  safety_stock: number;
  lead_time_days: number;
  avg_daily_usage: number;
  recommended_order_qty: number;
}

export interface ReplenishmentRequest {
  id: string;
  request_number: string;
  container_warehouse_id: string;
  main_warehouse_id: string;
  status: string;
  notes?: string;
  admin_notes?: string;
  supervisor_notes?: string;
  requested_by?: string;
  verified_by?: string;
  verified_at?: string;
  approved_by?: string;
  approved_at?: string;
  shipped_by?: string;
  shipped_at?: string;
  received_by?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReplenishmentDetail {
  request: ReplenishmentRequest;
  items: Array<{
    id: string;
    spare_part_id: string;
    part_name: string;
    requested_qty: number;
    recommended_qty: number;
    verified_qty: number;
    approved_qty: number;
    shipped_qty: number;
    received_qty: number;
    unit_of_measure: string;
    notes?: string;
  }>;
}

export interface MainDrop {
  id: string;
  drop_number: string;
  request_id?: string;
  main_warehouse_id: string;
  container_warehouse_id: string;
  status: string;
  shipped_at: string;
  received_at?: string;
  notes?: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  warehouse_id: string;
  reason: string;
  notes?: string;
  status: string;
  created_at: string;
}

export interface DashboardSummary {
  total_parts_monitored: number;
  total_critical_items: number;
  total_warning_items: number;
  today_issues_count: number;
  today_items_released: number;
  pending_requests_count: number;
  active_warehouses_count: number;
}

export interface UnitReport {
  unit_number: string;
  unit_name: string;
  unit_type: string;
  total_transactions: number;
  total_parts_consumed: number;
}

export interface SiteReport {
  site_id: string;
  site_name: string;
  total_transactions: number;
  total_parts_consumed: number;
}

export interface MechanicReport {
  mechanic_name: string;
  total_jobs: number;
  total_parts_installed: number;
}

export interface AuditLog {
  id: string;
  username?: string;
  action: string;
  entity: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
}

export interface UserManagementItem {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  warehouses: WarehouseInfo[];
  created_at: string;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  full_name: string;
  role_id: string;
  warehouse_ids: string[];
}

export interface UpdateUserPayload {
  full_name?: string;
  password?: string;
  role_id?: string;
  is_active?: boolean;
  warehouse_ids?: string[];
}

export interface UsedPartReturn {
  id: string;
  return_number: string;
  issue_transaction_id: string;
  spare_part_id: string;
  part_name?: string;
  qty: number;
  unit_of_measure: string;
  unit_number: string;
  mechanic_name: string;
  mechanic_id?: string;
  warehouse_id: string;
  warehouse_name?: string;
  status: 'PENDING_RETURN' | 'RECEIVED_AT_CONTAINER' | 'TRANSFERRED_TO_MAIN' | 'COMPLETED';
  current_holder_type: 'MECHANIC' | 'CONTAINER_ADMIN' | 'MAIN_ADMIN' | 'COMPLETED';
  current_holder_name: string;
  container_received_at?: string;
  container_received_by?: string;
  container_received_by_name?: string;
  container_notes?: string;
  container_photo_url?: string;
  main_received_at?: string;
  main_received_by?: string;
  main_received_by_name?: string;
  main_warehouse_id?: string;
  main_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReceiveContainerReturnPayload {
  container_notes?: string;
  container_photo_url?: string;
}

export interface TransferMainReturnPayload {
  main_warehouse_id?: string;
  main_notes?: string;
}

export interface CompleteReturnPayload {
  final_notes?: string;
  disposition?: string;
}


export interface WarehouseBinItem {
  id: string;
  warehouse_id: string;
  bin_code: string;
  zone: string;
  shelf_level: string;
  capacity_parts: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  current_items_count: number;
  total_qty: number;
  parts: Array<{
    spare_part_id: string;
    part_name: string;
    qty_on_hand: number;
    unit_of_measure: string;
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  }>;
}

export interface CreateBinPayload {
  bin_code: string;
  zone?: string;
  shelf_level?: string;
  capacity_parts?: number;
  description?: string;
}

export interface UpdateBinPayload {
  bin_code?: string;
  zone?: string;
  shelf_level?: string;
  capacity_parts?: number;
  description?: string;
  is_active?: boolean;
}
