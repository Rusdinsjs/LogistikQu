use crate::{
    application::validators::UserValidator,
    config::AppConfig,
    domain::entities::{
        Claims, LoginRequest, LoginResponse, RefreshTokenSession, UpdateProfileRequest, UserProfile,
    },
    error::AppError,
    infrastructure::{
        authentication::{create_jwt_token, hash_password, verify_password},
        repositories::{AuditRepository, UserRepository},
    },
};
use chrono::{Duration, Utc};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthService {
    pool: PgPool,
    config: AppConfig,
    user_repo: UserRepository,
    audit_repo: AuditRepository,
}

impl AuthService {
    pub fn new(pool: PgPool, config: AppConfig) -> Self {
        Self {
            pool: pool.clone(),
            config,
            user_repo: UserRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn login(
        &self,
        payload: LoginRequest,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> Result<LoginResponse, AppError> {
        let user = match self
            .user_repo
            .get_user_by_username(&payload.username)
            .await?
        {
            Some(u) => u,
            None => {
                let _ = self
                    .audit_repo
                    .record_log_full(
                        None,
                        Some(&payload.username),
                        "LOGIN_FAILED",
                        "USER",
                        None,
                        None,
                        Some(json!({"reason": "user not found"})),
                        ip_address.as_deref(),
                        user_agent.as_deref(),
                    )
                    .await;
                return Err(AppError::Unauthorized(
                    "Username atau password salah".to_string(),
                ));
            }
        };

        // 1. Check account lockout (Brute-force protection)
        if let Some(locked) = user.locked_until {
            if locked > Utc::now() {
                let remaining = (locked - Utc::now()).num_minutes() + 1;
                return Err(AppError::Forbidden(format!(
                    "Akun terkunci karena terlalu banyak percobaan gagal. Silakan coba kembali dalam {} menit.",
                    remaining
                )));
            }
        }

        if !user.is_active {
            return Err(AppError::Forbidden(
                "Akun pengguna sedang non-aktif".to_string(),
            ));
        }

        // 2. Verify password with Argon2
        let is_valid = verify_password(&payload.password, &user.password_hash)?;
        if !is_valid {
            let failed_count = self
                .user_repo
                .record_failed_login(&payload.username)
                .await?;
            let action = if failed_count >= 5 {
                "ACCOUNT_LOCKED"
            } else {
                "LOGIN_FAILED"
            };
            let _ = self
                .audit_repo
                .record_log_full(
                    Some(user.id),
                    Some(&user.username),
                    action,
                    "USER",
                    Some(&user.id.to_string()),
                    None,
                    Some(json!({ "failed_attempts": failed_count })),
                    ip_address.as_deref(),
                    user_agent.as_deref(),
                )
                .await;

            if failed_count >= 5 {
                return Err(AppError::Forbidden(
                    "Akun terkunci selama 15 menit karena 5 kali percobaan login gagal."
                        .to_string(),
                ));
            }
            return Err(AppError::Unauthorized(
                "Username atau password salah".to_string(),
            ));
        }

        // 3. Reset failed login attempts on success
        self.user_repo.reset_failed_logins(user.id).await?;

        let role_id = user.role_id.unwrap_or_else(|| "GUEST".to_string());
        let role_name = user.role_name.unwrap_or_else(|| "Pengguna".to_string());

        let warehouses = if role_id == "SUPER_ADMIN" || role_id == "MANAGER" {
            self.user_repo.get_all_active_warehouses().await?
        } else {
            self.user_repo.get_user_warehouses(user.id).await?
        };

        let permissions = self.user_repo.get_effective_permissions(user.id).await?;

        // 4. Generate JWT access token & Refresh token
        let token = create_jwt_token(user.id, &user.username, &role_id, &self.config.jwt_secret)?;

        let refresh_token = Uuid::new_v4().to_string();
        let refresh_expires = Utc::now() + Duration::days(7);

        self.user_repo
            .save_refresh_token(
                user.id,
                &refresh_token,
                refresh_expires,
                ip_address.as_deref(),
                user_agent.as_deref(),
            )
            .await?;

        let _ = self
            .audit_repo
            .record_log_full(
                Some(user.id),
                Some(&user.username),
                "LOGIN",
                "USER",
                Some(&user.id.to_string()),
                None,
                Some(json!({"event": "user logged in", "role": role_id})),
                ip_address.as_deref(),
                user_agent.as_deref(),
            )
            .await;

        Ok(LoginResponse {
            token,
            refresh_token: Some(refresh_token),
            user: UserProfile {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: Some(role_id.clone()),
                role_id: role_id.clone(),
                role_name,
                warehouse_id: warehouses.first().map(|w| w.id.clone()),
                warehouses,
                permissions,
                avatar_url: user.avatar_url,
                email: user.email,
                phone: user.phone,
                employee_id: sqlx::query_scalar::<_, Option<String>>(
                    "SELECT employee_id FROM users WHERE id = $1",
                )
                .bind(user.id)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten()
                .flatten(),
            },
        })
    }

    pub async fn refresh(
        &self,
        old_refresh_token: &str,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> Result<serde_json::Value, AppError> {
        let new_refresh_token = Uuid::new_v4().to_string();
        let new_expires = Utc::now() + Duration::days(7);

        let user_id = self
            .user_repo
            .rotate_refresh_token(
                old_refresh_token,
                &new_refresh_token,
                new_expires,
                ip_address.as_deref(),
                user_agent.as_deref(),
            )
            .await?
            .ok_or_else(|| {
                AppError::Unauthorized(
                    "Refresh token tidak valid atau telah kedaluwarsa".to_string(),
                )
            })?;

        let user = self
            .user_repo
            .get_user_by_id(user_id)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Pengguna tidak ditemukan".to_string()))?;

        if !user.is_active {
            return Err(AppError::Forbidden("Akun dinonaktifkan".to_string()));
        }

        let role_id = user.role_id.unwrap_or_else(|| "GUEST".to_string());
        let new_token =
            create_jwt_token(user.id, &user.username, &role_id, &self.config.jwt_secret)?;

        let _ = self
            .audit_repo
            .record_log_full(
                Some(user.id),
                Some(&user.username),
                "TOKEN_REFRESH",
                "USER",
                Some(&user.id.to_string()),
                None,
                Some(json!({"event": "token rotated"})),
                ip_address.as_deref(),
                user_agent.as_deref(),
            )
            .await;

        Ok(json!({
            "token": new_token,
            "refresh_token": new_refresh_token,
            "token_type": "Bearer",
            "expires_in": 3600
        }))
    }

    pub async fn logout(
        &self,
        claims: &Claims,
        refresh_token: Option<&str>,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> Result<(), AppError> {
        if let Some(token) = refresh_token {
            let _ = self.user_repo.revoke_refresh_token(token).await;
        } else {
            let _ = self.user_repo.revoke_all_user_tokens(claims.sub).await;
        }

        let _ = self
            .audit_repo
            .record_log_full(
                Some(claims.sub),
                Some(&claims.username),
                "LOGOUT",
                "USER",
                Some(&claims.sub.to_string()),
                None,
                Some(json!({"event": "user logged out"})),
                ip_address.as_deref(),
                user_agent.as_deref(),
            )
            .await;

        Ok(())
    }

    pub async fn list_sessions(
        &self,
        claims: &Claims,
    ) -> Result<Vec<RefreshTokenSession>, AppError> {
        self.user_repo.list_user_sessions(claims.sub).await
    }

    pub async fn revoke_session(&self, claims: &Claims, session_id: Uuid) -> Result<(), AppError> {
        let ok = self
            .user_repo
            .revoke_session(claims.sub, session_id)
            .await?;
        if !ok {
            return Err(AppError::NotFound(
                "Sesi tidak ditemukan atau sudah dicabut".to_string(),
            ));
        }
        Ok(())
    }

    pub async fn get_me(&self, claims: &Claims) -> Result<UserProfile, AppError> {
        let user = self
            .user_repo
            .get_user_by_id(claims.sub)
            .await?
            .ok_or_else(|| AppError::NotFound("Pengguna tidak ditemukan".to_string()))?;

        let role_id = user.role_id.unwrap_or_else(|| "GUEST".to_string());
        let role_name = user.role_name.unwrap_or_else(|| "Pengguna".to_string());

        let warehouses = if role_id == "SUPER_ADMIN" || role_id == "MANAGER" {
            self.user_repo.get_all_active_warehouses().await?
        } else {
            self.user_repo.get_user_warehouses(user.id).await?
        };

        let permissions = self.user_repo.get_effective_permissions(user.id).await?;

        let employee_id: Option<String> =
            sqlx::query_scalar::<_, Option<String>>("SELECT employee_id FROM users WHERE id = $1")
                .bind(user.id)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten()
                .flatten();

        Ok(UserProfile {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: Some(role_id.clone()),
            role_id,
            role_name,
            warehouse_id: warehouses.first().map(|w| w.id.clone()),
            warehouses,
            permissions,
            avatar_url: user.avatar_url,
            email: user.email,
            phone: user.phone,
            employee_id,
        })
    }

    pub async fn update_my_profile(
        &self,
        claims: &Claims,
        payload: UpdateProfileRequest,
    ) -> Result<UserProfile, AppError> {
        let user = self
            .user_repo
            .get_user_by_id(claims.sub)
            .await?
            .ok_or_else(|| AppError::NotFound("Pengguna tidak ditemukan".to_string()))?;

        let new_pwd_hash = if let Some(new_pwd) = payload.new_password {
            UserValidator::validate_password(&new_pwd)?;
            if let Some(curr_pwd) = payload.current_password {
                let valid = verify_password(&curr_pwd, &user.password_hash)?;
                if !valid {
                    return Err(AppError::BadRequest("Password saat ini salah".to_string()));
                }
                Some(hash_password(&new_pwd)?)
            } else {
                return Err(AppError::BadRequest(
                    "Password saat ini wajib diisi".to_string(),
                ));
            }
        } else {
            None
        };

        let new_full_name = payload.full_name.unwrap_or(user.full_name);
        let new_avatar = payload.avatar_url.or(user.avatar_url);
        let new_email = payload.email.or(user.email);
        let new_phone = payload.phone.or(user.phone);

        if let Some(pwd_h) = new_pwd_hash {
            sqlx::query!(
                r#"
                UPDATE users
                SET full_name = $1, avatar_url = $2, email = $3, phone = $4, password_hash = $5, updated_at = NOW()
                WHERE id = $6
                "#,
                new_full_name,
                new_avatar,
                new_email,
                new_phone,
                pwd_h,
                claims.sub
            )
            .execute(&self.pool)
            .await?;
        } else {
            sqlx::query!(
                r#"
                UPDATE users
                SET full_name = $1, avatar_url = $2, email = $3, phone = $4, updated_at = NOW()
                WHERE id = $5
                "#,
                new_full_name,
                new_avatar,
                new_email,
                new_phone,
                claims.sub
            )
            .execute(&self.pool)
            .await?;
        }

        self.get_me(claims).await
    }
}
