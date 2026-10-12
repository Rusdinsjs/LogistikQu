use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, check_warehouse_access, get_user_warehouse_ids, AuthUser},
    },
    domain::entities::CreateAdjustmentRequest,
    error::AppError,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::Value;
use uuid::Uuid;

pub async fn create_adjustment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateAdjustmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;
    check_permission(&state.pool, &user, "adjustment.create").await?;

    let res = state
        .services
        .adjustment
        .create_adjustment(&user, payload)
        .await?;
    Ok(Json(res))
}

pub async fn list_adjustments(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<Value>>, AppError> {
    check_permission(&state.pool, &user, "adjustment.view").await?;
    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;

    let list = state
        .services
        .adjustment
        .list_adjustments("", &user_whs)
        .await?;
    Ok(Json(list))
}

pub async fn get_adjustment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "adjustment.view").await?;
    let res = state.services.adjustment.get_adjustment(id).await?;
    Ok(Json(res))
}

pub async fn approve_adjustment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "adjustment.approve").await?;
    let res = state
        .services
        .adjustment
        .approve_adjustment(&user, id)
        .await?;
    Ok(Json(res))
}

#[derive(serde::Deserialize)]
pub struct RejectAdjustmentPayload {
    pub reason: Option<String>,
}

pub async fn reject_adjustment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectAdjustmentPayload>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "adjustment.approve").await?;
    let reason = payload
        .reason
        .unwrap_or_else(|| "Ditolak oleh Supervisor".to_string());
    let res = state
        .services
        .adjustment
        .reject_adjustment(&user, id, &reason)
        .await?;
    Ok(Json(res))
}
