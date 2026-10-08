pub mod handlers;
pub mod middleware;

use axum::{
    routing::{get, post, put},
    Router,
};
use handlers::{
    adjustment::{approve_adjustment, create_adjustment, list_adjustments},
    audit::list_audit_logs,
    auth::{get_me, list_demo_users, login, AppState},
    drop::{get_drop_detail, list_main_drops},
    inventory::{
        get_dashboard_summary, get_stock_movements, import_initial_stock, list_inventory_stock,
    },
    issue::{approve_critical_issue, create_issue, get_issue_detail, list_issues},
    master::{list_employees, list_equipment, list_sites, list_spare_parts, list_warehouses},
    replenishment::{
        approve_request, create_request, get_recommendations, get_request_detail, list_requests,
        receive_drop, return_to_container, supervisor_reject, verify_request,
    },
    reports::{report_by_mechanic, report_by_site, report_by_unit},
    sync::{sync_pull, sync_push},
};

pub fn build_router(state: AppState) -> Router {
    let api_routes = Router::new()
        // Auth
        .route("/auth/login", post(login))
        .route("/auth/me", get(get_me))
        .route("/auth/demo-users", get(list_demo_users))
        // Master
        .route("/master/spare-parts", get(list_spare_parts))
        .route("/master/equipment", get(list_equipment))
        .route("/master/employees", get(list_employees))
        .route("/master/sites", get(list_sites))
        .route("/master/warehouses", get(list_warehouses))
        // Inventory
        .route("/inventory/stock", get(list_inventory_stock))
        .route("/inventory/stock/{warehouse_id}/{spare_part_id}/movements", get(get_stock_movements))
        .route("/inventory/import-initial", post(import_initial_stock))
        .route("/inventory/dashboard-summary", get(get_dashboard_summary))
        // Issue POS
        .route("/issues", post(create_issue).get(list_issues))
        .route("/issues/{id}", get(get_issue_detail))
        .route("/issues/{id}/approve", post(approve_critical_issue))
        // Replenishment
        .route("/replenishment/recommendations", get(get_recommendations))
        .route("/replenishment/requests", post(create_request).get(list_requests))
        .route("/replenishment/requests/{id}", get(get_request_detail))
        .route("/replenishment/requests/{id}/verify", put(verify_request))
        .route("/replenishment/requests/{id}/approve", put(approve_request))
        .route("/replenishment/requests/{id}/supervisor-reject", put(supervisor_reject))
        .route("/replenishment/requests/{id}/return-to-container", put(return_to_container))
        .route("/replenishment/requests/{id}/receive", post(receive_drop))
        // Main Warehouse Drops
        .route("/drops", get(list_main_drops))
        .route("/drops/{id}", get(get_drop_detail))
        // Adjustments
        .route("/adjustments", post(create_adjustment).get(list_adjustments))
        .route("/adjustments/{id}/approve", put(approve_adjustment))
        // Reports
        .route("/reports/consumption-by-unit", get(report_by_unit))
        .route("/reports/consumption-by-site", get(report_by_site))
        .route("/reports/consumption-by-mechanic", get(report_by_mechanic))
        // Audit
        .route("/audit-logs", get(list_audit_logs))
        // Sync
        .route("/sync/pull", get(sync_pull))
        .route("/sync/push", post(sync_push));

    Router::new()
        .nest("/api/v1", api_routes)
        .route("/health", get(|| async { "OK" }))
        .with_state(state)
}
