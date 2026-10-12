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

// Helper untuk mengecek apakah user berhak mengakses gudang tertentu (termasuk sub-gudang kontainer di bawah gudang utama user)
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
            SELECT 1 FROM user_warehouses uw
            WHERE uw.user_id = $1
              AND (
                  uw.warehouse_id = $2
                  OR EXISTS (
                      SELECT 1 FROM warehouse_supply_links wsl
                      WHERE wsl.main_warehouse_id = uw.warehouse_id
                        AND wsl.sub_warehouse_id = $2
                  )
                  OR EXISTS (
                      SELECT 1 FROM warehouses w
                      WHERE w.parent_warehouse_id = uw.warehouse_id
                        AND w.id = $2
                  )
              )
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
// (termasuk sub-gudang kontainer yang disuplai oleh gudang utama milik user)
pub async fn get_user_warehouse_ids(pool: &PgPool, user: &Claims) -> Result<Vec<String>, AppError> {
    if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        let all = sqlx::query_scalar::<_, String>("SELECT id FROM warehouses ORDER BY id")
            .fetch_all(pool)
            .await?;
        return Ok(all);
    }

    let list = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DISTINCT w_id FROM (
            SELECT warehouse_id AS w_id FROM user_warehouses WHERE user_id = $1
            UNION
            SELECT wsl.sub_warehouse_id AS w_id
            FROM user_warehouses uw
            JOIN warehouse_supply_links wsl ON wsl.main_warehouse_id = uw.warehouse_id
            WHERE uw.user_id = $1
            UNION
            SELECT w.id AS w_id
            FROM user_warehouses uw
            JOIN warehouses w ON w.parent_warehouse_id = uw.warehouse_id
            WHERE uw.user_id = $1
        ) sub
        ORDER BY w_id
        "#,
    )
    .bind(user.sub)
    .fetch_all(pool)
    .await?;

    Ok(list)
}

// Helper untuk meresolusi daftar warehouse_id berdasarkan filter opsional dan hak akses user
pub async fn resolve_warehouse_filter(
    pool: &PgPool,
    user: &Claims,
    requested_wh: Option<&str>,
) -> Result<Vec<String>, AppError> {
    if let Some(wh) = requested_wh.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        check_warehouse_access(pool, user, wh).await?;
        let expanded = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT w_id FROM (
                SELECT $1::text AS w_id
                UNION
                SELECT sub_warehouse_id AS w_id FROM warehouse_supply_links WHERE main_warehouse_id = $1
                UNION
                SELECT id AS w_id FROM warehouses WHERE parent_warehouse_id = $1
            ) sub
            ORDER BY w_id
            "#,
        )
        .bind(wh)
        .fetch_all(pool)
        .await?;
        return Ok(expanded);
    }

    get_user_warehouse_ids(pool, user).await
}

// Helper untuk menentukan kategori divisi armada user: Some("HE"), Some("DT"), atau None (ALL)
pub async fn get_user_fleet_category(
    pool: &PgPool,
    user: &Claims,
) -> Result<Option<String>, AppError> {
    let role_upper = user.role_id.to_uppercase();
    if role_upper == "SUPER_ADMIN" || role_upper == "MANAGER" {
        return Ok(None);
    }

    if role_upper.ends_with("_HE") || role_upper.contains("_HE_") {
        return Ok(Some("HE".to_string()));
    }
    if role_upper.ends_with("_DT") || role_upper.contains("_DT_") {
        return Ok(Some("DT".to_string()));
    }

    let wh_cats: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT UPPER(w.id), UPPER(COALESCE(w.category_id, ''))
        FROM user_warehouses uw
        JOIN warehouses w ON uw.warehouse_id = w.id
        WHERE uw.user_id = $1
        "#,
    )
    .bind(user.sub)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let has_he = wh_cats
        .iter()
        .any(|(id, cat)| cat == "HEAVY_EQUIPMENT" || id.contains("HE"));
    let has_dt = wh_cats
        .iter()
        .any(|(id, cat)| cat == "DUMP_TRUCK" || id.contains("DT"));

    if has_he && !has_dt {
        return Ok(Some("HE".to_string()));
    }
    if has_dt && !has_he {
        return Ok(Some("DT".to_string()));
    }

    let emp_dept: Option<String> = sqlx::query_scalar(
        r#"
        SELECT UPPER(COALESCE(e.department_id, ''))
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE u.id = $1
        "#,
    )
    .bind(user.sub)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some(dept) = emp_dept {
        if dept.contains("DT") || dept.contains("DUMP_TRUCK") {
            return Ok(Some("DT".to_string()));
        }
        if dept.contains("HE") || dept.contains("HEAVY_EQUIPMENT") {
            return Ok(Some("HE".to_string()));
        }
    }

    Ok(None)
}

// Helper untuk mendapatkan default container warehouse sesuai divisi user
pub async fn get_default_user_warehouse(pool: &PgPool, user: &Claims) -> Result<String, AppError> {
    if let Some(cat) = get_user_fleet_category(pool, user).await? {
        if cat == "DT" {
            return Ok("WH-CONT-DT".to_string());
        }
    }
    Ok("WH-CONT-HE".to_string())
}

// Helper untuk mengecek apakah unit merupakan Dump Truck (DT)
pub fn is_dt_unit(unit_number: &str, unit_type: Option<&str>, unit_name: Option<&str>) -> bool {
    let u_num = unit_number.trim().to_uppercase();
    let u_type = unit_type.unwrap_or("").trim().to_uppercase();
    let u_name = unit_name.unwrap_or("").trim().to_uppercase();

    if u_type == "HEAVY_EQUIPMENT"
        || u_type == "PC2000"
        || u_type == "EX1200"
        || u_type == "D85SS"
        || u_type == "EXCAVATOR"
        || u_type == "DOZER"
        || u_num.starts_with("EX")
        || u_num.starts_with("DZ")
        || u_num.starts_with("PC")
        || u_num.starts_with("EQ")
    {
        return false;
    }

    u_type == "DUMP_TRUCK"
        || u_type == "DT"
        || u_type == "HD785"
        || u_type == "CAT777"
        || u_type.contains("DUMP")
        || u_type.contains("HAUL")
        || u_num.starts_with("DT")
        || u_num.starts_with("HD")
        || u_name.contains("DUMP")
        || u_name.contains("HAUL")
        || u_name.contains("HD785")
        || u_name.contains("CAT 777")
        || u_name.contains("CAT777")
        || u_name.contains("SCANIA")
        || u_name.contains("VOLVO FMX")
        || u_name.contains("HINO")
        || u_name.contains("QUESTER")
        || u_name.contains("ACTROS")
}

// Helper untuk mengecek apakah unit termasuk ke dalam kategori divisi ('HE' atau 'DT')
pub fn is_unit_in_category(
    unit_number: &str,
    unit_type: Option<&str>,
    unit_name: Option<&str>,
    category: Option<&str>,
) -> bool {
    let Some(cat) = category
        .map(|c| c.trim().to_uppercase())
        .filter(|c| !c.is_empty() && c != "ALL")
    else {
        return true;
    };

    let is_dt = is_dt_unit(unit_number, unit_type, unit_name);
    if cat == "DT" || cat == "DUMP_TRUCK" {
        is_dt
    } else if cat == "HE" || cat == "HEAVY_EQUIPMENT" {
        !is_dt
    } else {
        true
    }
}

// Helper untuk mengecek apakah mekanik/karyawan merupakan divisi Dump Truck (DT)
pub fn is_dt_mechanic(dept_id: Option<&str>, position: Option<&str>, name: &str) -> bool {
    let dept = dept_id.unwrap_or("").trim().to_uppercase();
    let pos = position.unwrap_or("").trim().to_uppercase();
    let nm = name.trim().to_uppercase();

    dept == "DEPT-MECH-DT"
        || dept.contains("-DT")
        || dept.contains("DUMP_TRUCK")
        || pos.contains("DUMP TRUCK")
        || pos.contains("HAULING")
        || pos.contains("HAUL TRUCK")
        || pos.contains(" DT")
        || pos.starts_with("DT ")
        || pos.ends_with(" DT")
        || nm.contains(" DT")
        || nm.ends_with("-DT")
}

// Helper untuk mengecek apakah mekanik/karyawan termasuk ke dalam kategori divisi ('HE' atau 'DT')
pub fn is_mechanic_in_category(
    dept_id: Option<&str>,
    position: Option<&str>,
    name: &str,
    category: Option<&str>,
) -> bool {
    let Some(cat) = category
        .map(|c| c.trim().to_uppercase())
        .filter(|c| !c.is_empty() && c != "ALL")
    else {
        return true;
    };

    let is_dt = is_dt_mechanic(dept_id, position, name);
    if cat == "DT" || cat == "DUMP_TRUCK" {
        is_dt
    } else if cat == "HE" || cat == "HEAVY_EQUIPMENT" {
        !is_dt
    } else {
        true
    }
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
