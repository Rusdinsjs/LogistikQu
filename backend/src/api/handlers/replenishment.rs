use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_any_permission, check_permission, check_warehouse_access,
            get_default_user_warehouse, get_user_warehouse_ids, AuthUser,
        },
    },
    domain::entities::{
        ApproveReplenishmentRequest, CreateReplenishmentRequest, RecommendationItem,
        RejectReplenishmentRequest, ReplenishmentIntelligenceItem, ReplenishmentRequest,
        VerifyReplenishmentRequest,
    },
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReplenishmentFilterQuery {
    pub warehouse_id: Option<String>,
    pub status: Option<String>,
}

pub async fn get_recommendations(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReplenishmentFilterQuery>,
) -> Result<Json<Vec<RecommendationItem>>, AppError> {
    let warehouse_id = match query.warehouse_id.filter(|s| !s.trim().is_empty()) {
        Some(wh) => wh,
        None => get_default_user_warehouse(&state.pool, &user).await?,
    };
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let recs = state
        .services
        .replenishment
        .get_recommendations(&warehouse_id)
        .await?;
    Ok(Json(recs))
}

pub async fn get_replenishment_intelligence(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReplenishmentFilterQuery>,
) -> Result<Json<Vec<ReplenishmentIntelligenceItem>>, AppError> {
    let warehouse_id = match query.warehouse_id.filter(|s| !s.trim().is_empty()) {
        Some(wh) => wh,
        None => get_default_user_warehouse(&state.pool, &user).await?,
    };
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let intel = state
        .services
        .replenishment
        .get_replenishment_intelligence(&warehouse_id)
        .await?;
    Ok(Json(intel))
}

pub async fn create_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.container_warehouse_id).await?;
    check_permission(&state.pool, &user, "request.create").await?;

    let res = state
        .services
        .replenishment
        .create_request(&user, payload)
        .await?;
    Ok(Json(res))
}

pub async fn list_requests(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReplenishmentFilterQuery>,
) -> Result<Json<Vec<ReplenishmentRequest>>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "request.view",
            "request.create",
            "request.verify",
            "request.approve",
            "sto.receive",
        ],
    )
    .await?;
    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    let wh_filter = query.warehouse_id.unwrap_or_default();
    if !wh_filter.is_empty() {
        check_warehouse_access(&state.pool, &user, &wh_filter).await?;
    }
    let status_filter = query.status.unwrap_or_default();

    let items = state
        .services
        .replenishment
        .list_requests(&wh_filter, &status_filter, &user_whs)
        .await?;
    Ok(Json(items))
}

pub async fn get_request_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "request.view",
            "request.create",
            "request.verify",
            "request.approve",
            "sto.receive",
        ],
    )
    .await?;
    let detail = state.services.replenishment.get_request_detail(id).await?;

    if let Some(req_obj) = detail.get("request") {
        let container_wh = req_obj
            .get("container_warehouse_id")
            .and_then(|w| w.as_str())
            .unwrap_or_default();
        let main_wh = req_obj
            .get("main_warehouse_id")
            .and_then(|w| w.as_str())
            .unwrap_or_default();
        let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
        if !user_whs.contains(&container_wh.to_string()) && !user_whs.contains(&main_wh.to_string())
        {
            return Err(AppError::Forbidden(
                "Akses permohonan gudang ditolak".to_string(),
            ));
        }
    }

    Ok(Json(detail))
}

pub async fn verify_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<VerifyReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.verify").await?;
    let res = state
        .services
        .replenishment
        .verify_request(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn approve_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ApproveReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.approve").await?;
    let res = state
        .services
        .replenishment
        .approve_request(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn supervisor_reject(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.approve").await?;
    let res = state
        .services
        .replenishment
        .supervisor_reject(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn return_to_container(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.verify").await?;
    let res = state
        .services
        .replenishment
        .return_to_container(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn receive_drop(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "sto.receive").await?;
    let res = state.services.replenishment.receive_drop(&user, id).await?;
    Ok(Json(res))
}
