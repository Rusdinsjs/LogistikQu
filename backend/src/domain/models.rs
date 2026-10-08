use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// --- Authentication & Users ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,            // User ID
    pub username: String,
    pub role_id: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub username: String,
    pub full_name: String,
    pub role_id: String,
    pub role_name: String,
    pub warehouses: Vec<WarehouseInfo>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WarehouseInfo {
    pub id: String,
    pub name: String,
    pub warehouse_type: String,
    pub category: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserProfile,
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
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Equipment {
    pub id: String,
    pub unit_number: String,
    pub ct_number: Option<String>,
    pub name: String,
    pub equipment_type_id: Option<String>,
    pub serial_number: Option<String>,
    pub current_hm_km: Decimal,
    pub current_site_id: Option<String>,
    pub qr_code: Option<String>,
    pub is_active: bool,
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

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Site {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
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
    pub status: String, // 'NORMAL', 'WARNING', 'CRITICAL'
    pub updated_at: DateTime<Utc>,
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
    pub created_at: DateTime<Utc>,
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
    pub items: Vec<CreateIssueItem>,
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

// --- Main Drops ---
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

// --- Dashboard Summary ---
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
