use crate::{
    domain::entities::{AuditLogQuery, AuditLogRecord, PaginatedResponse},
    error::AppError,
    infrastructure::repositories::AuditRepository,
};
use sqlx::PgPool;

#[derive(Clone)]
pub struct AuditService {
    audit_repo: AuditRepository,
}

impl AuditService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn list_audit_logs(&self) -> Result<Vec<AuditLogRecord>, AppError> {
        self.audit_repo.list_logs().await
    }

    pub async fn list_audit_logs_paginated(
        &self,
        query: AuditLogQuery,
    ) -> Result<PaginatedResponse<AuditLogRecord>, AppError> {
        self.audit_repo.list_logs_paginated(query).await
    }
}
