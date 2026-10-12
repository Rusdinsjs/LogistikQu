use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_any_permission, check_permission, check_warehouse_access, get_user_warehouse_ids,
            AuthUser,
        },
    },
    domain::entities::{
        ApproveMechanicRequestPayload, CancelMechanicRequestPayload, CreateMechanicRequestPayload,
        FulfillMechanicRequestPayload, MechanicRequest, MechanicRequestFilterQuery,
        MechanicRequestSummary, RejectMechanicRequestPayload, RequestRevisionPayload,
        UpdateMechanicRequestPayload,
    },
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde_json::Value;
use uuid::Uuid;

pub async fn get_mechanic_context(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["mechanic_request.view", "mechanic_request.create"],
    )
    .await?;

    let context = state
        .services
        .mechanic_request
        .get_mechanic_context(&user)
        .await?;
    Ok(Json(context))
}

pub async fn list_mechanic_requests(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<MechanicRequestFilterQuery>,
) -> Result<Json<Vec<MechanicRequest>>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "mechanic_request.view",
            "mechanic_request.create",
            "mechanic_request.approve",
            "mechanic_request.fulfill",
        ],
    )
    .await?;

    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    let items = state
        .services
        .mechanic_request
        .list_requests(&user, query, &user_whs)
        .await?;
    Ok(Json(items))
}

pub async fn get_mechanic_request_summary(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<MechanicRequestFilterQuery>,
) -> Result<Json<MechanicRequestSummary>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "mechanic_request.view",
            "mechanic_request.create",
            "mechanic_request.approve",
            "mechanic_request.fulfill",
        ],
    )
    .await?;

    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    let summary = state
        .services
        .mechanic_request
        .get_summary(&user, query.warehouse_id.as_deref(), &user_whs)
        .await?;
    Ok(Json(summary))
}

pub async fn get_mechanic_request_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Query(query): Query<MechanicRequestFilterQuery>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "mechanic_request.view",
            "mechanic_request.create",
            "mechanic_request.approve",
            "mechanic_request.fulfill",
        ],
    )
    .await?;

    let detail = state
        .services
        .mechanic_request
        .get_request_detail(id, query.warehouse_id.as_deref())
        .await?;

    if let Some(wh) = detail
        .get("request")
        .and_then(|r| r.get("warehouse_id"))
        .and_then(|w| w.as_str())
    {
        check_warehouse_access(&state.pool, &user, wh).await?;
    }

    Ok(Json(detail))
}

pub async fn create_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<MechanicRequestFilterQuery>,
    Json(payload): Json<CreateMechanicRequestPayload>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;
    check_permission(&state.pool, &user, "mechanic_request.create").await?;

    let force = query.force.unwrap_or(false);
    let result = state
        .services
        .mechanic_request
        .create_request(&user, payload, force)
        .await?;

    Ok(Json(result))
}

pub async fn update_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMechanicRequestPayload>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "mechanic_request.create").await?;

    let result = state
        .services
        .mechanic_request
        .update_request(&user, id, payload)
        .await?;

    Ok(Json(result))
}

pub async fn approve_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ApproveMechanicRequestPayload>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "mechanic_request.approve").await?;

    let result = state
        .services
        .mechanic_request
        .approve_request(&user, id, payload)
        .await?;

    Ok(Json(result))
}

pub async fn request_revision_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RequestRevisionPayload>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "mechanic_request.approve").await?;

    let result = state
        .services
        .mechanic_request
        .request_revision(&user, id, payload)
        .await?;

    Ok(Json(result))
}

pub async fn reject_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectMechanicRequestPayload>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "mechanic_request.approve").await?;

    let result = state
        .services
        .mechanic_request
        .reject_request(&user, id, payload)
        .await?;

    Ok(Json(result))
}

pub async fn cancel_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<CancelMechanicRequestPayload>,
) -> Result<Json<Value>, AppError> {
    let result = state
        .services
        .mechanic_request
        .cancel_request(&user, id, payload)
        .await?;

    Ok(Json(result))
}

pub async fn fulfill_mechanic_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<FulfillMechanicRequestPayload>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "mechanic_request.fulfill").await?;

    let result = state
        .services
        .mechanic_request
        .fulfill_request(&user, id, payload)
        .await?;

    Ok(Json(result))
}
