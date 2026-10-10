use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_warehouse_access, AuthUser},
    },
    domain::models::{DashboardSummary, InventoryStockItem, StockMovement},
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct InventoryQuery {
    pub warehouse_id: Option<String>,
    pub search: Option<String>,
    pub status: Option<String>, // 'NORMAL', 'WARNING', 'CRITICAL'
}

pub async fn list_inventory_stock(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<InventoryQuery>,
) -> Result<Json<Vec<InventoryStockItem>>, AppError> {
    let warehouse_id = query.warehouse_id.unwrap_or_else(|| "WH-CONT-HE".to_string());
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let search = query.search.unwrap_or_default();
    let search_pattern = format!("%{}%", search);

    let rows = sqlx::query!(
        r#"
        SELECT s.id, s.warehouse_id, w.name as warehouse_name,
               s.spare_part_id, p.part_name, pc.name as category_name,
               p.brand, p.unit_of_measure, s.qty_on_hand, s.min_stock,
               s.max_stock, s.safety_stock, s.rack_location,
               p.critical_level, p.requires_issue_approval, p.requires_core_return, s.updated_at,
               CASE
                   WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                   WHEN s.qty_on_hand <= (s.min_stock * 1.25) THEN 'WARNING'
                   ELSE 'NORMAL'
               END as status
        FROM inventory_stock s
        INNER JOIN warehouses w ON s.warehouse_id = w.id
        INNER JOIN spare_parts p ON s.spare_part_id = p.id
        LEFT JOIN part_categories pc ON p.category_id = pc.id
        WHERE s.warehouse_id = $1
          AND ($2 = '' OR s.spare_part_id ILIKE $3 OR p.part_name ILIKE $3)
        ORDER BY
            CASE
                WHEN s.qty_on_hand <= s.min_stock THEN 1
                WHEN s.qty_on_hand <= (s.min_stock * 1.25) THEN 2
                ELSE 3
            END,
            s.spare_part_id
        "#,
        warehouse_id,
        search,
        search_pattern
    )
    .fetch_all(&state.pool)
    .await?;

    let items = rows
        .into_iter()
        .map(|r| InventoryStockItem {
            id: r.id,
            warehouse_id: r.warehouse_id,
            warehouse_name: r.warehouse_name,
            spare_part_id: r.spare_part_id,
            part_name: r.part_name,
            category_name: Some(r.category_name),
            brand: r.brand,
            unit_of_measure: r.unit_of_measure,
            qty_on_hand: r.qty_on_hand,
            min_stock: r.min_stock,
            max_stock: r.max_stock,
            safety_stock: r.safety_stock,
            rack_location: r.rack_location,
            critical_level: r.critical_level,
            requires_issue_approval: r.requires_issue_approval,
            requires_core_return: r.requires_core_return,
            status: r.status.unwrap_or_else(|| "NORMAL".to_string()),
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(items))
}

pub async fn get_stock_movements(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, spare_part_id)): Path<(String, String)>,
) -> Result<Json<Vec<StockMovement>>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let movements = sqlx::query_as!(
        StockMovement,
        r#"
        SELECT id, warehouse_id, spare_part_id, movement_type,
               qty, balance_after, reference_number, notes, created_at
        FROM stock_movements
        WHERE warehouse_id = $1 AND spare_part_id = $2
        ORDER BY created_at DESC
        LIMIT 100
        "#,
        warehouse_id,
        spare_part_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(movements))
}

#[derive(Debug, Deserialize)]
pub struct ImportStockRow {
    pub spare_part_id: String,
    pub qty_on_hand: Decimal,
    pub min_stock: Option<Decimal>,
    pub max_stock: Option<Decimal>,
    pub safety_stock: Option<Decimal>,
    pub rack_location: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImportStockPayload {
    pub warehouse_id: String,
    pub rows: Vec<ImportStockRow>,
}

pub async fn import_initial_stock(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<ImportStockPayload>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;

    let mut tx = state.pool.begin().await?;

    let mut count = 0;
    for row in payload.rows {
        // Upsert inventory stock
        let min_s = row.min_stock.unwrap_or_else(|| Decimal::from(10));
        let max_s = row.max_stock.unwrap_or_else(|| Decimal::from(100));
        let safety_s = row.safety_stock.unwrap_or_else(|| Decimal::from(5));

        sqlx::query!(
            r#"
            INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock, safety_stock, rack_location, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (warehouse_id, spare_part_id)
            DO UPDATE SET
                qty_on_hand = EXCLUDED.qty_on_hand,
                min_stock = EXCLUDED.min_stock,
                max_stock = EXCLUDED.max_stock,
                safety_stock = EXCLUDED.safety_stock,
                rack_location = COALESCE(EXCLUDED.rack_location, inventory_stock.rack_location),
                updated_at = NOW()
            "#,
            payload.warehouse_id,
            row.spare_part_id,
            row.qty_on_hand,
            min_s,
            max_s,
            safety_s,
            row.rack_location
        )
        .execute(&mut *tx)
        .await?;

        // Record ledger
        sqlx::query!(
            r#"
            INSERT INTO stock_movements (warehouse_id, spare_part_id, movement_type, qty, balance_after, reference_number, notes, created_by)
            VALUES ($1, $2, 'INITIAL_IMPORT', $3, $3, 'IMPORT-MANUAL', 'Import saldo awal kontainer', $4)
            "#,
            payload.warehouse_id,
            row.spare_part_id,
            row.qty_on_hand,
            user.sub
        )
        .execute(&mut *tx)
        .await?;

        count += 1;
    }

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Berhasil mengimpor {} item saldo awal ke {}", count, payload.warehouse_id)
    })))
}

pub async fn get_dashboard_summary(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<InventoryQuery>,
) -> Result<Json<DashboardSummary>, AppError> {
    let warehouse_id = query.warehouse_id.unwrap_or_else(|| "WH-CONT-HE".to_string());
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let stock_stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*)::bigint as total_parts,
            COUNT(CASE WHEN qty_on_hand <= min_stock THEN 1 END)::bigint as critical_count,
            COUNT(CASE WHEN qty_on_hand > min_stock AND qty_on_hand <= (min_stock * 1.25) THEN 1 END)::bigint as warning_count
        FROM inventory_stock
        WHERE warehouse_id = $1
        "#,
        warehouse_id
    )
    .fetch_one(&state.pool)
    .await?;

    let today_issues = sqlx::query!(
        r#"
        SELECT
            COUNT(t.id)::bigint as tx_count,
            COALESCE(SUM(i.qty), 0) as total_qty
        FROM issue_transactions t
        LEFT JOIN issue_transaction_items i ON t.id = i.transaction_id
        WHERE t.warehouse_id = $1
          AND t.created_at >= CURRENT_DATE
          AND t.status = 'COMPLETED'
        "#,
        warehouse_id
    )
    .fetch_one(&state.pool)
    .await?;

    let pending_reqs = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::bigint
        FROM replenishment_requests
        WHERE container_warehouse_id = $1
          AND status IN ('REQUESTED', 'VERIFIED', 'RETURNED_TO_MAIN_ADMIN')
        "#,
        warehouse_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(0);

    Ok(Json(DashboardSummary {
        total_parts_monitored: stock_stats.total_parts.unwrap_or(0),
        total_critical_items: stock_stats.critical_count.unwrap_or(0),
        total_warning_items: stock_stats.warning_count.unwrap_or(0),
        today_issues_count: today_issues.tx_count.unwrap_or(0),
        today_items_released: today_issues.total_qty.unwrap_or(Decimal::ZERO),
        pending_requests_count: pending_reqs,
        active_warehouses_count: 4,
    }))
}
