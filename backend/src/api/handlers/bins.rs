use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_any_permission, check_warehouse_access, AuthUser},
    },
    domain::entities::{
        CreateBinRequest, RelocateStockBinRequest, UpdateBinRequest, WarehouseBinItem,
    },
    error::AppError,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::Value;
use uuid::Uuid;

pub async fn list_warehouse_bins(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(warehouse_id): Path<String>,
) -> Result<Json<Vec<WarehouseBinItem>>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_any_permission(
        &state.pool,
        &user,
        &["bins.view", "bins.manage", "inventory.view"],
    )
    .await?;

    let bins = state.services.bin.list_bins(&warehouse_id).await?;
    Ok(Json(bins))
}

pub async fn create_warehouse_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(warehouse_id): Path<String>,
    Json(payload): Json<CreateBinRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_any_permission(&state.pool, &user, &["bins.manage", "master.manage"]).await?;

    let res = state
        .services
        .bin
        .create_bin(user.sub, &user.username, &warehouse_id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn update_warehouse_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, bin_id)): Path<(String, Uuid)>,
    Json(payload): Json<UpdateBinRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_any_permission(&state.pool, &user, &["bins.manage", "master.manage"]).await?;

    let res = state
        .services
        .bin
        .update_bin(user.sub, &user.username, &warehouse_id, bin_id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn delete_warehouse_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, bin_id)): Path<(String, Uuid)>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_any_permission(&state.pool, &user, &["bins.manage", "master.manage"]).await?;

    let res = state
        .services
        .bin
        .delete_bin(user.sub, &user.username, &warehouse_id, bin_id)
        .await?;
    Ok(Json(res))
}

pub async fn relocate_stock_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(warehouse_id): Path<String>,
    Json(payload): Json<RelocateStockBinRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_any_permission(&state.pool, &user, &["bins.manage", "master.manage"]).await?;

    let res = state
        .services
        .bin
        .relocate_stock_bin(user.sub, &user.username, &warehouse_id, payload)
        .await?;
    Ok(Json(res))
}
