use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, AuthUser},
    },
    domain::entities::AuditLogRecord,
    error::AppError,
};
use axum::{extract::State, Json};

pub async fn list_audit_logs(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<AuditLogRecord>>, AppError> {
    check_permission(&state.pool, &user, "audit.view").await?;
    let logs = state.services.audit.list_audit_logs().await?;
    Ok(Json(logs))
}
