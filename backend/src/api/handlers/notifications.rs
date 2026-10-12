use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    domain::entities::{CreateNotificationRequest, Notification, NotificationQuery},
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn list_notifications(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<NotificationQuery>,
) -> Result<Json<Vec<Notification>>, AppError> {
    let rows = state
        .services
        .notification
        .list_notifications(user.sub, &user.role_id, query)
        .await?;
    Ok(Json(rows))
}

pub async fn create_notification(
    State(state): State<AppState>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<CreateNotificationRequest>,
) -> Result<Json<Notification>, AppError> {
    let res = state
        .services
        .notification
        .create_notification(payload)
        .await?;
    Ok(Json(res))
}

pub async fn mark_as_read(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let ok = state
        .services
        .notification
        .mark_as_read(id, user.sub)
        .await?;
    Ok(Json(json!({ "success": ok })))
}

pub async fn mark_all_read(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Value>, AppError> {
    let count = state
        .services
        .notification
        .mark_all_read(user.sub, &user.role_id)
        .await?;
    Ok(Json(json!({ "success": true, "marked_count": count })))
}

pub async fn get_unread_count(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Value>, AppError> {
    let count = state
        .services
        .notification
        .get_unread_count(user.sub, &user.role_id)
        .await?;
    Ok(Json(json!({ "unread_count": count })))
}
