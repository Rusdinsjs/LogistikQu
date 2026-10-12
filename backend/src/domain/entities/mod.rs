use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// --- Authentication & Users ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid, // User ID
    pub username: String,
    pub role_id: String,
    pub exp: usize,
}

impl Claims {
    pub fn can_access_financials(&self) -> bool {
        self.role_id == "SUPER_ADMIN" || self.role_id == "MANAGER"
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub username: String,
    pub full_name: String,
    pub role_id: String,
    pub role_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warehouse_id: Option<String>,
    pub warehouses: Vec<WarehouseInfo>,
    pub permissions: Vec<String>,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub employee_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub current_password: Option<String>,
    pub new_password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WarehouseInfo {
    pub id: String,
    pub name: String,
    pub warehouse_type: String,
    pub category: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub parent_warehouse_id: Option<String>,
    pub parent_warehouse_ids: Option<Vec<String>>,
    pub supplied_sub_warehouse_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub refresh_token: Option<String>,
    pub user: UserProfile,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserManagementItem {
    pub id: Uuid,
    pub username: String,
    pub full_name: String,
    pub role_id: String,
    pub role_name: String,
    pub is_active: bool,
    pub warehouses: Vec<WarehouseInfo>,
    pub custom_permissions_enabled: bool,
    pub permissions: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub full_name: String,
    pub role_id: String,
    pub warehouse_ids: Vec<String>,
    pub custom_permissions_enabled: Option<bool>,
    pub custom_permissions: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub full_name: Option<String>,
    pub role_id: Option<String>,
    pub password: Option<String>,
    pub is_active: Option<bool>,
    pub warehouse_ids: Option<Vec<String>>,
    pub custom_permissions_enabled: Option<bool>,
    pub custom_permissions: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoleItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PermissionItem {
    pub id: String,
    pub name: String,
    pub category: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRolePermissionsRequest {
    pub permissions: Vec<String>,
}

// --- Master Data ---
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SparePart {
    pub id: String,
    pub part_name: String,
    pub category_id: Option<String>,
    pub brand: Option<String>,
    pub equipment_category: String,
    pub unit_of_measure: String,
    pub critical_level: String,
    pub requires_issue_approval: bool,
    pub lead_time_days: i32,
    pub default_min_stock: Decimal,
    pub default_max_stock: Decimal,
    pub qr_code: Option<String>,
    pub is_active: bool,
    pub requires_core_return: bool,
    pub component_id: Option<String>,
    pub unit_cost: Option<Decimal>,
    pub photo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSparePartRequest {
    pub requires_core_return: Option<bool>,
    pub requires_issue_approval: Option<bool>,
    pub critical_level: Option<String>,
    pub default_min_stock: Option<Decimal>,
    pub default_max_stock: Option<Decimal>,
    pub photo_url: Option<String>,
    pub qr_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStockPhotoRequest {
    pub photo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Equipment {
    pub id: String,
    pub unit_number: String,
    pub equipment_number: Option<String>,
    pub ct_number: Option<String>,
    pub name: String,
    pub equipment_type_id: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub current_hm_km: Decimal,
    pub current_site_id: Option<String>,
    pub qr_code: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateEquipmentRequest {
    pub id: Option<String>,
    pub unit_number: String,
    pub name: String,
    pub equipment_type_id: Option<String>,
    pub serial_number: Option<String>,
    pub current_hm_km: Option<Decimal>,
    pub current_site_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Employee {
    pub id: String,
    pub name: String,
    pub department_id: Option<String>,
    pub is_mechanic: bool,
    pub position: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateEmployeeRequest {
    pub id: Option<String>,
    pub name: String,
    pub department_id: Option<String>,
    pub is_mechanic: Option<bool>,
    pub position: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Site {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateSiteRequest {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSiteRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWarehouseRequest {
    pub id: Option<String>,
    pub name: String,
    pub warehouse_type: String,
    pub category: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub parent_warehouse_id: Option<String>,
    pub parent_warehouse_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWarehouseRequest {
    pub name: Option<String>,
    pub warehouse_type: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub parent_warehouse_id: Option<String>,
    pub parent_warehouse_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct WarehouseCategory {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWarehouseCategoryRequest {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWarehouseCategoryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WarehouseBinItem {
    pub id: Uuid,
    pub warehouse_id: String,
    pub bin_code: String,
    pub zone: String,
    pub shelf_level: String,
    pub capacity_parts: i32,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub current_items_count: Option<i64>,
    pub total_qty: Option<Decimal>,
    pub parts: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CreateBinRequest {
    pub bin_code: String,
    pub zone: Option<String>,
    pub shelf_level: Option<String>,
    pub capacity_parts: Option<i32>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBinRequest {
    pub bin_code: Option<String>,
    pub zone: Option<String>,
    pub shelf_level: Option<String>,
    pub capacity_parts: Option<i32>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RelocateStockBinRequest {
    pub spare_part_id: String,
    pub target_bin_code: Option<String>,
}

// --- Inventory & Monitoring ---
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InventoryStockItem {
    pub id: Uuid,
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub spare_part_id: String,
    pub part_name: String,
    pub category_name: Option<String>,
    pub brand: Option<String>,
    pub unit_of_measure: String,
    pub qty_on_hand: Decimal,
    pub min_stock: Decimal,
    pub max_stock: Decimal,
    pub safety_stock: Decimal,
    pub rack_location: Option<String>,
    pub critical_level: String,
    pub requires_issue_approval: bool,
    pub requires_core_return: bool,
    pub status: String,
    pub updated_at: DateTime<Utc>,
    pub photo_url: Option<String>,
    pub qr_code: Option<String>,
    pub unit_cost: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockMovement {
    pub id: Uuid,
    pub warehouse_id: String,
    pub spare_part_id: String,
    pub movement_type: String,
    pub qty: Decimal,
    pub balance_after: Decimal,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
    pub batch_number: Option<String>,
    pub serial_number: Option<String>,
    pub bin_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total_parts_monitored: i64,
    pub total_critical_items: i64,
    pub total_warning_items: i64,
    pub today_issues_count: i64,
    pub today_items_released: Decimal,
    pub pending_requests_count: i64,
    pub active_warehouses_count: i64,
}

// --- POS Issue Transaction ---
#[derive(Debug, Deserialize)]
pub struct CreateIssueItem {
    pub spare_part_id: String,
    pub qty: Decimal,
    pub unit_of_measure: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateIssueRequest {
    pub warehouse_id: String,
    pub site_id: String,
    pub receiver_name: String,
    pub receiver_employee_id: Option<String>,
    pub receiver_department: Option<String>,
    pub unit_number: String,
    pub unit_name: String,
    pub unit_type: String,
    pub ct_number: Option<String>,
    pub serial_number: Option<String>,
    pub hm_km: Option<Decimal>,
    pub mechanic_name: String,
    pub mechanic_id: Option<String>,
    pub work_order_number: Option<String>,
    pub maintenance_type: Option<String>,
    pub priority: Option<String>,
    pub notes: Option<String>,
    pub latitude: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub device_id: Option<String>,
    pub client_uuid: Option<Uuid>,
    pub evidence_photo_url: Option<String>,
    pub document_url: Option<String>,
    pub mechanic_signature_url: Option<String>,
    pub signature_type: Option<String>,
    pub receipt_printed: Option<bool>,
    pub signed_receipt_photo_url: Option<String>,
    pub items: Vec<CreateIssueItem>,
}

#[derive(Debug, Deserialize)]
pub struct RecordReceiptPrintedRequest {
    pub signed_receipt_photo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IssueTransaction {
    pub id: Uuid,
    pub transaction_number: String,
    pub warehouse_id: String,
    pub site_id: String,
    pub receiver_name: String,
    pub receiver_employee_id: Option<String>,
    pub receiver_department: Option<String>,
    pub unit_number: String,
    pub unit_name: String,
    pub unit_type: String,
    pub ct_number: Option<String>,
    pub serial_number: Option<String>,
    pub hm_km: Option<Decimal>,
    pub mechanic_name: String,
    pub mechanic_id: Option<String>,
    pub work_order_number: Option<String>,
    pub maintenance_type: Option<String>,
    pub priority: String,
    pub status: String,
    pub notes: Option<String>,
    pub evidence_photo_url: Option<String>,
    pub document_url: Option<String>,
    pub mechanic_signature_url: Option<String>,
    pub signature_type: String,
    pub receipt_printed: bool,
    pub receipt_printed_at: Option<DateTime<Utc>>,
    pub signed_receipt_photo_url: Option<String>,
    pub created_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IssueTransactionItemDetail {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub spare_part_id: String,
    pub part_name: String,
    pub qty: Decimal,
    pub unit_of_measure: String,
}

// --- Replenishment Workflow ---
#[derive(Debug, Deserialize)]
pub struct CreateReplenishmentItem {
    pub spare_part_id: String,
    pub requested_qty: Decimal,
    pub recommended_qty: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReplenishmentRequest {
    pub container_warehouse_id: String,
    pub notes: Option<String>,
    pub items: Vec<CreateReplenishmentItem>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyReplenishmentItem {
    pub spare_part_id: String,
    pub verified_qty: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyReplenishmentRequest {
    pub admin_notes: Option<String>,
    pub items: Vec<VerifyReplenishmentItem>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveReplenishmentRequest {
    pub supervisor_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RejectReplenishmentRequest {
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReplenishmentRequest {
    pub id: Uuid,
    pub request_number: String,
    pub container_warehouse_id: String,
    pub main_warehouse_id: String,
    pub status: String,
    pub notes: Option<String>,
    pub admin_notes: Option<String>,
    pub supervisor_notes: Option<String>,
    pub requested_by: Uuid,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub shipped_by: Option<Uuid>,
    pub shipped_at: Option<DateTime<Utc>>,
    pub received_by: Option<Uuid>,
    pub received_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReplenishmentItemDetail {
    pub id: Uuid,
    pub request_id: Uuid,
    pub spare_part_id: String,
    pub part_name: String,
    pub requested_qty: Decimal,
    pub recommended_qty: Decimal,
    pub verified_qty: Decimal,
    pub approved_qty: Decimal,
    pub shipped_qty: Decimal,
    pub received_qty: Decimal,
    pub unit_of_measure: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecommendationItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub unit_of_measure: String,
    pub current_stock: Decimal,
    pub min_stock: Decimal,
    pub max_stock: Decimal,
    pub safety_stock: Decimal,
    pub lead_time_days: i32,
    pub avg_daily_usage: Decimal,
    pub recommended_order_qty: Decimal,
    // Enterprise Intelligence Fields (Phase 7)
    #[serde(default)]
    pub reorder_point: Option<Decimal>,
    #[serde(default)]
    pub in_transit_qty: Option<Decimal>,
    #[serde(default)]
    pub moving_avg_7d: Option<Decimal>,
    #[serde(default)]
    pub moving_avg_30d: Option<Decimal>,
    #[serde(default)]
    pub moving_avg_90d: Option<Decimal>,
    #[serde(default)]
    pub consumption_trend: Option<String>,
    #[serde(default)]
    pub seasonal_factor: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplenishmentIntelligenceItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub category_name: Option<String>,
    pub unit_of_measure: String,
    pub current_stock: Decimal,
    pub in_transit_qty: Decimal,
    pub effective_stock: Decimal,
    pub min_stock: Decimal,
    pub max_stock: Decimal,
    pub safety_stock: Decimal,
    pub lead_time_days: i32,
    pub avg_daily_usage: Decimal,
    pub moving_avg_7d: Decimal,
    pub moving_avg_30d: Decimal,
    pub moving_avg_90d: Decimal,
    pub consumption_trend: String,
    pub trend_percentage: Decimal,
    pub seasonal_factor: Decimal,
    pub seasonal_description: String,
    pub reorder_point: Decimal,
    pub is_reorder_needed: bool,
    pub recommended_purchase_qty: Decimal,
}

// --- Main Warehouse Drops ---
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MainDrop {
    pub id: Uuid,
    pub drop_number: String,
    pub request_id: Option<Uuid>,
    pub main_warehouse_id: String,
    pub container_warehouse_id: String,
    pub status: String,
    pub dropped_by: Uuid,
    pub received_by: Option<Uuid>,
    pub shipped_at: DateTime<Utc>,
    pub received_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MainDropItemDetail {
    pub id: Uuid,
    pub drop_id: Uuid,
    pub spare_part_id: String,
    pub part_name: String,
    pub qty: Decimal,
    pub unit_of_measure: String,
}

// --- Stock Adjustment ---
#[derive(Debug, Deserialize)]
pub struct CreateAdjustmentItem {
    pub spare_part_id: String,
    pub qty_physical: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdjustmentRequest {
    pub warehouse_id: String,
    pub reason: String,
    pub notes: Option<String>,
    pub items: Vec<CreateAdjustmentItem>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockAdjustmentHeader {
    pub id: Uuid,
    pub adjustment_number: String,
    pub warehouse_id: String,
    pub reason: String,
    pub notes: Option<String>,
    pub status: String,
    pub created_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockAdjustmentItemDetail {
    pub id: Uuid,
    pub adjustment_id: Uuid,
    pub spare_part_id: String,
    pub part_name: String,
    pub qty_system: Decimal,
    pub qty_physical: Decimal,
    pub difference: Decimal,
}

// --- Used Part Return Tracking (Core Return) ---
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UsedPartReturn {
    pub id: Uuid,
    pub return_number: String,
    pub issue_transaction_id: Uuid,
    pub spare_part_id: String,
    pub part_name: Option<String>,
    pub qty: Decimal,
    pub unit_of_measure: String,
    pub unit_number: String,
    pub mechanic_name: String,
    pub mechanic_id: Option<String>,
    pub warehouse_id: String,
    pub warehouse_name: Option<String>,
    pub status: String,
    pub current_holder_type: String,
    pub current_holder_name: String,
    pub container_received_at: Option<DateTime<Utc>>,
    pub container_received_by: Option<Uuid>,
    pub container_received_by_name: Option<String>,
    pub container_notes: Option<String>,
    pub container_photo_url: Option<String>,
    pub main_received_at: Option<DateTime<Utc>>,
    pub main_received_by: Option<Uuid>,
    pub main_received_by_name: Option<String>,
    pub main_warehouse_id: Option<String>,
    pub main_notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ReceiveContainerReturnRequest {
    pub container_notes: Option<String>,
    pub container_photo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TransferMainReturnRequest {
    pub main_warehouse_id: Option<String>,
    pub main_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CompleteReturnRequest {
    pub final_notes: Option<String>,
    pub disposition: Option<String>,
}

// --- Audit Log ---
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLogRecord {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub username: Option<String>,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<String>,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Default)]
pub struct AuditLogQuery {
    pub action: Option<String>,
    pub entity: Option<String>,
    pub user_id: Option<Uuid>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub total_pages: i64,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, total: i64, page: i64, limit: i64) -> Self {
        let total_pages = if limit > 0 {
            (total + limit - 1) / limit
        } else {
            1
        };
        Self {
            data,
            total,
            page,
            limit,
            total_pages,
        }
    }
}

// --- Auth & Session Management (Enterprise Standard) ---
#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_active: bool,
}

// --- Enhanced Stock Management (Multi-Warehouse, Bin, Batch, Serial) ---
#[derive(Debug, Deserialize)]
pub struct StockTransferRequest {
    pub from_warehouse_id: String,
    pub to_warehouse_id: String,
    pub spare_part_id: String,
    pub qty: Decimal,
    pub notes: Option<String>,
    pub batch_number: Option<String>,
    pub serial_number: Option<String>,
    pub from_bin_id: Option<Uuid>,
    pub to_bin_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct StockWriteOffRequest {
    pub warehouse_id: String,
    pub spare_part_id: String,
    pub movement_type: String, // "DAMAGE" or "LOST"
    pub qty: Decimal,
    pub notes: String,
    pub batch_number: Option<String>,
    pub serial_number: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct LedgerQuery {
    pub warehouse_id: Option<String>,
    pub spare_part_id: Option<String>,
    pub movement_type: Option<String>,
    pub batch_number: Option<String>,
    pub serial_number: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// --- Phase 8: Equipment Maintenance & Asset Integration ---
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct EquipmentComponentItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct EquipmentMaintenanceRecord {
    pub id: Uuid,
    pub work_order_number: String,
    pub equipment_id: String,
    pub unit_number: String,
    pub component_id: Option<String>,
    pub component_name: Option<String>,
    pub spare_part_id: Option<String>,
    pub part_name: Option<String>,
    pub failure_code: String,
    pub failure_symptom: String,
    pub maintenance_type: String,
    pub hm_km: Decimal,
    pub parts_qty: Decimal,
    pub parts_cost: Decimal,
    pub labor_cost: Decimal,
    pub total_cost: Decimal,
    pub downtime_hours: Decimal,
    pub mechanic_name: Option<String>,
    pub performed_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaintenanceLogRequest {
    pub work_order_number: String,
    pub equipment_id: String,
    pub component_id: Option<String>,
    pub spare_part_id: Option<String>,
    pub failure_code: String,
    pub failure_symptom: String,
    pub maintenance_type: Option<String>,
    pub hm_km: Decimal,
    pub parts_qty: Decimal,
    pub parts_cost: Option<Decimal>,
    pub labor_cost: Option<Decimal>,
    pub downtime_hours: Option<Decimal>,
    pub mechanic_name: Option<String>,
    pub performed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CostPerEquipmentReport {
    pub equipment_id: String,
    pub unit_number: String,
    pub equipment_type_id: Option<String>,
    pub model: Option<String>,
    pub total_parts_cost: Decimal,
    pub total_labor_cost: Decimal,
    pub grand_total_cost: Decimal,
    pub total_downtime_hours: Decimal,
    pub maintenance_count: i64,
    pub issue_parts_cost: Decimal,
    pub combined_total_cost: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HierarchicalConsumptionItem {
    pub equipment_id: String,
    pub unit_number: String,
    pub component_id: String,
    pub component_name: String,
    pub spare_part_id: String,
    pub part_name: String,
    pub total_qty_consumed: Decimal,
    pub total_spend: Decimal,
    pub failure_count: i64,
    pub latest_failure_code: Option<String>,
    pub latest_performed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Default)]
pub struct MaintenanceQuery {
    pub equipment_id: Option<String>,
    pub component_id: Option<String>,
    pub spare_part_id: Option<String>,
    pub failure_code: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// --- Phase 9: Multi-Channel Notification Engine ---
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub recipient_role: Option<String>,
    pub recipient_email: Option<String>,
    pub recipient_phone: Option<String>,
    pub title: String,
    pub message: String,
    pub channel: String,
    pub trigger_type: String,
    pub reference_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub is_read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub delivery_status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNotificationRequest {
    pub user_id: Option<Uuid>,
    pub recipient_role: Option<String>,
    pub recipient_email: Option<String>,
    pub recipient_phone: Option<String>,
    pub title: String,
    pub message: String,
    pub channel: Option<String>, // "IN_APP", "EMAIL", "WHATSAPP"
    pub trigger_type: String, // "LOW_STOCK", "APPROVAL_REQUEST", "APPROVAL_COMPLETED", "ABNORMAL_CONSUMPTION", "REJECTED_TRANSACTION"
    pub reference_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct NotificationQuery {
    pub is_read: Option<bool>,
    pub channel: Option<String>,
    pub trigger_type: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WhatsAppNotificationPayload {
    pub to: String,
    pub message: String,
    pub template: Option<String>,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailNotificationPayload {
    pub to: String,
    pub subject: String,
    pub body: String,
}

// --- Phase 10: Enterprise Dashboard KPIs & Velocity ---
#[derive(Debug, Serialize, Deserialize)]
pub struct EnterpriseKpiSummary {
    pub total_stock_value: Decimal,
    pub total_inventory_items: i64,
    pub total_in_transit_qty: Decimal,
    pub pending_approvals_count: i64,
    pub stock_in_last_30d: Decimal,
    pub stock_out_last_30d: Decimal,
    pub total_warehouses: i64,
    pub low_stock_items_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FastSlowMovingPartItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub category_name: Option<String>,
    pub unit_of_measure: String,
    pub current_stock: Decimal,
    pub unit_cost: Decimal,
    pub total_value: Decimal,
    pub total_issued_30d: Decimal,
    pub issue_frequency: i64,
    pub turnover_velocity: String, // "FAST_MOVING", "MODERATE", "SLOW_MOVING", "NON_MOVING"
    pub days_since_last_movement: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAgingSummary {
    pub age_under_30_days_value: Decimal,
    pub age_under_30_days_count: i64,
    pub age_31_to_90_days_value: Decimal,
    pub age_31_to_90_days_count: i64,
    pub age_91_to_180_days_value: Decimal,
    pub age_91_to_180_days_count: i64,
    pub age_over_180_days_value: Decimal,
    pub age_over_180_days_count: i64,
}

// --- Phase 11: Enterprise Reporting & Analytics Entities ---

#[derive(Debug, Serialize, Deserialize)]
pub struct StockBalanceReportItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub category_name: Option<String>,
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub rack_location: Option<String>,
    pub qty_on_hand: Decimal,
    pub min_stock: Decimal,
    pub max_stock: Decimal,
    pub safety_stock: Decimal,
    pub unit_of_measure: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockValuationReportItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub category_name: Option<String>,
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub qty_on_hand: Decimal,
    pub unit_cost: Decimal,
    pub total_value: Decimal,
    pub share_percentage: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAgingReportItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub qty: Decimal,
    pub unit_cost: Decimal,
    pub total_value: Decimal,
    pub days_in_inventory: i64,
    pub aging_bucket: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IssueHistoryReportItem {
    pub transaction_number: String,
    pub issued_at: DateTime<Utc>,
    pub warehouse_id: String,
    pub unit_number: String,
    pub hm_km: Option<Decimal>,
    pub site_id: String,
    pub receiver_name: String,
    pub mechanic_name: String,
    pub work_order_number: Option<String>,
    pub spare_part_id: String,
    pub part_name: String,
    pub qty: Decimal,
    pub unit_price: Decimal,
    pub total_price: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConsumptionTrendReportItem {
    pub period: String,
    pub category_name: String,
    pub total_transactions: i64,
    pub total_qty: Decimal,
    pub total_value: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EquipmentConsumptionReportItem {
    pub equipment_number: String,
    pub equipment_type: String,
    pub model: String,
    pub site: String,
    pub current_hm: Decimal,
    pub total_transactions: i64,
    pub total_parts_qty: Decimal,
    pub total_cost: Decimal,
    pub cost_per_hm: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WarehousePerformanceReportItem {
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub warehouse_type: String,
    pub total_skus: i64,
    pub total_valuation: Decimal,
    pub total_issues_30d: i64,
    pub total_drops_30d: i64,
    pub turnover_ratio: Decimal,
    pub low_stock_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplenishmentEfficiencyReportItem {
    pub request_number: String,
    pub container_warehouse_id: String,
    pub container_warehouse_name: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub verified_at: Option<DateTime<Utc>>,
    pub approved_at: Option<DateTime<Utc>>,
    pub received_at: Option<DateTime<Utc>>,
    pub lead_time_hours: Option<Decimal>,
    pub items_requested: i64,
    pub total_qty_requested: Decimal,
    pub total_qty_received: Decimal,
    pub fulfillment_accuracy_percent: Decimal,
}

// ============================================================================
// Permohonan Stock Mekanik (Mechanic Stock Request)
// ============================================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MechanicRequest {
    pub id: Uuid,
    pub request_number: String,
    pub request_type: String, // 'REPLACEMENT', 'RETURN'
    pub warehouse_id: String,
    pub site_id: Option<String>,
    pub status: String, // 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'
    pub unit_number: Option<String>,
    pub unit_name: Option<String>,
    pub unit_type: Option<String>,
    pub ct_number: Option<String>,
    pub serial_number: Option<String>,
    pub hm_km: Option<Decimal>,
    pub work_order_number: Option<String>,
    pub maintenance_type: Option<String>,
    pub priority: String,
    pub mechanic_id: Option<String>,
    pub mechanic_name: String,
    pub requester_user_id: Option<Uuid>,
    pub requester_name: Option<String>,
    pub input_channel: String, // 'MECHANIC', 'ADMIN_CONTAINER', 'MOBILE'
    pub damage_category: Option<String>,
    pub damage_description: Option<String>,
    pub damage_photo_url: Option<String>,
    pub old_part_photo_url: Option<String>,
    pub document_url: Option<String>,
    pub return_reason: Option<String>,
    pub reference_issue_number: Option<String>,
    pub notes: Option<String>,
    pub revision_notes: Option<String>,
    pub revision_count: i32,
    pub approved_by: Option<Uuid>,
    pub approved_by_name: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub approve_notes: Option<String>,
    pub rejected_by: Option<Uuid>,
    pub rejected_by_name: Option<String>,
    pub rejected_at: Option<DateTime<Utc>>,
    pub reject_reason: Option<String>,
    pub fulfilled_by: Option<Uuid>,
    pub fulfilled_by_name: Option<String>,
    pub fulfilled_at: Option<DateTime<Utc>>,
    pub fulfill_notes: Option<String>,
    pub issue_transaction_id: Option<Uuid>,
    pub issue_transaction_number: Option<String>,
    pub client_uuid: Option<Uuid>,
    pub device_id: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub items_count: Option<i64>,
    pub total_qty: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MechanicRequestItem {
    pub id: Uuid,
    pub request_id: Uuid,
    pub spare_part_id: String,
    pub part_name: String,
    pub unit_of_measure: String,
    pub requested_qty: Decimal,
    pub approved_qty: Option<Decimal>,
    pub fulfilled_qty: Option<Decimal>,
    pub item_condition: Option<String>,
    pub notes: Option<String>,
    pub stock_on_hand: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MechanicRequestHistory {
    pub id: Uuid,
    pub request_id: Uuid,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: String,
    pub actor_id: Option<Uuid>,
    pub actor_name: Option<String>,
    pub actor_role: Option<String>,
    pub notes: Option<String>,
    pub changes: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct MechanicRequestSummary {
    pub total: i64,
    pub submitted: i64,
    pub revision_requested: i64,
    pub approved: i64,
    pub completed: i64,
    pub rejected: i64,
    pub cancelled: i64,
}

#[derive(Debug, Deserialize)]
pub struct MechanicRequestFilterQuery {
    pub warehouse_id: Option<String>,
    pub status: Option<String>,
    pub request_type: Option<String>,
    pub search: Option<String>,
    pub mine: Option<bool>,
    pub force: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMechanicRequestPayload {
    pub request_type: String, // 'REPLACEMENT', 'RETURN'
    pub warehouse_id: String,
    pub site_id: Option<String>,
    pub unit_number: Option<String>,
    pub unit_name: Option<String>,
    pub unit_type: Option<String>,
    pub ct_number: Option<String>,
    pub serial_number: Option<String>,
    pub hm_km: Option<Decimal>,
    pub work_order_number: Option<String>,
    pub maintenance_type: Option<String>,
    pub priority: Option<String>,
    pub mechanic_id: Option<String>,
    pub mechanic_name: Option<String>,
    pub damage_category: Option<String>,
    pub damage_description: Option<String>,
    pub damage_photo_url: Option<String>,
    pub old_part_photo_url: Option<String>,
    pub document_url: Option<String>,
    pub return_reason: Option<String>,
    pub reference_issue_number: Option<String>,
    pub notes: Option<String>,
    pub client_uuid: Option<Uuid>,
    pub device_id: Option<String>,
    pub items: Vec<CreateMechanicRequestItemPayload>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CreateMechanicRequestItemPayload {
    pub spare_part_id: String,
    pub qty: Decimal,
    pub item_condition: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMechanicRequestPayload {
    pub request_type: Option<String>,
    pub warehouse_id: Option<String>,
    pub site_id: Option<String>,
    pub unit_number: Option<String>,
    pub unit_name: Option<String>,
    pub unit_type: Option<String>,
    pub ct_number: Option<String>,
    pub serial_number: Option<String>,
    pub hm_km: Option<Decimal>,
    pub work_order_number: Option<String>,
    pub maintenance_type: Option<String>,
    pub priority: Option<String>,
    pub mechanic_id: Option<String>,
    pub mechanic_name: Option<String>,
    pub damage_category: Option<String>,
    pub damage_description: Option<String>,
    pub damage_photo_url: Option<String>,
    pub old_part_photo_url: Option<String>,
    pub document_url: Option<String>,
    pub return_reason: Option<String>,
    pub reference_issue_number: Option<String>,
    pub notes: Option<String>,
    pub items: Option<Vec<CreateMechanicRequestItemPayload>>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveMechanicRequestPayload {
    pub notes: Option<String>,
    pub items: Option<Vec<ApproveItemPayload>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ApproveItemPayload {
    pub item_id: Uuid,
    pub qty: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct RequestRevisionPayload {
    pub notes: String,
}

#[derive(Debug, Deserialize)]
pub struct RejectMechanicRequestPayload {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CancelMechanicRequestPayload {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FulfillMechanicRequestPayload {
    pub notes: Option<String>,
    pub items: Option<Vec<ApproveItemPayload>>,
}

// --- Mobile Devices Master Data ---
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MobileDevice {
    pub device_id: String,
    pub device_name: String,
    pub assigned_warehouse_id: Option<String>,
    pub assigned_warehouse_name: Option<String>,
    pub assigned_user_id: Option<Uuid>,
    pub assigned_user_name: Option<String>,
    pub app_version: Option<String>,
    pub is_active: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub photo_url: Option<String>,
    pub qr_code: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMobileDeviceRequest {
    pub device_id: String,
    pub device_name: String,
    pub assigned_warehouse_id: Option<String>,
    pub assigned_user_id: Option<Uuid>,
    pub app_version: Option<String>,
    pub photo_url: Option<String>,
    pub qr_code: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMobileDeviceRequest {
    pub device_name: Option<String>,
    pub assigned_warehouse_id: Option<String>,
    pub assigned_user_id: Option<Uuid>,
    pub app_version: Option<String>,
    pub photo_url: Option<String>,
    pub qr_code: Option<String>,
    pub is_active: Option<bool>,
}
