use crate::{
    domain::entities::{
        PermissionItem, RefreshTokenSession, RoleItem, UserManagementItem, WarehouseInfo,
    },
    error::AppError,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<UserRow>, AppError> {
        let row = sqlx::query_as!(
            UserRow,
            r#"
            SELECT u.id, u.username, u.password_hash, u.full_name, u.role_id, u.is_active,
                   u.avatar_url, u.email, u.phone, u.custom_permissions_enabled,
                   r.name as role_name,
                   u.failed_login_attempts, u.locked_until, u.deleted_at
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.username = $1 AND u.deleted_at IS NULL
            "#,
            username
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserRow>, AppError> {
        let row = sqlx::query_as!(
            UserRow,
            r#"
            SELECT u.id, u.username, u.password_hash, u.full_name, u.role_id, u.is_active,
                   u.avatar_url, u.email, u.phone, u.custom_permissions_enabled,
                   r.name as role_name,
                   u.failed_login_attempts, u.locked_until, u.deleted_at
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1 AND u.deleted_at IS NULL
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn record_failed_login(&self, username: &str) -> Result<i32, AppError> {
        let row = sqlx::query!(
            r#"
            UPDATE users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE
                    WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                    ELSE locked_until
                END
            WHERE username = $1 AND deleted_at IS NULL
            RETURNING failed_login_attempts
            "#,
            username
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.failed_login_attempts).unwrap_or(0))
    }

    pub async fn reset_failed_logins(&self, user_id: Uuid) -> Result<(), AppError> {
        let _ = sqlx::query!(
            r#"
            UPDATE users
            SET failed_login_attempts = 0, locked_until = NULL
            WHERE id = $1
            "#,
            user_id
        )
        .execute(&self.pool)
        .await;

        Ok(())
    }

    pub async fn soft_delete_user(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE users
            SET deleted_at = NOW(), is_active = FALSE
            WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        // Invalidate active sessions
        self.revoke_all_user_tokens(id).await?;

        Ok(())
    }

    pub async fn get_user_warehouses(&self, user_id: Uuid) -> Result<Vec<WarehouseInfo>, AppError> {
        let rows = sqlx::query_as!(
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
            WHERE uw.user_id = $1 AND w.is_active = TRUE AND w.deleted_at IS NULL
            ORDER BY w.name
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_all_active_warehouses(&self) -> Result<Vec<WarehouseInfo>, AppError> {
        let rows = sqlx::query_as!(
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
            WHERE w.is_active = TRUE AND w.deleted_at IS NULL
            ORDER BY w.name
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_effective_permissions(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        let custom_flag = sqlx::query_scalar!(
            r#"SELECT custom_permissions_enabled FROM users WHERE id = $1"#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or(false);

        let perms = if custom_flag {
            sqlx::query_scalar!(
                r#"
                SELECT permission_id
                FROM user_permissions
                WHERE user_id = $1
                ORDER BY permission_id
                "#,
                user_id
            )
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_scalar!(
                r#"
                SELECT rp.permission_id
                FROM users u
                JOIN role_permissions rp ON u.role_id = rp.role_id
                WHERE u.id = $1
                ORDER BY rp.permission_id
                "#,
                user_id
            )
            .fetch_all(&self.pool)
            .await?
        };

        Ok(perms)
    }

    pub async fn list_users(&self) -> Result<Vec<UserManagementItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT u.id, u.username, u.full_name, u.role_id, r.name as "role_name?",
                   u.is_active, u.custom_permissions_enabled, u.created_at
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.deleted_at IS NULL
            ORDER BY u.created_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for r in rows {
            let user_id = r.id;
            let role_id = r.role_id.unwrap_or_else(|| "GUEST".to_string());
            let role_name = r.role_name.unwrap_or_else(|| "Pengguna".to_string());

            let warehouses = if role_id == "SUPER_ADMIN" || role_id == "MANAGER" {
                self.get_all_active_warehouses().await?
            } else {
                self.get_user_warehouses(user_id).await?
            };

            let perms = self.get_effective_permissions(user_id).await?;

            result.push(UserManagementItem {
                id: user_id,
                username: r.username,
                full_name: r.full_name,
                role_id,
                role_name,
                is_active: r.is_active,
                warehouses,
                custom_permissions_enabled: r.custom_permissions_enabled,
                permissions: perms,
                created_at: r.created_at,
            });
        }

        Ok(result)
    }

    pub async fn list_roles(&self) -> Result<Vec<RoleItem>, AppError> {
        let roles = sqlx::query!(
            r#"
            SELECT id, name, description
            FROM roles
            ORDER BY id
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let mut res = Vec::new();
        for r in roles {
            let perms = sqlx::query_scalar!(
                r#"
                SELECT permission_id
                FROM role_permissions
                WHERE role_id = $1
                ORDER BY permission_id
                "#,
                r.id
            )
            .fetch_all(&self.pool)
            .await?;

            res.push(RoleItem {
                id: r.id,
                name: r.name,
                description: r.description,
                permissions: perms,
            });
        }

        Ok(res)
    }

    pub async fn list_permissions(&self) -> Result<Vec<PermissionItem>, AppError> {
        let items = sqlx::query_as!(
            PermissionItem,
            r#"
            SELECT id, name, category
            FROM permissions
            ORDER BY category, id
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    // --- Session & Refresh Token Rotation Management ---
    pub async fn save_refresh_token(
        &self,
        user_id: Uuid,
        token_hash: &str,
        expires_at: DateTime<Utc>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, last_used_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            "#,
            user_id,
            token_hash,
            expires_at,
            ip_address,
            user_agent
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn rotate_refresh_token(
        &self,
        old_token_hash: &str,
        new_token_hash: &str,
        new_expires_at: DateTime<Utc>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<Option<Uuid>, AppError> {
        let mut tx = self.pool.begin().await?;

        let record = sqlx::query!(
            r#"
            SELECT id, user_id
            FROM refresh_tokens
            WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
            FOR UPDATE
            "#,
            old_token_hash
        )
        .fetch_optional(&mut *tx)
        .await?;

        let user_id = match record {
            Some(r) => r.user_id,
            None => {
                tx.rollback().await?;
                return Ok(None);
            }
        };

        // Revoke the old token
        sqlx::query!(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE token_hash = $1
            "#,
            old_token_hash
        )
        .execute(&mut *tx)
        .await?;

        // Insert new rotated token
        sqlx::query!(
            r#"
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, last_used_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            "#,
            user_id,
            new_token_hash,
            new_expires_at,
            ip_address,
            user_agent
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Some(user_id))
    }

    pub async fn revoke_refresh_token(&self, token_hash: &str) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE token_hash = $1
            "#,
            token_hash
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn revoke_all_user_tokens(&self, user_id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
            "#,
            user_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_user_sessions(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<RefreshTokenSession>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT id, user_id, ip_address, user_agent, created_at, last_used_at, expires_at,
                   (revoked_at IS NULL AND expires_at > NOW()) as "is_active!"
            FROM refresh_tokens
            WHERE user_id = $1
            ORDER BY last_used_at DESC
            LIMIT 20
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        let sessions = rows
            .into_iter()
            .map(|r| RefreshTokenSession {
                id: r.id,
                user_id: r.user_id,
                ip_address: r.ip_address,
                user_agent: r.user_agent,
                created_at: r.created_at,
                last_used_at: r.last_used_at.unwrap_or(r.created_at),
                expires_at: r.expires_at,
                is_active: r.is_active,
            })
            .collect();

        Ok(sessions)
    }

    pub async fn revoke_session(&self, user_id: Uuid, session_id: Uuid) -> Result<bool, AppError> {
        let res = sqlx::query!(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
            "#,
            session_id,
            user_id
        )
        .execute(&self.pool)
        .await?;

        Ok(res.rows_affected() > 0)
    }
}

#[allow(dead_code)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub full_name: String,
    pub role_id: Option<String>,
    pub is_active: bool,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub custom_permissions_enabled: bool,
    pub role_name: Option<String>,
    pub failed_login_attempts: i32,
    pub locked_until: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}
