use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_permission, check_warehouse_access, get_default_user_warehouse, AuthUser,
        },
    },
    application::services::inventory_service::ImportStockPayload,
    domain::entities::{
        DashboardSummary, InventoryStockItem, LedgerQuery, PaginatedResponse, StockMovement,
        StockTransferRequest, StockWriteOffRequest, UpdateStockPhotoRequest,
    },
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct InventoryQuery {
    pub warehouse_id: Option<String>,
    pub search: Option<String>,
    pub status: Option<String>,
}

pub async fn list_inventory_stock(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<InventoryQuery>,
) -> Result<Json<Vec<InventoryStockItem>>, AppError> {
    let warehouse_id = match query.warehouse_id.filter(|s| !s.trim().is_empty()) {
        Some(wh) => wh,
        None => get_default_user_warehouse(&state.pool, &user).await?,
    };
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "inventory.view").await?;

    let search = query.search.unwrap_or_default();
    let items = state
        .services
        .inventory
        .list_stock(&warehouse_id, &search)
        .await?;
    Ok(Json(items))
}

pub async fn get_stock_movements(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, spare_part_id)): Path<(String, String)>,
) -> Result<Json<Vec<StockMovement>>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "inventory.view").await?;

    let movements = state
        .services
        .inventory
        .get_stock_movements(&warehouse_id, &spare_part_id)
        .await?;
    Ok(Json(movements))
}

pub async fn query_ledger(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<LedgerQuery>,
) -> Result<Json<PaginatedResponse<StockMovement>>, AppError> {
    if let Some(ref wh) = query.warehouse_id {
        check_warehouse_access(&state.pool, &user, wh).await?;
    }
    check_permission(&state.pool, &user, "inventory.view").await?;
    let res = state.services.inventory.query_ledger(query).await?;
    Ok(Json(res))
}

pub async fn transfer_stock(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<StockTransferRequest>,
) -> Result<Json<Value>, AppError> {
    let res = state
        .services
        .inventory
        .transfer_stock(&user, payload)
        .await?;
    Ok(Json(res))
}

pub async fn write_off_stock(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<StockWriteOffRequest>,
) -> Result<Json<Value>, AppError> {
    let res = state
        .services
        .inventory
        .write_off_stock(&user, payload)
        .await?;
    Ok(Json(res))
}

pub async fn import_initial_stock(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<ImportStockPayload>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;
    check_permission(&state.pool, &user, "stock.import").await?;

    let count = state
        .services
        .inventory
        .import_initial_stock(user.sub, &user.username, payload)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Berhasil mengimpor {} item saldo awal", count)
    })))
}

pub async fn get_dashboard_summary(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<InventoryQuery>,
) -> Result<Json<DashboardSummary>, AppError> {
    let warehouse_id = match query.warehouse_id.filter(|s| !s.trim().is_empty()) {
        Some(wh) => wh,
        None => get_default_user_warehouse(&state.pool, &user).await?,
    };
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let summary = state
        .services
        .inventory
        .get_dashboard_summary(&warehouse_id)
        .await?;
    Ok(Json(summary))
}

pub async fn get_stock_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, spare_part_id)): Path<(String, String)>,
) -> Result<Json<InventoryStockItem>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "inventory.view").await?;

    let item = state
        .services
        .inventory
        .get_stock_item(&warehouse_id, &spare_part_id)
        .await?;
    Ok(Json(item))
}

pub async fn update_stock_photo(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, spare_part_id)): Path<(String, String)>,
    Json(payload): Json<UpdateStockPhotoRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "inventory.view").await?;

    state
        .services
        .inventory
        .update_stock_photo(&warehouse_id, &spare_part_id, payload.photo_url.clone())
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Foto stok berhasil diperbarui",
        "photo_url": payload.photo_url
    })))
}
