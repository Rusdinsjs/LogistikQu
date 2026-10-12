use crate::{
    domain::entities::{
        Claims, CreateUserRequest, PermissionItem, RoleItem, UpdateRolePermissionsRequest,
        UpdateUserRequest, UserManagementItem,
    },
    error::AppError,
    infrastructure::{
        authentication::hash_password,
        repositories::{AuditRepository, UserRepository},
    },
};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct UserService {
    pool: PgPool,
    user_repo: UserRepository,
    audit_repo: AuditRepository,
}

impl UserService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            user_repo: UserRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn list_users(&self) -> Result<Vec<UserManagementItem>, AppError> {
        self.user_repo.list_users().await
    }

    pub async fn create_user(
        &self,
        claims: &Claims,
        payload: CreateUserRequest,
    ) -> Result<Uuid, AppError> {
        crate::application::validators::UserValidator::validate_create(&payload)?;

        let existing = self
            .user_repo
            .get_user_by_username(&payload.username)
            .await?;
        if existing.is_some() {
            return Err(AppError::BadRequest(format!(
                "Username '{}' sudah digunakan",
                payload.username
            )));
        }

        let pwd_hash = hash_password(&payload.password)?;
        let mut tx = self.pool.begin().await?;

        let user_id: Uuid = sqlx::query_scalar!(
            r#"
            INSERT INTO users (username, password_hash, full_name, role_id, is_active, custom_permissions_enabled)
            VALUES ($1, $2, $3, $4, TRUE, $5)
            RETURNING id
            "#,
            payload.username,
            pwd_hash,
            payload.full_name,
            payload.role_id,
            payload.custom_permissions_enabled.unwrap_or(false)
        )
        .fetch_one(&mut *tx)
        .await?;

        for wh_id in &payload.warehouse_ids {
            sqlx::query!(
                r#"
                INSERT INTO user_warehouses (user_id, warehouse_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                "#,
                user_id,
                wh_id
            )
            .execute(&mut *tx)
            .await?;
        }

        if payload.custom_permissions_enabled.unwrap_or(false) {
            if let Some(perms) = payload.custom_permissions {
                for perm in perms {
                    sqlx::query!(
                        r#"
                        INSERT INTO user_permissions (user_id, permission_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                        "#,
                        user_id,
                        perm
                    )
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }

        tx.commit().await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE",
                "USER",
                Some(&user_id.to_string()),
                Some(json!({
                    "username": payload.username,
                    "role_id": payload.role_id,
                    "warehouses": payload.warehouse_ids
                })),
            )
            .await;

        Ok(user_id)
    }

    pub async fn update_user(
        &self,
        claims: &Claims,
        user_id: Uuid,
        payload: UpdateUserRequest,
    ) -> Result<(), AppError> {
        let user = self
            .user_repo
            .get_user_by_id(user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Pengguna tidak ditemukan".to_string()))?;

        let mut tx = self.pool.begin().await?;

        let new_pwd_hash = if let Some(pwd) = payload.password {
            if !pwd.trim().is_empty() {
                Some(hash_password(&pwd)?)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(pwd_h) = new_pwd_hash {
            sqlx::query!(
                r#"
                UPDATE users
                SET full_name = COALESCE($1, full_name),
                    role_id = COALESCE($2, role_id),
                    is_active = COALESCE($3, is_active),
                    custom_permissions_enabled = COALESCE($4, custom_permissions_enabled),
                    password_hash = $5,
                    updated_at = NOW()
                WHERE id = $6
                "#,
                payload.full_name,
                payload.role_id,
                payload.is_active,
                payload.custom_permissions_enabled,
                pwd_h,
                user_id
            )
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query!(
                r#"
                UPDATE users
                SET full_name = COALESCE($1, full_name),
                    role_id = COALESCE($2, role_id),
                    is_active = COALESCE($3, is_active),
                    custom_permissions_enabled = COALESCE($4, custom_permissions_enabled),
                    updated_at = NOW()
                WHERE id = $5
                "#,
                payload.full_name,
                payload.role_id,
                payload.is_active,
                payload.custom_permissions_enabled,
                user_id
            )
            .execute(&mut *tx)
            .await?;
        }

        if let Some(wh_ids) = payload.warehouse_ids {
            sqlx::query!(r#"DELETE FROM user_warehouses WHERE user_id = $1"#, user_id)
                .execute(&mut *tx)
                .await?;

            for wh in wh_ids {
                sqlx::query!(
                    r#"INSERT INTO user_warehouses (user_id, warehouse_id) VALUES ($1, $2)"#,
                    user_id,
                    wh
                )
                .execute(&mut *tx)
                .await?;
            }
        }

        if let Some(custom_flag) = payload.custom_permissions_enabled {
            if custom_flag {
                if let Some(perms) = payload.custom_permissions {
                    sqlx::query!(
                        r#"DELETE FROM user_permissions WHERE user_id = $1"#,
                        user_id
                    )
                    .execute(&mut *tx)
                    .await?;

                    for perm in perms {
                        sqlx::query!(
                            r#"INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2)"#,
                            user_id,
                            perm
                        )
                        .execute(&mut *tx)
                        .await?;
                    }
                }
            } else {
                sqlx::query!(
                    r#"DELETE FROM user_permissions WHERE user_id = $1"#,
                    user_id
                )
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "UPDATE",
                "USER",
                Some(&user_id.to_string()),
                Some(json!({
                    "username": user.username,
                    "role_id": payload.role_id,
                    "is_active": payload.is_active
                })),
            )
            .await;

        Ok(())
    }

    pub async fn list_roles(&self) -> Result<Vec<RoleItem>, AppError> {
        self.user_repo.list_roles().await
    }

    pub async fn update_role_permissions(
        &self,
        claims: &Claims,
        role_id: &str,
        payload: UpdateRolePermissionsRequest,
    ) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await?;

        sqlx::query!(
            r#"DELETE FROM role_permissions WHERE role_id = $1"#,
            role_id
        )
        .execute(&mut *tx)
        .await?;

        for perm in &payload.permissions {
            sqlx::query!(
                r#"INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)"#,
                role_id,
                perm
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "UPDATE_PERMISSIONS",
                "ROLE",
                Some(role_id),
                Some(json!({ "permissions": payload.permissions })),
            )
            .await;

        Ok(())
    }

    pub async fn list_permissions(&self) -> Result<Vec<PermissionItem>, AppError> {
        self.user_repo.list_permissions().await
    }

    pub async fn delete_user(&self, claims: &Claims, id: Uuid) -> Result<(), AppError> {
        let user = self
            .user_repo
            .get_user_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Pengguna tidak ditemukan".to_string()))?;

        self.user_repo.soft_delete_user(id).await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "DELETE",
                "USER",
                Some(&id.to_string()),
                Some(json!({ "username": user.username, "soft_delete": true })),
            )
            .await;

        Ok(())
    }
}
