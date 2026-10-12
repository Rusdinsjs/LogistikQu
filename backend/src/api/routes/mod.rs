use crate::api::handlers::{
    adjustment::{approve_adjustment, create_adjustment, list_adjustments},
    audit::list_audit_logs,
    auth::{
        create_user, delete_user, get_me, list_demo_users, list_permissions, list_roles,
        list_sessions, list_users, login, logout, refresh_token, revoke_session, update_my_profile,
        update_role_permissions, update_user, AppState,
    },
    bins::{
        create_warehouse_bin, delete_warehouse_bin, list_warehouse_bins, relocate_stock_bin,
        update_warehouse_bin,
    },
    dashboard::{get_enterprise_kpis, get_stock_aging, get_stock_velocity},
    drop::{get_drop_detail, list_main_drops},
    inventory::{
        get_dashboard_summary, get_stock_detail, get_stock_movements, import_initial_stock,
        list_inventory_stock, query_ledger, transfer_stock, update_stock_photo, write_off_stock,
    },
    issue::{approve_critical_issue, create_issue, get_issue_detail, list_issues},
    maintenance::{
        create_maintenance_log, get_cost_per_equipment, get_hierarchical_consumption,
        list_components, list_maintenance_history,
    },
    master::{
        create_employee, create_equipment, create_site, create_warehouse,
        create_warehouse_category, delete_site, delete_warehouse, delete_warehouse_category,
        list_employees, list_equipment, list_sites, list_spare_parts, list_warehouse_categories,
        list_warehouses, update_site, update_spare_part, update_warehouse,
        update_warehouse_category,
    },
    metrics::prometheus_metrics_handler,
    notifications::{
        create_notification, get_unread_count, list_notifications, mark_all_read, mark_as_read,
    },
    replenishment::{
        approve_request, create_request, get_recommendations, get_replenishment_intelligence,
        get_request_detail, list_requests, receive_drop, return_to_container, supervisor_reject,
        verify_request,
    },
    reports::{
        report_by_mechanic, report_by_site, report_by_unit, report_consumption_trend,
        report_equipment_consumption, report_issue_history, report_replenishment_efficiency,
        report_stock_aging, report_stock_balance, report_stock_valuation,
        report_warehouse_performance,
    },
    returns::{
        complete_return, get_return_detail, list_returns, receive_at_container, transfer_to_main,
    },
    sync::{
        mobile_batch_sync_handler, mobile_conflict_resolution_handler, mobile_delta_pull_handler,
    },
};
use axum::{
    routing::{delete, get, post, put},
    Router,
};

pub fn create_api_router(state: AppState) -> Router {
    let api_v1 = Router::new()
        // Auth & User Management (Enterprise Standard)
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh_token))
        .route("/auth/logout", post(logout))
        .route("/auth/sessions", get(list_sessions))
        .route("/auth/sessions/{id}", delete(revoke_session))
        .route("/auth/me", get(get_me))
        .route("/auth/profile", put(update_my_profile))
        .route("/auth/demo-users", get(list_demo_users))
        .route("/users", get(list_users).post(create_user))
        .route("/users/{id}", put(update_user).delete(delete_user))
        .route("/roles", get(list_roles))
        .route("/roles/{id}/permissions", put(update_role_permissions))
        .route("/permissions", get(list_permissions))
        // Master Data
        .route("/master/spare-parts", get(list_spare_parts))
        .route("/master/spare-parts/{id}", put(update_spare_part))
        .route(
            "/master/equipment",
            get(list_equipment).post(create_equipment),
        )
        .route(
            "/master/employees",
            get(list_employees).post(create_employee),
        )
        .route("/master/sites", get(list_sites).post(create_site))
        .route("/master/sites/{id}", put(update_site).delete(delete_site))
        .route(
            "/master/warehouses",
            get(list_warehouses).post(create_warehouse),
        )
        .route(
            "/master/warehouses/{id}",
            put(update_warehouse).delete(delete_warehouse),
        )
        .route(
            "/master/warehouse-categories",
            get(list_warehouse_categories).post(create_warehouse_category),
        )
        .route(
            "/master/warehouse-categories/{id}",
            put(update_warehouse_category).delete(delete_warehouse_category),
        )
        // Warehouse Bins & Container Racks
        .route(
            "/warehouses/{warehouse_id}/bins",
            get(list_warehouse_bins).post(create_warehouse_bin),
        )
        .route(
            "/warehouses/{warehouse_id}/bins/{bin_id}",
            put(update_warehouse_bin).delete(delete_warehouse_bin),
        )
        .route(
            "/warehouses/{warehouse_id}/bins/relocate",
            post(relocate_stock_bin),
        )
        // Inventory & Immutable Stock Ledger
        .route("/inventory/stock", get(list_inventory_stock))
        .route(
            "/inventory/stock/{warehouse_id}/{spare_part_id}",
            get(get_stock_detail),
        )
        .route(
            "/inventory/stock/{warehouse_id}/{spare_part_id}/photo",
            put(update_stock_photo),
        )
        .route(
            "/inventory/stock/{warehouse_id}/{spare_part_id}/movements",
            get(get_stock_movements),
        )
        .route("/inventory/ledger", get(query_ledger))
        .route("/inventory/transfer", post(transfer_stock))
        .route("/inventory/write-off", post(write_off_stock))
        .route("/inventory/import-initial", post(import_initial_stock))
        .route("/inventory/dashboard-summary", get(get_dashboard_summary))
        // Issue POS
        .route("/issues", post(create_issue).get(list_issues))
        .route("/issues/{id}", get(get_issue_detail))
        .route("/issues/{id}/approve", post(approve_critical_issue))
        // Used Part Return Tracking (Core Return)
        .route("/returns", get(list_returns))
        .route("/returns/{id}", get(get_return_detail))
        .route(
            "/returns/{id}/receive-container",
            post(receive_at_container),
        )
        .route("/returns/{id}/transfer-main", post(transfer_to_main))
        .route("/returns/{id}/complete", post(complete_return))
        // Replenishment & Intelligence Engine (Phase 7)
        .route("/replenishment/recommendations", get(get_recommendations))
        .route(
            "/replenishment/intelligence",
            get(get_replenishment_intelligence),
        )
        .route(
            "/replenishment/requests",
            post(create_request).get(list_requests),
        )
        .route("/replenishment/requests/{id}", get(get_request_detail))
        .route("/replenishment/requests/{id}/verify", put(verify_request))
        .route("/replenishment/requests/{id}/approve", put(approve_request))
        .route(
            "/replenishment/requests/{id}/supervisor-reject",
            put(supervisor_reject),
        )
        .route(
            "/replenishment/requests/{id}/return-to-container",
            put(return_to_container),
        )
        .route("/replenishment/requests/{id}/receive", post(receive_drop))
        // Main Warehouse Drops
        .route("/drops", get(list_main_drops))
        .route("/drops/{id}", get(get_drop_detail))
        // Equipment Maintenance & Asset Integration (Phase 8)
        .route("/maintenance/components", get(list_components))
        .route(
            "/maintenance/history",
            get(list_maintenance_history).post(create_maintenance_log),
        )
        .route(
            "/maintenance/cost-per-equipment",
            get(get_cost_per_equipment),
        )
        .route(
            "/maintenance/consumption-analysis",
            get(get_hierarchical_consumption),
        )
        // Stock Adjustments
        .route(
            "/adjustments",
            post(create_adjustment).get(list_adjustments),
        )
        .route("/adjustments/{id}/approve", put(approve_adjustment))
        // Reports (Legacy & Enterprise Phase 11)
        .route("/reports/consumption-by-unit", get(report_by_unit))
        .route("/reports/consumption-by-site", get(report_by_site))
        .route("/reports/consumption-by-mechanic", get(report_by_mechanic))
        .route("/reports/inventory/balance", get(report_stock_balance))
        .route("/reports/inventory/valuation", get(report_stock_valuation))
        .route("/reports/inventory/aging", get(report_stock_aging))
        .route(
            "/reports/operation/issue-history",
            get(report_issue_history),
        )
        .route(
            "/reports/operation/consumption",
            get(report_consumption_trend),
        )
        .route(
            "/reports/operation/equipment",
            get(report_equipment_consumption),
        )
        .route(
            "/reports/management/warehouse-performance",
            get(report_warehouse_performance),
        )
        .route(
            "/reports/management/replenishment-efficiency",
            get(report_replenishment_efficiency),
        )
        // Audit Logs (Multi-route compatibility)
        .route("/audit-logs", get(list_audit_logs))
        .route("/audit/logs", get(list_audit_logs))
        // Enterprise Multi-Channel Notifications (Phase 9)
        .route(
            "/notifications",
            get(list_notifications).post(create_notification),
        )
        .route("/notifications/{id}/read", put(mark_as_read))
        .route("/notifications/read-all", put(mark_all_read))
        .route("/notifications/unread-count", get(get_unread_count))
        // Enterprise Dashboard KPIs, Velocity & Aging (Phase 10)
        .route("/dashboard/enterprise-kpi", get(get_enterprise_kpis))
        .route("/dashboard/enterprise-kpis", get(get_enterprise_kpis))
        .route("/dashboard/stock-velocity", get(get_stock_velocity))
        .route("/dashboard/stock-aging", get(get_stock_aging))
        // Mobile Sync Engine (Offline-First Enterprise Standards)
        .route("/mobile/sync", post(mobile_batch_sync_handler))
        .route("/mobile/pull", get(mobile_delta_pull_handler))
        .route(
            "/mobile/conflict-resolution",
            post(mobile_conflict_resolution_handler),
        )
        .route("/sync/pull", get(mobile_delta_pull_handler))
        .route("/sync/push", post(mobile_batch_sync_handler));

    let mobile_api = Router::new()
        .route("/sync", post(mobile_batch_sync_handler))
        .route("/pull", get(mobile_delta_pull_handler))
        .route("/sync/pull", get(mobile_delta_pull_handler))
        .route(
            "/conflict-resolution",
            post(mobile_conflict_resolution_handler),
        );

    Router::new()
        .nest("/api/v1", api_v1)
        .nest("/api/mobile", mobile_api)
        .route("/health", get(|| async { "OK" }))
        .route("/metrics", get(prometheus_metrics_handler))
        .with_state(state)
}
