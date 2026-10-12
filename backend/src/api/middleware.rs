use crate::{
    config::AppConfig, domain::models::Claims, error::AppError,
    infrastructure::auth::verify_jwt_token,
};
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header::AUTHORIZATION, request::Parts},
};
use sqlx::PgPool;

#[derive(Clone, Debug)]
pub struct AuthUser(pub Claims);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    AppConfig: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let config = AppConfig::from_ref(state);

        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|val| val.to_str().ok())
            .ok_or_else(|| {
                AppError::Unauthorized("Header Authorization tidak ditemukan".to_string())
            })?;

        if !auth_header.starts_with("Bearer ") {
            return Err(AppError::Unauthorized(
                "Format token Bearer tidak valid".to_string(),
            ));
        }

        let token = &auth_header["Bearer ".len()..];
        let claims = verify_jwt_token(token, &config.jwt_secret)?;

        Ok(AuthUser(claims))
    }
}

// Helper untuk mengecek apakah user berhak mengakses gudang tertentu
pub async fn check_warehouse_access(
    pool: &PgPool,
    user: &Claims,
    warehouse_id: &str,
) -> Result<(), AppError> {
    if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        return Ok(());
    }

    let has_access = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM user_warehouses
            WHERE user_id = $1 AND warehouse_id = $2
        )
        "#,
    )
    .bind(user.sub)
    .bind(warehouse_id)
    .fetch_one(pool)
    .await?;

    if !has_access {
        return Err(AppError::Forbidden(format!(
            "Anda tidak memiliki izin akses untuk gudang {}",
            warehouse_id
        )));
    }

    Ok(())
}

// Helper untuk mengecek permission tertentu (mendukung custom permission pengguna dan role)
pub async fn check_permission(
    pool: &PgPool,
    user: &Claims,
    permission_id: &str,
) -> Result<(), AppError> {
    if user.role_id == "SUPER_ADMIN" {
        return Ok(());
    }

    let custom_enabled =
        sqlx::query_scalar::<_, bool>("SELECT custom_permissions_enabled FROM users WHERE id = $1")
            .bind(user.sub)
            .fetch_optional(pool)
            .await?
            .unwrap_or(false);

    let has_perm = if custom_enabled {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM user_permissions WHERE user_id = $1 AND permission_id = $2)"
        )
        .bind(user.sub)
        .bind(permission_id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2)"
        )
        .bind(&user.role_id)
        .bind(permission_id)
        .fetch_one(pool)
        .await?
    };

    if !has_perm {
        return Err(AppError::Forbidden(format!(
            "Pengguna ({}) tidak memiliki izin '{}'",
            user.username, permission_id
        )));
    }

    Ok(())
}

// Helper untuk mengecek jika salah satu permission dari daftar diizinkan
pub async fn check_any_permission(
    pool: &PgPool,
    user: &Claims,
    permission_ids: &[&str],
) -> Result<(), AppError> {
    if user.role_id == "SUPER_ADMIN" {
        return Ok(());
    }

    for &pid in permission_ids {
        if check_permission(pool, user, pid).await.is_ok() {
            return Ok(());
        }
    }

    Err(AppError::Forbidden(format!(
        "Pengguna ({}) tidak memiliki izin yang diperlukan: {:?}",
        user.username, permission_ids
    )))
}

// Helper untuk mengecek akses data finansial (Harga, Biaya, dan Valuasi Stok)
pub async fn check_financial_access(pool: &PgPool, user: &Claims) -> Result<(), AppError> {
    if user.can_access_financials() {
        return Ok(());
    }

    let custom_enabled =
        sqlx::query_scalar::<_, bool>("SELECT custom_permissions_enabled FROM users WHERE id = $1")
            .bind(user.sub)
            .fetch_optional(pool)
            .await?
            .unwrap_or(false);

    if custom_enabled {
        let has_perm = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM user_permissions WHERE user_id = $1 AND permission_id = 'financial.view')"
        )
        .bind(user.sub)
        .fetch_one(pool)
        .await?;
        if has_perm {
            return Ok(());
        }
    }

    Err(AppError::Forbidden(
        "Akses ditolak: Data harga satuan, biaya, dan nilai valuasi stok hanya dapat diakses oleh Super Admin dan Manager.".to_string(),
    ))
}

// Helper untuk mengambil seluruh izin aktif (efektif) dari seorang pengguna
#[allow(dead_code)]
pub async fn get_effective_user_permissions(
    pool: &PgPool,
    user_id: uuid::Uuid,
    role_id: &str,
    custom_enabled: bool,
) -> Result<Vec<String>, AppError> {
    if role_id == "SUPER_ADMIN" {
        let all =
            sqlx::query_scalar::<_, String>("SELECT id FROM permissions ORDER BY category, id")
                .fetch_all(pool)
                .await?;
        return Ok(all);
    }

    if custom_enabled {
        let list = sqlx::query_scalar::<_, String>(
            "SELECT permission_id FROM user_permissions WHERE user_id = $1 ORDER BY permission_id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;
        return Ok(list);
    }

    let list = sqlx::query_scalar::<_, String>(
        "SELECT permission_id FROM role_permissions WHERE role_id = $1 ORDER BY permission_id",
    )
    .bind(role_id)
    .fetch_all(pool)
    .await?;
    Ok(list)
}

// Helper untuk mendapatkan seluruh daftar warehouse_id yang diizinkan untuk pengguna
pub async fn get_user_warehouse_ids(pool: &PgPool, user: &Claims) -> Result<Vec<String>, AppError> {
    if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        let all = sqlx::query_scalar::<_, String>("SELECT id FROM warehouses ORDER BY id")
            .fetch_all(pool)
            .await?;
        return Ok(all);
    }

    let list = sqlx::query_scalar::<_, String>(
        "SELECT warehouse_id FROM user_warehouses WHERE user_id = $1 ORDER BY warehouse_id",
    )
    .bind(user.sub)
    .fetch_all(pool)
    .await?;

    Ok(list)
}

// ============================================================================
// Security Headers & Rate Limiting (Enterprise Standard)
// ============================================================================

pub async fn security_headers_middleware(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    headers.insert(
        "X-Content-Type-Options",
        axum::http::HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        "X-Frame-Options",
        axum::http::HeaderValue::from_static("DENY"),
    );
    headers.insert(
        "X-XSS-Protection",
        axum::http::HeaderValue::from_static("1; mode=block"),
    );
    headers.insert(
        "Strict-Transport-Security",
        axum::http::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers.insert(
        "Referrer-Policy",
        axum::http::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    response
}

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[allow(dead_code)]
#[derive(Clone)]
pub struct InMemoryRateLimiter {
    clients: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
    max_requests: u32,
    window: Duration,
}

#[allow(dead_code)]
impl InMemoryRateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub async fn is_allowed(&self, key: &str) -> bool {
        let mut map = self.clients.lock().await;
        let now = Instant::now();

        if let Some((count, start_time)) = map.get_mut(key) {
            if now.duration_since(*start_time) < self.window {
                if *count >= self.max_requests {
                    return false;
                }
                *count += 1;
                return true;
            } else {
                *count = 1;
                *start_time = now;
                return true;
            }
        } else {
            if map.len() > 5000 {
                map.retain(|_, (_, time)| now.duration_since(*time) < self.window);
            }
            map.insert(key.to_string(), (1, now));
            true
        }
    }
}
