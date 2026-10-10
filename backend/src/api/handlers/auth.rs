use crate::{
    api::middleware::{check_permission, AuthUser},
    config::AppConfig,
    domain::models::{
        CreateUserRequest, LoginRequest, LoginResponse, RoleItem, UpdateProfileRequest,
        UpdateUserRequest, UserManagementItem, UserProfile, WarehouseInfo,
    },
    error::AppError,
    infrastructure::auth::{create_jwt_token, hash_password, verify_password},
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

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
               u.avatar_url, u.email, u.phone,
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
        SELECT
            w.id,
            w.name,
            w.warehouse_type,
            w.category,
            w.description,
            w.is_active,
            w.parent_warehouse_id,
            ARRAY(SELECT l.main_warehouse_id FROM warehouse_supply_links l WHERE l.sub_warehouse_id = w.id ORDER BY l.main_warehouse_id)::text[] AS "parent_warehouse_ids?",
            ARRAY(SELECT l.sub_warehouse_id FROM warehouse_supply_links l WHERE l.main_warehouse_id = w.id ORDER BY l.sub_warehouse_id)::text[] AS "supplied_sub_warehouse_ids?"
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
        avatar_url: row.avatar_url,
        email: row.email,
        phone: row.phone,
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
        SELECT u.id, u.username, u.full_name, u.role_id,
               u.avatar_url, u.email, u.phone,
               r.name as role_name
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
        SELECT
            w.id,
            w.name,
            w.warehouse_type,
            w.category,
            w.description,
            w.is_active,
            w.parent_warehouse_id,
            ARRAY(SELECT l.main_warehouse_id FROM warehouse_supply_links l WHERE l.sub_warehouse_id = w.id ORDER BY l.main_warehouse_id)::text[] AS "parent_warehouse_ids?",
            ARRAY(SELECT l.sub_warehouse_id FROM warehouse_supply_links l WHERE l.main_warehouse_id = w.id ORDER BY l.sub_warehouse_id)::text[] AS "supplied_sub_warehouse_ids?"
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
        avatar_url: row.avatar_url,
        email: row.email,
        phone: row.phone,
    }))
}

pub async fn update_my_profile(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserProfile>, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT id, username, password_hash, full_name, avatar_url, email, phone, role_id
        FROM users
        WHERE id = $1
        "#,
        user.sub
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Pengguna tidak ditemukan".to_string()))?;

    // Validate and prepare username
    let updated_username = if let Some(ref u) = payload.username {
        let trimmed = u.trim();
        if trimmed.is_empty() {
            existing.username.clone()
        } else if trimmed.len() < 3 {
            return Err(AppError::BadRequest("Username minimal 3 karakter".to_string()));
        } else if trimmed != existing.username {
            let exists = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 AND id != $2)",
                trimmed,
                existing.id
            )
            .fetch_one(&state.pool)
            .await?
            .unwrap_or(false);

            if exists {
                return Err(AppError::BadRequest(format!("Username '{}' sudah digunakan", trimmed)));
            }
            trimmed.to_string()
        } else {
            existing.username.clone()
        }
    } else {
        existing.username.clone()
    };

    // Validate and prepare full_name
    let updated_full_name = if let Some(ref f) = payload.full_name {
        let trimmed = f.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("Nama lengkap tidak boleh kosong".to_string()));
        }
        trimmed.to_string()
    } else {
        existing.full_name.clone()
    };

    // Prepare avatar_url, email, phone
    let updated_avatar = payload.avatar_url.or(existing.avatar_url);
    let updated_email = payload.email.or(existing.email);
    let updated_phone = payload.phone.or(existing.phone);

    // Validate password change if requested
    let updated_password_hash = if let Some(ref new_pw) = payload.new_password {
        let trimmed_new = new_pw.trim();
        if !trimmed_new.is_empty() {
            let current_pw = payload.current_password.as_deref().unwrap_or("").trim();
            if current_pw.is_empty() {
                return Err(AppError::BadRequest("Password saat ini wajib diisi untuk mengubah password".to_string()));
            }

            let is_valid = verify_password(current_pw, &existing.password_hash)?;
            if !is_valid {
                return Err(AppError::BadRequest("Password saat ini tidak cocok".to_string()));
            }

            if trimmed_new.len() < 6 {
                return Err(AppError::BadRequest("Password baru minimal 6 karakter".to_string()));
            }

            Some(hash_password(trimmed_new)?)
        } else {
            None
        }
    } else {
        None
    };

    // Execute update
    sqlx::query!(
        r#"
        UPDATE users
        SET username = $1,
            full_name = $2,
            avatar_url = $3,
            email = $4,
            phone = $5,
            password_hash = COALESCE($6, password_hash),
            updated_at = NOW()
        WHERE id = $7
        "#,
        updated_username,
        updated_full_name,
        updated_avatar,
        updated_email,
        updated_phone,
        updated_password_hash,
        existing.id
    )
    .execute(&state.pool)
    .await?;

    // Record audit log
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'UPDATE_PROFILE', 'USER', $3, $4)
        "#,
        existing.id,
        updated_username,
        existing.id.to_string(),
        json!({
            "username": updated_username,
            "full_name": updated_full_name,
            "email": updated_email,
            "phone": updated_phone,
            "password_updated": updated_password_hash.is_some()
        })
    )
    .execute(&state.pool)
    .await;

    // Fetch refreshed UserProfile
    let role_id = existing.role_id.unwrap_or_else(|| "GUEST".to_string());
    let role_name = sqlx::query_scalar!(
        "SELECT name FROM roles WHERE id = $1",
        role_id
    )
    .fetch_optional(&state.pool)
    .await?
    .unwrap_or_else(|| "GUEST".to_string());

    let warehouses = sqlx::query_as!(
        WarehouseInfo,
        r#"
        SELECT
            w.id,
            w.name,
            w.warehouse_type,
            w.category,
            w.description,
            w.is_active,
            w.parent_warehouse_id,
            ARRAY(SELECT l.main_warehouse_id FROM warehouse_supply_links l WHERE l.sub_warehouse_id = w.id ORDER BY l.main_warehouse_id)::text[] AS "parent_warehouse_ids?",
            ARRAY(SELECT l.sub_warehouse_id FROM warehouse_supply_links l WHERE l.main_warehouse_id = w.id ORDER BY l.sub_warehouse_id)::text[] AS "supplied_sub_warehouse_ids?"
        FROM warehouses w
        INNER JOIN user_warehouses uw ON w.id = uw.warehouse_id
        WHERE uw.user_id = $1
        ORDER BY w.name
        "#,
        existing.id
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
        id: existing.id,
        username: updated_username,
        full_name: updated_full_name,
        role_id,
        role_name,
        warehouses,
        permissions,
        avatar_url: updated_avatar,
        email: updated_email,
        phone: updated_phone,
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

pub async fn list_roles(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<RoleItem>>, AppError> {
    let roles = sqlx::query_as!(
        RoleItem,
        r#"
        SELECT id, name, description
        FROM roles
        ORDER BY name
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(roles))
}

pub async fn list_users(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<UserManagementItem>>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;

    let rows = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, u.created_at,
               COALESCE(r.name, 'GUEST') as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.created_at DESC
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let mut results = Vec::new();

    for r in rows {
        let whs = sqlx::query_as!(
            WarehouseInfo,
            r#"
            SELECT
                w.id,
                w.name,
                w.warehouse_type,
                w.category,
                w.description,
                w.is_active,
                w.parent_warehouse_id,
                ARRAY(SELECT l.main_warehouse_id FROM warehouse_supply_links l WHERE l.sub_warehouse_id = w.id ORDER BY l.main_warehouse_id)::text[] AS "parent_warehouse_ids?",
                ARRAY(SELECT l.sub_warehouse_id FROM warehouse_supply_links l WHERE l.main_warehouse_id = w.id ORDER BY l.sub_warehouse_id)::text[] AS "supplied_sub_warehouse_ids?"
            FROM warehouses w
            INNER JOIN user_warehouses uw ON w.id = uw.warehouse_id
            WHERE uw.user_id = $1
            ORDER BY w.name
            "#,
            r.id
        )
        .fetch_all(&state.pool)
        .await?;

        results.push(UserManagementItem {
            id: r.id,
            username: r.username,
            full_name: r.full_name,
            role_id: r.role_id.unwrap_or_default(),
            role_name: r.role_name.unwrap_or_else(|| "GUEST".to_string()),
            is_active: r.is_active,
            warehouses: whs,
            created_at: r.created_at,
        });
    }

    Ok(Json(results))
}

pub async fn create_user(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "users.manage").await?;

    let username = payload.username.trim();
    if username.len() < 3 {
        return Err(AppError::BadRequest("Username minimal 3 karakter".to_string()));
    }

    let password = payload.password.trim();
    if password.len() < 6 {
        return Err(AppError::BadRequest("Password minimal 6 karakter".to_string()));
    }

    let full_name = payload.full_name.trim();
    if full_name.is_empty() {
        return Err(AppError::BadRequest("Nama lengkap wajib diisi".to_string()));
    }

    // Check if username already exists
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
        username
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(false);

    if exists {
        return Err(AppError::BadRequest(format!("Username '{}' sudah digunakan", username)));
    }

    // Check role exists
    let role_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1)",
        payload.role_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(false);

    if !role_exists {
        return Err(AppError::BadRequest(format!("Role '{}' tidak valid", payload.role_id)));
    }

    let hashed_pw = hash_password(password)?;

    let mut tx = state.pool.begin().await?;

    let new_user_id = sqlx::query_scalar!(
        r#"
        INSERT INTO users (username, password_hash, full_name, role_id, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
        RETURNING id
        "#,
        username,
        hashed_pw,
        full_name,
        payload.role_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Assign warehouses
    for wh_id in &payload.warehouse_ids {
        sqlx::query!(
            r#"
            INSERT INTO user_warehouses (user_id, warehouse_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            "#,
            new_user_id,
            wh_id
        )
        .execute(&mut *tx)
        .await?;
    }

    // Audit log
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'CREATE_USER', 'USER', $3, $4)
        "#,
        user.sub,
        user.username,
        new_user_id.to_string(),
        json!({
            "created_username": username,
            "full_name": full_name,
            "role_id": payload.role_id,
            "warehouse_ids": payload.warehouse_ids
        })
    )
    .execute(&mut *tx)
    .await;

    tx.commit().await?;

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

    let mut tx = state.pool.begin().await?;

    let existing = sqlx::query!(
        "SELECT id, username FROM users WHERE id = $1 FOR UPDATE",
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Pengguna tidak ditemukan".to_string()))?;

    if let Some(ref fn_val) = payload.full_name {
        let trimmed = fn_val.trim();
        if !trimmed.is_empty() {
            sqlx::query!(
                "UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2",
                trimmed,
                id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(ref r_id) = payload.role_id {
        sqlx::query!(
            "UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2",
            r_id,
            id
        )
        .execute(&mut *tx)
        .await?;
    }

    if let Some(active) = payload.is_active {
        sqlx::query!(
            "UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2",
            active,
            id
        )
        .execute(&mut *tx)
        .await?;
    }

    if let Some(ref pw) = payload.password {
        let trimmed_pw = pw.trim();
        if trimmed_pw.len() >= 6 {
            let hashed = hash_password(trimmed_pw)?;
            sqlx::query!(
                "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
                hashed,
                id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(ref wh_ids) = payload.warehouse_ids {
        sqlx::query!("DELETE FROM user_warehouses WHERE user_id = $1", id)
            .execute(&mut *tx)
            .await?;

        for wh_id in wh_ids {
            sqlx::query!(
                "INSERT INTO user_warehouses (user_id, warehouse_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                id,
                wh_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    // Audit log
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'UPDATE_USER', 'USER', $3, $4)
        "#,
        user.sub,
        user.username,
        id.to_string(),
        json!({
            "target_username": existing.username,
            "updated_role": payload.role_id,
            "is_active": payload.is_active,
            "warehouses": payload.warehouse_ids
        })
    )
    .execute(&mut *tx)
    .await;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Data pengguna '{}' berhasil diperbarui", existing.username)
    })))
}
