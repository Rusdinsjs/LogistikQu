use crate::{
    domain::entities::{IssueTransaction, IssueTransactionItemDetail},
    error::AppError,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct IssueRepository {
    pool: PgPool,
}

pub struct DuplicateCheckResult {
    pub transaction_number: String,
    pub created_at: DateTime<Utc>,
    pub spare_part_id: String,
}

impl IssueRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn check_recent_duplicate(
        &self,
        unit_number: &str,
        part_ids: &[String],
    ) -> Result<Option<DuplicateCheckResult>, AppError> {
        let recent = sqlx::query!(
            r#"
            SELECT t.transaction_number, t.created_at, i.spare_part_id
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            WHERE t.unit_number = $1
              AND i.spare_part_id = ANY($2)
              AND t.created_at >= NOW() - INTERVAL '30 minutes'
            LIMIT 1
            "#,
            unit_number,
            part_ids
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(recent.map(|r| DuplicateCheckResult {
            transaction_number: r.transaction_number,
            created_at: r.created_at,
            spare_part_id: r.spare_part_id,
        }))
    }

    #[allow(dead_code)]
    pub async fn list_issues(
        &self,
        wh_filter: &str,
        status_filter: &str,
        search: &str,
        user_whs: &[String],
    ) -> Result<Vec<IssueTransaction>, AppError> {
        let search_pattern = format!("%{}%", search);

        let issues = sqlx::query_as::<_, IssueTransaction>(
            r#"
            SELECT id, transaction_number, warehouse_id, site_id, receiver_name,
                   receiver_employee_id, receiver_department, unit_number, unit_name,
                   unit_type, ct_number, serial_number, hm_km, mechanic_name,
                   mechanic_id, work_order_number, maintenance_type, priority,
                   status, notes, evidence_photo_url, document_url,
                   mechanic_signature_url, signature_type, receipt_printed, receipt_printed_at, signed_receipt_photo_url,
                   created_by, approved_by, created_at
            FROM issue_transactions
            WHERE ($1 = '' OR warehouse_id = $1)
              AND ($2 = '' OR status = $2)
              AND (warehouse_id = ANY($3))
              AND ($4 = '' OR transaction_number ILIKE $5 OR unit_number ILIKE $5 OR receiver_name ILIKE $5)
            ORDER BY created_at DESC
            LIMIT 100
            "#,
        )
        .bind(wh_filter)
        .bind(status_filter)
        .bind(user_whs)
        .bind(search)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await?;

        Ok(issues)
    }

    pub async fn get_issue_by_id(&self, id: Uuid) -> Result<Option<IssueTransaction>, AppError> {
        let issue = sqlx::query_as::<_, IssueTransaction>(
            r#"
            SELECT id, transaction_number, warehouse_id, site_id, receiver_name,
                   receiver_employee_id, receiver_department, unit_number, unit_name,
                   unit_type, ct_number, serial_number, hm_km, mechanic_name,
                   mechanic_id, work_order_number, maintenance_type, priority,
                   status, notes, evidence_photo_url, document_url,
                   mechanic_signature_url, signature_type, receipt_printed, receipt_printed_at, signed_receipt_photo_url,
                   created_by, approved_by, created_at
            FROM issue_transactions
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(issue)
    }

    pub async fn get_issue_items(
        &self,
        issue_id: Uuid,
    ) -> Result<Vec<IssueTransactionItemDetail>, AppError> {
        let items = sqlx::query_as!(
            IssueTransactionItemDetail,
            r#"
            SELECT i.id, i.transaction_id, i.spare_part_id, p.part_name,
                   i.qty, i.unit_of_measure
            FROM issue_transaction_items i
            JOIN spare_parts p ON i.spare_part_id = p.id
            WHERE i.transaction_id = $1
            "#,
            issue_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }
}
