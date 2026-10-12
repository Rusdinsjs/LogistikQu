use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    application::services::sync_service::{
        ConflictResolutionRequest, MobileBatchSyncRequest, MobileBatchSyncResponse,
        MobileDeltaPullResponse,
    },
    error::AppError,
};
use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct MobilePullQuery {
    pub warehouse_id: Option<String>,
    pub last_sync: Option<i64>,
}

/// Batch mobile sync endpoint
pub async fn mobile_batch_sync_handler(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<MobileBatchSyncRequest>,
) -> Result<Json<MobileBatchSyncResponse>, AppError> {
    let res = state
        .services
        .sync
        .process_mobile_batch_sync(payload, user.sub)
        .await?;
    Ok(Json(res))
}

/// Mobile delta pull endpoint
pub async fn mobile_delta_pull_handler(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<MobilePullQuery>,
) -> Result<Json<MobileDeltaPullResponse>, AppError> {
    let warehouse_id = query.warehouse_id.unwrap_or_else(|| "WH-CONT-HE".into());
    let res = state
        .services
        .sync
        .pull_delta(&warehouse_id, query.last_sync)
        .await?;
    Ok(Json(res))
}

/// Conflict resolution endpoint
pub async fn mobile_conflict_resolution_handler(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<ConflictResolutionRequest>,
) -> Result<Json<Value>, AppError> {
    let res = state
        .services
        .sync
        .resolve_conflict(payload, user.sub)
        .await?;
    Ok(Json(res))
}
