use crate::{
    api::middleware::{check_permission, AuthUser},
    config::AppConfig,
    domain::entities::{
        CreateUserRequest, LoginRequest, LoginResponse, PermissionItem, RefreshTokenRequest,
        RefreshTokenSession, RoleItem, UpdateProfileRequest, UpdateRolePermissionsRequest,
        UpdateUserRequest, UserManagementItem, UserProfile,
    },
    error::AppError,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: AppConfig,
    pub services: Arc<crate::application::ServiceContainer>,
}

impl axum::extract::FromRef<AppState> for AppConfig {
    fn from_ref(state: &AppState) -> Self {
        state.config.clone()
    }
}

impl axum::extract::FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let resp = state.services.auth.login(payload, ip, ua).await?;
    Ok(Json(resp))
}

pub async fn refresh_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RefreshTokenRequest>,
) -> Result<Json<Value>, AppError> {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let resp = state
        .services
        .auth
        .refresh(&payload.refresh_token, ip, ua)
        .await?;
    Ok(Json(resp))
}

pub async fn logout(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    headers: HeaderMap,
    payload: Option<Json<RefreshTokenRequest>>,
) -> Result<Json<Value>, AppError> {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let refresh_str = payload.as_ref().map(|p| p.refresh_token.as_str());

    state
        .services
        .auth
        .logout(&user, refresh_str, ip, ua)
        .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Sesi berhasil diakhiri (logout)"
    })))
}

pub async fn list_sessions(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<RefreshTokenSession>>, AppError> {
    let sessions = state.services.auth.list_sessions(&user).await?;
    Ok(Json(sessions))
}

pub async fn revoke_session(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    state
        .services
        .auth
        .revoke_session(&user, session_id)
        .await?;
    Ok(Json(json!({
        "success": true,
        "message": "Sesi berhasil dicabut"
    })))
}

pub async fn get_me(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<UserProfile>, AppError> {
    let profile = state.services.auth.get_me(&user).await?;
    Ok(Json(profile))
}

pub async fn update_my_profile(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserProfile>, AppError> {
    let profile = state
        .services
        .auth
        .update_my_profile(&user, payload)
        .await?;
    Ok(Json(profile))
}

pub async fn list_demo_users(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let users = sqlx::query!(
        r#"
        SELECT u.username, u.full_name, u.role_id, r.name as role_name,
               ARRAY_AGG(w.name) as warehouse_names
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_warehouses uw ON u.id = uw.user_id
        LEFT JOIN warehouses w ON uw.warehouse_id = w.id
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.username, u.full_name, u.role_id, r.name
        ORDER BY u.username
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let list: Vec<Value> = users
        .into_iter()
        .map(|u| {
            json!({
                "username": u.username,
                "full_name": u.full_name,
                "role_id": u.role_id,
                "role_name": u.role_name,
                "warehouses": u.warehouse_names.unwrap_or_default(),
            })
        })
        .collect();

    Ok(Json(json!({ "demo_users": list })))
}

pub async fn list_roles(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<RoleItem>>, AppError> {
    let roles = state.services.user.list_roles().await?;
    Ok(Json(roles))
}

pub async fn list_permissions(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<PermissionItem>>, AppError> {
    let permissions = state.services.user.list_permissions().await?;
    Ok(Json(permissions))
}

pub async fn update_role_permissions(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(role_id): Path<String>,
    Json(payload): Json<UpdateRolePermissionsRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;
    state
        .services
        .user
        .update_role_permissions(&user, &role_id, payload)
        .await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Hak akses untuk peran '{}' berhasil diperbarui", role_id)
    })))
}

pub async fn list_users(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<UserManagementItem>>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;
    let users = state.services.user.list_users().await?;
    Ok(Json(users))
}

pub async fn create_user(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;
    let username = payload.username.clone();
    let new_user_id = state.services.user.create_user(&user, payload).await?;

    Ok(Json(json!({
        "success": true,
        "user_id": new_user_id,
        "message": format!("Pengguna '{}' berhasil dibuat", username)
    })))
}

pub async fn update_user(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;
    state.services.user.update_user(&user, id, payload).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Data pengguna berhasil diperbarui"
    })))
}

pub async fn delete_user(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;
    state.services.user.delete_user(&user, id).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Pengguna berhasil dinonaktifkan (soft delete)"
    })))
}
