use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_any_permission, check_warehouse_access, AuthUser},
    },
    domain::entities::{
        CompleteReturnRequest, ReceiveContainerReturnRequest, TransferMainReturnRequest,
        UsedPartReturn,
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
pub struct ReturnFilterQuery {
    pub warehouse_id: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

pub async fn list_returns(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReturnFilterQuery>,
) -> Result<Json<Vec<UsedPartReturn>>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "returns.view",
            "returns.receive",
            "returns.transfer",
            "returns.complete",
        ],
    )
    .await?;

    if let Some(ref wh) = query.warehouse_id {
        check_warehouse_access(&state.pool, &user, wh).await?;
    }

    let wh_filter = query.warehouse_id.unwrap_or_default();
    let status_filter = query.status.unwrap_or_default();
    let search = query.search.unwrap_or_default();

    let items = state
        .services
        .returns
        .list_returns(&wh_filter, &status_filter, &search)
        .await?;
    Ok(Json(items))
}

pub async fn get_return_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UsedPartReturn>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "returns.view",
            "returns.receive",
            "returns.transfer",
            "returns.complete",
        ],
    )
    .await?;
    let item = state.services.returns.get_return_detail(id).await?;
    check_warehouse_access(&state.pool, &user, &item.warehouse_id).await?;
    Ok(Json(item))
}

pub async fn receive_at_container(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReceiveContainerReturnRequest>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(&state.pool, &user, &["returns.receive", "issue.create"]).await?;
    let res = state
        .services
        .returns
        .receive_at_container(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn transfer_to_main(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<TransferMainReturnRequest>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["returns.transfer", "request.verify", "sto.ship"],
    )
    .await?;
    let res = state
        .services
        .returns
        .transfer_to_main(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn complete_return(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<CompleteReturnRequest>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["returns.complete", "issue.approve", "request.approve"],
    )
    .await?;
    let res = state
        .services
        .returns
        .complete_return(&user, id, payload)
        .await?;
    Ok(Json(res))
}
