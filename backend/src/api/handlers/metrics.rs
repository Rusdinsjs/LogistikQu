use crate::api::handlers::auth::AppState;
use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use std::time::Instant;

static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

pub async fn prometheus_metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let start = START_TIME.get_or_init(Instant::now);
    let uptime_secs = start.elapsed().as_secs();

    // Query active pool metrics
    let pool_size = state.pool.size();
    let num_idle = state.pool.num_idle();

    // Query high-level enterprise metrics
    let (total_stock_value, total_items, low_stock_items): (f64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(s.qty_on_hand * COALESCE(p.unit_cost, 0)), 0)::float8,
            COUNT(s.id)::int8,
            COUNT(s.id) FILTER (WHERE s.qty_on_hand <= s.min_stock)::int8
        FROM inventory_stock s
        JOIN spare_parts p ON s.spare_part_id = p.id
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0.0, 0, 0));

    let unread_notifications: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::int8 FROM notifications WHERE is_read = false")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let pending_replenishments: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::int8 FROM replenishment_requests WHERE status IN ('REQUESTED', 'VERIFIED')"
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Format metrics in Prometheus exposition format
    let mut out = String::new();

    out.push_str(
        "# HELP logisticqu_uptime_seconds Total runtime of LogisticQu backend server in seconds\n",
    );
    out.push_str("# TYPE logisticqu_uptime_seconds counter\n");
    out.push_str(&format!("logisticqu_uptime_seconds {}\n\n", uptime_secs));

    out.push_str(
        "# HELP logisticqu_db_pool_connections Current PostgreSQL connection pool statistics\n",
    );
    out.push_str("# TYPE logisticqu_db_pool_connections gauge\n");
    out.push_str(&format!(
        "logisticqu_db_pool_connections{{state=\"total\"}} {}\n",
        pool_size
    ));
    out.push_str(&format!(
        "logisticqu_db_pool_connections{{state=\"idle\"}} {}\n",
        num_idle
    ));
    out.push_str(&format!(
        "logisticqu_db_pool_connections{{state=\"active\"}} {}\n\n",
        pool_size.saturating_sub(num_idle as u32)
    ));

    out.push_str("# HELP logisticqu_inventory_total_value_idr Total current inventory capital valuation in IDR\n");
    out.push_str("# TYPE logisticqu_inventory_total_value_idr gauge\n");
    out.push_str(&format!(
        "logisticqu_inventory_total_value_idr {:.2}\n\n",
        total_stock_value
    ));

    out.push_str("# HELP logisticqu_inventory_items_total Total active spare part items monitored across warehouses\n");
    out.push_str("# TYPE logisticqu_inventory_items_total gauge\n");
    out.push_str(&format!(
        "logisticqu_inventory_items_total {}\n\n",
        total_items
    ));

    out.push_str("# HELP logisticqu_low_stock_items_total Number of items currently at or below minimum threshold\n");
    out.push_str("# TYPE logisticqu_low_stock_items_total gauge\n");
    out.push_str(&format!(
        "logisticqu_low_stock_items_total {}\n\n",
        low_stock_items
    ));

    out.push_str("# HELP logisticqu_unread_notifications_total Total unread operational notifications in the system\n");
    out.push_str("# TYPE logisticqu_unread_notifications_total gauge\n");
    out.push_str(&format!(
        "logisticqu_unread_notifications_total {}\n\n",
        unread_notifications
    ));

    out.push_str("# HELP logisticqu_pending_replenishments_total Total replenishment requests awaiting approval\n");
    out.push_str("# TYPE logisticqu_pending_replenishments_total gauge\n");
    out.push_str(&format!(
        "logisticqu_pending_replenishments_total {}\n",
        pending_replenishments
    ));

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
    );

    (StatusCode::OK, headers, out)
}
