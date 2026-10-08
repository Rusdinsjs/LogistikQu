use crate::{
    api::middleware::AuthUser,
    config::AppConfig,
    domain::models::{LoginRequest, LoginResponse, UserProfile, WarehouseInfo},
    error::AppError,
    infrastructure::auth::{create_jwt_token, verify_password},
};
use axum::{extract::State, Json};
use serde_json::{json, Value};
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: AppConfig,
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
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let row = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.password_hash, u.full_name, u.role_id, u.is_active,
               r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.username = $1
        "#,
        payload.username
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Username atau password salah".to_string()))?;

    if !row.is_active {
        return Err(AppError::Forbidden("Akun pengguna sedang non-aktif".to_string()));
    }

    let is_valid = verify_password(&payload.password, &row.password_hash)?;
    if !is_valid {
        return Err(AppError::Unauthorized("Username atau password salah".to_string()));
    }

    let role_id = row.role_id.unwrap_or_else(|| "GUEST".to_string());
    let role_name = row.role_name;

    // Fetch assigned warehouses
    let warehouses = sqlx::query_as!(
        WarehouseInfo,
        r#"
        SELECT w.id, w.name, w.warehouse_type, w.category
        FROM warehouses w
        INNER JOIN user_warehouses uw ON w.id = uw.warehouse_id
        WHERE uw.user_id = $1
        ORDER BY w.name
        "#,
        row.id
    )
    .fetch_all(&state.pool)
    .await?;

    // Fetch permissions
    let permissions = sqlx::query_scalar!(
        r#"
        SELECT permission_id FROM role_permissions WHERE role_id = $1
        "#,
        role_id
    )
    .fetch_all(&state.pool)
    .await?;

    let token = create_jwt_token(
        row.id,
        &row.username,
        &role_id,
        &state.config.jwt_secret,
        state.config.jwt_access_expiry_mins,
    )?;

    // Log audit
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'LOGIN', 'USER', $3, $4)
        "#,
        row.id,
        row.username,
        row.id.to_string(),
        json!({"event": "user logged in"})
    )
    .execute(&state.pool)
    .await;

    let user_profile = UserProfile {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        role_id,
        role_name,
        warehouses,
        permissions,
    };

    Ok(Json(LoginResponse {
        token,
        user: user_profile,
    }))
}

pub async fn get_me(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<UserProfile>, AppError> {
    let row = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
        "#,
        user.sub
    )
    .fetch_one(&state.pool)
    .await?;

    let role_id = row.role_id.unwrap_or_else(|| "GUEST".to_string());
    let role_name = row.role_name;

    let warehouses = sqlx::query_as!(
        WarehouseInfo,
        r#"
        SELECT w.id, w.name, w.warehouse_type, w.category
        FROM warehouses w
        INNER JOIN user_warehouses uw ON w.id = uw.warehouse_id
        WHERE uw.user_id = $1
        ORDER BY w.name
        "#,
        row.id
    )
    .fetch_all(&state.pool)
    .await?;

    let permissions = sqlx::query_scalar!(
        r#"
        SELECT permission_id FROM role_permissions WHERE role_id = $1
        "#,
        role_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(UserProfile {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        role_id,
        role_name,
        warehouses,
        permissions,
    }))
}

pub async fn list_demo_users(
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let users = sqlx::query!(
        r#"
        SELECT u.username, u.full_name, u.role_id, r.name as role_name,
               ARRAY_AGG(w.name) as warehouse_names
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_warehouses uw ON u.id = uw.user_id
        LEFT JOIN warehouses w ON uw.warehouse_id = w.id
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
