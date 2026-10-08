use crate::{
    config::AppConfig,
    domain::models::Claims,
    error::AppError,
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
            .ok_or_else(|| AppError::Unauthorized("Header Authorization tidak ditemukan".to_string()))?;

        if !auth_header.starts_with("Bearer ") {
            return Err(AppError::Unauthorized("Format token Bearer tidak valid".to_string()));
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
    if user.role_id == "SUPER_ADMIN" {
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

// Helper untuk mengecek permission tertentu
pub async fn check_permission(
    pool: &PgPool,
    user: &Claims,
    permission_id: &str,
) -> Result<(), AppError> {
    if user.role_id == "SUPER_ADMIN" {
        return Ok(());
    }

    let has_perm = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM role_permissions
            WHERE role_id = $1 AND permission_id = $2
        )
        "#,
    )
    .bind(&user.role_id)
    .bind(permission_id)
    .fetch_one(pool)
    .await?;

    if !has_perm {
        return Err(AppError::Forbidden(format!(
            "Peran Anda ({}) tidak memiliki izin '{}'",
            user.role_id, permission_id
        )));
    }

    Ok(())
}
