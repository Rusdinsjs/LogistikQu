pub mod handlers;
pub mod middleware;

use axum::{
    routing::{get, post, put},
    Router,
};
use handlers::{
    adjustment::{approve_adjustment, create_adjustment, list_adjustments},
    audit::list_audit_logs,
    auth::{
        create_user, get_me, list_demo_users, list_roles, list_users, login, update_my_profile,
        update_user, AppState,
    },
    drop::{get_drop_detail, list_main_drops},
    inventory::{
        get_dashboard_summary, get_stock_movements, import_initial_stock, list_inventory_stock,
    },
    issue::{approve_critical_issue, create_issue, get_issue_detail, list_issues},
    master::{
        create_employee, create_equipment, create_site, create_warehouse, delete_site,
        delete_warehouse, list_employees, list_equipment, list_sites, list_spare_parts,
        list_warehouses, update_site, update_spare_part, update_warehouse,
    },
    replenishment::{
        approve_request, create_request, get_recommendations, get_request_detail, list_requests,
        receive_drop, return_to_container, supervisor_reject, verify_request,
    },
    reports::{report_by_mechanic, report_by_site, report_by_unit},
    returns::{
        complete_return, get_return_detail, list_returns, receive_at_container, transfer_to_main,
    },
    sync::{sync_pull, sync_push},
};

pub fn build_router(state: AppState) -> Router {
    let api_routes = Router::new()
        // Auth & User Management
        .route("/auth/login", post(login))
        .route("/auth/me", get(get_me))
        .route("/auth/profile", put(update_my_profile))
        .route("/auth/demo-users", get(list_demo_users))
        .route("/users", get(list_users).post(create_user))
        .route("/users/{id}", put(update_user))
        .route("/roles", get(list_roles))
        // Master
        .route("/master/spare-parts", get(list_spare_parts))
        .route("/master/spare-parts/{id}", put(update_spare_part))
        .route("/master/equipment", get(list_equipment).post(create_equipment))
        .route("/master/employees", get(list_employees).post(create_employee))
        .route("/master/sites", get(list_sites).post(create_site))
        .route("/master/sites/{id}", put(update_site).delete(delete_site))
        .route("/master/warehouses", get(list_warehouses).post(create_warehouse))
        .route("/master/warehouses/{id}", put(update_warehouse).delete(delete_warehouse))
        // Inventory
        .route("/inventory/stock", get(list_inventory_stock))
        .route("/inventory/stock/{warehouse_id}/{spare_part_id}/movements", get(get_stock_movements))
        .route("/inventory/import-initial", post(import_initial_stock))
        .route("/inventory/dashboard-summary", get(get_dashboard_summary))
        // Issue POS
        .route("/issues", post(create_issue).get(list_issues))
        .route("/issues/{id}", get(get_issue_detail))
        .route("/issues/{id}/approve", post(approve_critical_issue))
        // Used Part Return Tracking (Core Return)
        .route("/returns", get(list_returns))
        .route("/returns/{id}", get(get_return_detail))
        .route("/returns/{id}/receive-container", post(receive_at_container))
        .route("/returns/{id}/transfer-main", post(transfer_to_main))
        .route("/returns/{id}/complete", post(complete_return))
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
