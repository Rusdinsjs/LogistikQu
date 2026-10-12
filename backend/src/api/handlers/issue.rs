use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_any_permission, check_permission, check_warehouse_access,
            get_default_user_warehouse, get_user_fleet_category, is_unit_in_category, AuthUser,
        },
    },
    domain::entities::{CreateIssueRequest, IssueTransaction, RecordReceiptPrintedRequest},
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
pub struct IssueFilterQuery {
    pub warehouse_id: Option<String>,
    pub search: Option<String>,
    pub status: Option<String>,
    pub force: Option<bool>,
}

pub async fn create_issue(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<IssueFilterQuery>,
    Json(payload): Json<CreateIssueRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;
    check_permission(&state.pool, &user, "issue.create").await?;

    let force = query.force.unwrap_or(false);
    let result = state
        .services
        .issue
        .create_issue(&user, payload, force)
        .await?;

    Ok(Json(result.response_value))
}

pub async fn list_issues(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<IssueFilterQuery>,
) -> Result<Json<Vec<IssueTransaction>>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["issue.view", "issue.create", "issue.approve"],
    )
    .await?;
    let warehouse_id = match query.warehouse_id.filter(|s| !s.trim().is_empty()) {
        Some(wh) => wh,
        None => get_default_user_warehouse(&state.pool, &user).await?,
    };
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let search = query.search.unwrap_or_default();
    let status = query.status.unwrap_or_default();
    let fleet_cat = get_user_fleet_category(&state.pool, &user).await?;

    let items = state
        .services
        .issue
        .list_issues(&warehouse_id, &search, &status)
        .await?;
    let filtered = items
        .into_iter()
        .filter(|it| {
            is_unit_in_category(
                &it.unit_number,
                Some(&it.unit_type),
                Some(&it.unit_name),
                fleet_cat.as_deref(),
            )
        })
        .collect();
    Ok(Json(filtered))
}

pub async fn get_issue_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["issue.view", "issue.create", "issue.approve"],
    )
    .await?;
    let detail = state.services.issue.get_issue_detail(id).await?;
    // check warehouse access from transaction object
    if let Some(wh) = detail
        .get("transaction")
        .and_then(|t| t.get("warehouse_id"))
        .and_then(|w| w.as_str())
    {
        check_warehouse_access(&state.pool, &user, wh).await?;
    }

    Ok(Json(detail))
}

pub async fn approve_critical_issue(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "issue.approve").await?;
    let resp = state
        .services
        .issue
        .approve_critical_issue(&user, id)
        .await?;
    Ok(Json(resp))
}

pub async fn record_receipt_printed(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    payload: Option<Json<RecordReceiptPrintedRequest>>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["issue.create", "issue.view", "issue.approve"],
    )
    .await?;

    let signed_photo = payload.and_then(|p| p.0.signed_receipt_photo_url);
    let resp = state
        .services
        .issue
        .record_receipt_printed(&user, id, signed_photo)
        .await?;

    Ok(Json(resp))
}
