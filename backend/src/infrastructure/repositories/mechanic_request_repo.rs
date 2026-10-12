use crate::{
    domain::entities::{
        MechanicRequest, MechanicRequestFilterQuery, MechanicRequestHistory, MechanicRequestItem,
        MechanicRequestSummary,
    },
    error::AppError,
};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone)]
pub struct MechanicRequestRepository {
    pool: PgPool,
}

impl MechanicRequestRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn check_recent_duplicate(
        &self,
        unit_number: &str,
        part_ids: &[String],
    ) -> Result<Option<(String, String)>, AppError> {
        let row = sqlx::query_as::<_, (String, String)>(
            r#"
            SELECT r.request_number, i.spare_part_id
            FROM mechanic_requests r
            JOIN mechanic_request_items i ON r.id = i.request_id
            WHERE r.unit_number = $1
              AND i.spare_part_id = ANY($2)
              AND r.status IN ('SUBMITTED', 'APPROVED')
              AND r.created_at >= NOW() - INTERVAL '30 minutes'
            LIMIT 1
            "#,
        )
        .bind(unit_number)
        .bind(part_ids)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn find_by_client_uuid(
        &self,
        client_uuid: Uuid,
    ) -> Result<Option<MechanicRequest>, AppError> {
        let row = sqlx::query_as::<_, MechanicRequest>(
            r#"
            SELECT 
                r.id, r.request_number, r.request_type, r.warehouse_id, r.site_id, r.status,
                r.unit_number, r.unit_name, r.unit_type, r.ct_number, r.serial_number,
                r.hm_km, r.work_order_number, r.maintenance_type, r.priority,
                r.mechanic_id, r.mechanic_name, r.requester_user_id,
                COALESCE(u.full_name, r.mechanic_name) as requester_name,
                r.input_channel, r.damage_category, r.damage_description,
                r.damage_photo_url, r.old_part_photo_url, r.document_url,
                r.return_reason, r.reference_issue_number, r.notes,
                r.revision_notes, r.revision_count,
                r.approved_by, u_app.full_name as approved_by_name, r.approved_at, r.approve_notes,
                r.rejected_by, u_rej.full_name as rejected_by_name, r.rejected_at, r.reject_reason,
                r.fulfilled_by, u_ful.full_name as fulfilled_by_name, r.fulfilled_at, r.fulfill_notes,
                r.issue_transaction_id, iss.transaction_number as issue_transaction_number,
                r.client_uuid, r.device_id, r.created_by, r.created_at, r.updated_at,
                (SELECT COUNT(*)::bigint FROM mechanic_request_items WHERE request_id = r.id) as items_count,
                (SELECT COALESCE(SUM(requested_qty), 0) FROM mechanic_request_items WHERE request_id = r.id) as total_qty
            FROM mechanic_requests r
            LEFT JOIN users u ON r.requester_user_id = u.id
            LEFT JOIN users u_app ON r.approved_by = u_app.id
            LEFT JOIN users u_rej ON r.rejected_by = u_rej.id
            LEFT JOIN users u_ful ON r.fulfilled_by = u_ful.id
            LEFT JOIN issue_transactions iss ON r.issue_transaction_id = iss.id
            WHERE r.client_uuid = $1
            "#,
        )
        .bind(client_uuid)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<MechanicRequest>, AppError> {
        let row = sqlx::query_as::<_, MechanicRequest>(
            r#"
            SELECT 
                r.id, r.request_number, r.request_type, r.warehouse_id, r.site_id, r.status,
                r.unit_number, r.unit_name, r.unit_type, r.ct_number, r.serial_number,
                r.hm_km, r.work_order_number, r.maintenance_type, r.priority,
                r.mechanic_id, r.mechanic_name, r.requester_user_id,
                COALESCE(u.full_name, r.mechanic_name) as requester_name,
                r.input_channel, r.damage_category, r.damage_description,
                r.damage_photo_url, r.old_part_photo_url, r.document_url,
                r.return_reason, r.reference_issue_number, r.notes,
                r.revision_notes, r.revision_count,
                r.approved_by, u_app.full_name as approved_by_name, r.approved_at, r.approve_notes,
                r.rejected_by, u_rej.full_name as rejected_by_name, r.rejected_at, r.reject_reason,
                r.fulfilled_by, u_ful.full_name as fulfilled_by_name, r.fulfilled_at, r.fulfill_notes,
                r.issue_transaction_id, iss.transaction_number as issue_transaction_number,
                r.client_uuid, r.device_id, r.created_by, r.created_at, r.updated_at,
                (SELECT COUNT(*)::bigint FROM mechanic_request_items WHERE request_id = r.id) as items_count,
                (SELECT COALESCE(SUM(requested_qty), 0) FROM mechanic_request_items WHERE request_id = r.id) as total_qty
            FROM mechanic_requests r
            LEFT JOIN users u ON r.requester_user_id = u.id
            LEFT JOIN users u_app ON r.approved_by = u_app.id
            LEFT JOIN users u_rej ON r.rejected_by = u_rej.id
            LEFT JOIN users u_ful ON r.fulfilled_by = u_ful.id
            LEFT JOIN issue_transactions iss ON r.issue_transaction_id = iss.id
            WHERE r.id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn get_items(
        &self,
        request_id: Uuid,
        warehouse_id: &str,
    ) -> Result<Vec<MechanicRequestItem>, AppError> {
        let items = sqlx::query_as::<_, MechanicRequestItem>(
            r#"
            SELECT 
                i.id, i.request_id, i.spare_part_id, sp.part_name, i.unit_of_measure,
                i.requested_qty, i.approved_qty, i.fulfilled_qty, i.item_condition, i.notes,
                COALESCE(stk.qty_on_hand, 0) as stock_on_hand
            FROM mechanic_request_items i
            JOIN spare_parts sp ON i.spare_part_id = sp.id
            LEFT JOIN inventory_stock stk ON stk.warehouse_id = $2 AND stk.spare_part_id = i.spare_part_id
            WHERE i.request_id = $1
            ORDER BY i.id ASC
            "#,
        )
        .bind(request_id)
        .bind(warehouse_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn get_history(
        &self,
        request_id: Uuid,
    ) -> Result<Vec<MechanicRequestHistory>, AppError> {
        let history = sqlx::query_as::<_, MechanicRequestHistory>(
            r#"
            SELECT id, request_id, action, from_status, to_status,
                   actor_id, actor_name, actor_role, notes, changes, created_at
            FROM mechanic_request_history
            WHERE request_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(request_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(history)
    }

    pub async fn list_requests(
        &self,
        query: &MechanicRequestFilterQuery,
        user_warehouses: &[String],
        requester_id_filter: Option<Uuid>,
    ) -> Result<Vec<MechanicRequest>, AppError> {
        let search_pattern = format!("%{}%", query.search.as_deref().unwrap_or(""));
        let status_filter = query.status.as_deref().unwrap_or("");
        let type_filter = query.request_type.as_deref().unwrap_or("");
        let wh_filter = query.warehouse_id.as_deref().unwrap_or("");

        let rows = sqlx::query_as::<_, MechanicRequest>(
            r#"
            SELECT 
                r.id, r.request_number, r.request_type, r.warehouse_id, r.site_id, r.status,
                r.unit_number, r.unit_name, r.unit_type, r.ct_number, r.serial_number,
                r.hm_km, r.work_order_number, r.maintenance_type, r.priority,
                r.mechanic_id, r.mechanic_name, r.requester_user_id,
                COALESCE(u.full_name, r.mechanic_name) as requester_name,
                r.input_channel, r.damage_category, r.damage_description,
                r.damage_photo_url, r.old_part_photo_url, r.document_url,
                r.return_reason, r.reference_issue_number, r.notes,
                r.revision_notes, r.revision_count,
                r.approved_by, u_app.full_name as approved_by_name, r.approved_at, r.approve_notes,
                r.rejected_by, u_rej.full_name as rejected_by_name, r.rejected_at, r.reject_reason,
                r.fulfilled_by, u_ful.full_name as fulfilled_by_name, r.fulfilled_at, r.fulfill_notes,
                r.issue_transaction_id, iss.transaction_number as issue_transaction_number,
                r.client_uuid, r.device_id, r.created_by, r.created_at, r.updated_at,
                (SELECT COUNT(*)::bigint FROM mechanic_request_items WHERE request_id = r.id) as items_count,
                (SELECT COALESCE(SUM(requested_qty), 0) FROM mechanic_request_items WHERE request_id = r.id) as total_qty
            FROM mechanic_requests r
            LEFT JOIN users u ON r.requester_user_id = u.id
            LEFT JOIN users u_app ON r.approved_by = u_app.id
            LEFT JOIN users u_rej ON r.rejected_by = u_rej.id
            LEFT JOIN users u_ful ON r.fulfilled_by = u_ful.id
            LEFT JOIN issue_transactions iss ON r.issue_transaction_id = iss.id
            WHERE ($1 = '' OR r.warehouse_id = $1)
              AND (r.warehouse_id = ANY($2))
              AND ($3 = '' OR r.status = $3)
              AND ($4 = '' OR r.request_type = $4)
              AND ($5::uuid IS NULL OR r.requester_user_id = $5)
              AND (
                  $6 = '%%' OR
                  r.request_number ILIKE $6 OR
                  r.unit_number ILIKE $6 OR
                  r.mechanic_name ILIKE $6 OR
                  r.work_order_number ILIKE $6
              )
            ORDER BY r.created_at DESC
            LIMIT 200
            "#,
        )
        .bind(wh_filter)
        .bind(user_warehouses)
        .bind(status_filter)
        .bind(type_filter)
        .bind(requester_id_filter)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_summary(
        &self,
        warehouse_id: Option<&str>,
        user_warehouses: &[String],
        requester_id: Option<Uuid>,
    ) -> Result<MechanicRequestSummary, AppError> {
        let wh_filter = warehouse_id.unwrap_or("");

        let rows = sqlx::query_as::<_, (String, i64)>(
            r#"
            SELECT r.status, COUNT(*)::bigint
            FROM mechanic_requests r
            WHERE ($1 = '' OR r.warehouse_id = $1)
              AND (r.warehouse_id = ANY($2))
              AND ($3::uuid IS NULL OR r.requester_user_id = $3)
            GROUP BY r.status
            "#,
        )
        .bind(wh_filter)
        .bind(user_warehouses)
        .bind(requester_id)
        .fetch_all(&self.pool)
        .await?;

        let mut summary = MechanicRequestSummary::default();
        for (status, count) in rows {
            summary.total += count;
            match status.as_str() {
                "SUBMITTED" => summary.submitted = count,
                "REVISION_REQUESTED" => summary.revision_requested = count,
                "APPROVED" => summary.approved = count,
                "COMPLETED" => summary.completed = count,
                "REJECTED" => summary.rejected = count,
                "CANCELLED" => summary.cancelled = count,
                _ => {}
            }
        }

        Ok(summary)
    }

    pub async fn record_history(
        tx: &mut Transaction<'_, Postgres>,
        request_id: Uuid,
        action: &str,
        from_status: Option<&str>,
        to_status: &str,
        actor_id: Option<Uuid>,
        actor_name: &str,
        actor_role: &str,
        notes: Option<&str>,
        changes: Option<Value>,
    ) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO mechanic_request_history (
                request_id, action, from_status, to_status,
                actor_id, actor_name, actor_role, notes, changes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            "#,
        )
        .bind(request_id)
        .bind(action)
        .bind(from_status)
        .bind(to_status)
        .bind(actor_id)
        .bind(actor_name)
        .bind(actor_role)
        .bind(notes)
        .bind(changes)
        .execute(&mut **tx)
        .await?;

        Ok(())
    }
}
