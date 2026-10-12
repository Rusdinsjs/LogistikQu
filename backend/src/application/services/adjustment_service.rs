use crate::{
    application::validators::AdjustmentValidator,
    domain::entities::{Claims, CreateAdjustmentRequest},
    error::AppError,
    infrastructure::{
        database::next_document_number,
        repositories::{AdjustmentRepository, AuditRepository},
    },
};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AdjustmentService {
    pool: PgPool,
    adjustment_repo: AdjustmentRepository,
    audit_repo: AuditRepository,
}

impl AdjustmentService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            adjustment_repo: AdjustmentRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn create_adjustment(
        &self,
        claims: &Claims,
        payload: CreateAdjustmentRequest,
    ) -> Result<Value, AppError> {
        AdjustmentValidator::validate(&payload)?;

        let mut tx = self.pool.begin().await?;

        let adj_no = next_document_number(&mut tx, "ADJ").await?;

        let adj_id = sqlx::query_scalar!(
            r#"
            INSERT INTO stock_adjustments (
                adjustment_number, warehouse_id, reason, notes,
                status, created_by
            ) VALUES ($1, $2, $3, $4, 'PENDING_APPROVAL', $5)
            RETURNING id
            "#,
            adj_no,
            payload.warehouse_id,
            payload.reason,
            payload.notes,
            claims.sub
        )
        .fetch_one(&mut *tx)
        .await?;

        for itm in payload.items {
            let current_qty = sqlx::query_scalar!(
                r#"
                SELECT qty_on_hand FROM inventory_stock
                WHERE warehouse_id = $1 AND spare_part_id = $2
                "#,
                payload.warehouse_id,
                itm.spare_part_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(Decimal::ZERO);

            let diff = itm.qty_physical - current_qty;

            sqlx::query!(
                r#"
                INSERT INTO stock_adjustment_items (
                    adjustment_id, spare_part_id, qty_system, qty_physical, difference
                ) VALUES ($1, $2, $3, $4, $5)
                "#,
                adj_id,
                itm.spare_part_id,
                current_qty,
                itm.qty_physical,
                diff
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
                "CREATE_ADJUSTMENT",
                "STOCK_ADJUSTMENT",
                Some(&adj_no),
                Some(json!({ "warehouse_id": payload.warehouse_id, "reason": payload.reason })),
            )
            .await;

        Ok(json!({
            "success": true,
            "adjustment_id": adj_id,
            "adjustment_number": adj_no,
            "status": "PENDING_APPROVAL",
            "message": "Pengajuan penyesuaian stok opname berhasil dikirim untuk approval Supervisor"
        }))
    }

    pub async fn list_adjustments(
        &self,
        wh_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<Value>, AppError> {
        let headers = self
            .adjustment_repo
            .list_adjustments(wh_filter, user_whs)
            .await?;

        let mut res = Vec::new();
        for h in headers {
            let items = self.adjustment_repo.get_adjustment_items(h.id).await?;
            res.push(json!({
                "adjustment": h,
                "items": items
            }));
        }

        Ok(res)
    }

    pub async fn approve_adjustment(&self, claims: &Claims, id: Uuid) -> Result<Value, AppError> {
        let mut tx = self.pool.begin().await?;

        let adj = sqlx::query!(
            r#"
            SELECT id, adjustment_number, warehouse_id, status
            FROM stock_adjustments
            WHERE id = $1 FOR UPDATE
            "#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Pengajuan penyesuaian tidak ditemukan".to_string()))?;

        if adj.status != "PENDING_APPROVAL" {
            return Err(AppError::BadRequest(
                "Pengajuan penyesuaian bukan berstatus PENDING_APPROVAL".to_string(),
            ));
        }

        let items = sqlx::query!(
            r#"
            SELECT spare_part_id, qty_physical, difference
            FROM stock_adjustment_items
            WHERE adjustment_id = $1
            "#,
            id
        )
        .fetch_all(&mut *tx)
        .await?;

        for itm in items {
            sqlx::query!(
                r#"
                UPDATE inventory_stock
                SET qty_on_hand = $1, updated_at = NOW()
                WHERE warehouse_id = $2 AND spare_part_id = $3
                "#,
                itm.qty_physical,
                adj.warehouse_id,
                itm.spare_part_id
            )
            .execute(&mut *tx)
            .await?;

            let mov_type = if itm.difference >= Decimal::ZERO {
                "ADJUSTMENT_IN"
            } else {
                "ADJUSTMENT_OUT"
            };

            sqlx::query!(
                r#"
                INSERT INTO stock_movements (
                    warehouse_id, spare_part_id, movement_type, qty,
                    balance_after, reference_number, notes, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, 'Hasil approval stock opname oleh Supervisor', $7)
                "#,
                adj.warehouse_id,
                itm.spare_part_id,
                mov_type,
                itm.difference.abs(),
                itm.qty_physical,
                adj.adjustment_number,
                claims.sub
            )
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query!(
            r#"
            UPDATE stock_adjustments
            SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
            WHERE id = $2
            "#,
            claims.sub,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "message": format!("Penyesuaian stok {} disetujui, saldo fisik diselaraskan", adj.adjustment_number)
        }))
    }

    pub async fn get_adjustment(&self, id: Uuid) -> Result<Value, AppError> {
        let header = self
            .adjustment_repo
            .get_adjustment_by_id(id)
            .await?
            .ok_or_else(|| {
                AppError::NotFound("Pengajuan penyesuaian tidak ditemukan".to_string())
            })?;
        let items = self.adjustment_repo.get_adjustment_items(id).await?;
        Ok(json!({
            "adjustment": header,
            "items": items
        }))
    }

    pub async fn reject_adjustment(
        &self,
        claims: &Claims,
        id: Uuid,
        reason: &str,
    ) -> Result<Value, AppError> {
        let mut tx = self.pool.begin().await?;

        let adj = sqlx::query!(
            r#"
            SELECT id, adjustment_number, warehouse_id, status
            FROM stock_adjustments
            WHERE id = $1 FOR UPDATE
            "#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Pengajuan penyesuaian tidak ditemukan".to_string()))?;

        if adj.status != "PENDING_APPROVAL" {
            return Err(AppError::BadRequest(
                "Pengajuan penyesuaian bukan berstatus PENDING_APPROVAL".to_string(),
            ));
        }

        let reject_note = format!("Catatan Penolakan Supervisor: {}", reason);

        sqlx::query(
            r#"
            UPDATE stock_adjustments
            SET status = 'REJECTED', approved_by = $1, approved_at = NOW(),
                notes = CASE WHEN notes IS NULL OR notes = '' THEN $2 ELSE notes || E'\n' || $2 END
            WHERE id = $3
            "#,
        )
        .bind(claims.sub)
        .bind(&reject_note)
        .bind(id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "REJECT_ADJUSTMENT",
                "STOCK_ADJUSTMENT",
                Some(&adj.adjustment_number),
                Some(json!({ "warehouse_id": adj.warehouse_id, "reject_reason": reason })),
            )
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Pengajuan stock opname {} telah ditolak", adj.adjustment_number)
        }))
    }
}
