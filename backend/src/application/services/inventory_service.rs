use crate::{
    application::validators::{StockTransferValidator, StockWriteOffValidator},
    domain::entities::{
        Claims, DashboardSummary, InventoryStockItem, LedgerQuery, PaginatedResponse,
        StockMovement, StockTransferRequest, StockWriteOffRequest,
    },
    error::AppError,
    infrastructure::repositories::{AuditRepository, InventoryRepository},
};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ImportStockRow {
    pub spare_part_id: String,
    pub qty_on_hand: Decimal,
    pub min_stock: Option<Decimal>,
    pub max_stock: Option<Decimal>,
    pub safety_stock: Option<Decimal>,
    pub rack_location: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImportStockPayload {
    pub warehouse_id: String,
    pub rows: Vec<ImportStockRow>,
}

#[derive(Clone)]
pub struct InventoryService {
    pool: PgPool,
    inventory_repo: InventoryRepository,
    audit_repo: AuditRepository,
}

impl InventoryService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            inventory_repo: InventoryRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn validate_warehouse_access(
        &self,
        claims: &Claims,
        warehouse_id: &str,
    ) -> Result<(), AppError> {
        if claims.role_id == "SUPER_ADMIN" || claims.role_id == "MANAGER" {
            return Ok(());
        }

        let has_access = sqlx::query_scalar!(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM user_warehouses
                WHERE user_id = $1 AND warehouse_id = $2
            )
            "#,
            claims.sub,
            warehouse_id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);

        if !has_access {
            return Err(AppError::Forbidden(format!(
                "Otoritas Ditolak: Anda tidak memiliki akses operasional pada gudang '{}'",
                warehouse_id
            )));
        }

        Ok(())
    }

    pub async fn list_stock(
        &self,
        warehouse_id: &str,
        search: &str,
    ) -> Result<Vec<InventoryStockItem>, AppError> {
        self.inventory_repo.list_stock(warehouse_id, search).await
    }

    pub async fn get_stock_item(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
    ) -> Result<InventoryStockItem, AppError> {
        self.inventory_repo
            .get_stock_item(warehouse_id, spare_part_id)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Item '{}' tidak ditemukan di gudang '{}'",
                    spare_part_id, warehouse_id
                ))
            })
    }

    pub async fn update_stock_photo(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
        photo_url: Option<String>,
    ) -> Result<(), AppError> {
        self.inventory_repo
            .update_stock_photo(warehouse_id, spare_part_id, photo_url.as_deref())
            .await
    }

    pub async fn get_stock_movements(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
    ) -> Result<Vec<StockMovement>, AppError> {
        self.inventory_repo
            .get_movements(warehouse_id, spare_part_id)
            .await
    }

    pub async fn query_ledger(
        &self,
        query: LedgerQuery,
    ) -> Result<PaginatedResponse<StockMovement>, AppError> {
        self.inventory_repo.query_ledger_paginated(query).await
    }

    pub async fn transfer_stock(
        &self,
        claims: &Claims,
        payload: StockTransferRequest,
    ) -> Result<serde_json::Value, AppError> {
        self.validate_warehouse_access(claims, &payload.from_warehouse_id)
            .await?;
        StockTransferValidator::validate(&payload)?;

        let doc_no =
            crate::infrastructure::database::generate_document_number(&self.pool, "TRF").await?;

        self.inventory_repo
            .transfer_stock_tx(payload, &doc_no, Some(claims.sub))
            .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "TRANSFER_STOCK",
                "INVENTORY",
                Some(&doc_no),
                Some(json!({ "document_number": doc_no })),
            )
            .await;

        Ok(json!({
            "status": "success",
            "message": "Transfer stok antar gudang berhasil dieksekusi",
            "document_number": doc_no
        }))
    }

    pub async fn write_off_stock(
        &self,
        claims: &Claims,
        payload: StockWriteOffRequest,
    ) -> Result<serde_json::Value, AppError> {
        self.validate_warehouse_access(claims, &payload.warehouse_id)
            .await?;
        StockWriteOffValidator::validate(&payload)?;

        let prefix = if payload.movement_type.to_uppercase() == "DAMAGE" {
            "DMG"
        } else {
            "LST"
        };
        let doc_no =
            crate::infrastructure::database::generate_document_number(&self.pool, prefix).await?;

        self.inventory_repo
            .write_off_stock_tx(payload, &doc_no, Some(claims.sub))
            .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "WRITE_OFF_STOCK",
                "INVENTORY",
                Some(&doc_no),
                Some(json!({ "document_number": doc_no })),
            )
            .await;

        Ok(json!({
            "status": "success",
            "message": "Write-off penyesuaian stok berhasil dicatat ke immutable ledger",
            "document_number": doc_no
        }))
    }

    pub async fn import_initial_stock(
        &self,
        user_id: Uuid,
        username: &str,
        payload: ImportStockPayload,
    ) -> Result<usize, AppError> {
        let mut tx = self.pool.begin().await?;
        let mut count = 0;

        for row in &payload.rows {
            let min_s = row.min_stock.unwrap_or_else(|| Decimal::from(10));
            let max_s = row.max_stock.unwrap_or_else(|| Decimal::from(100));
            let safety_s = row.safety_stock.unwrap_or_else(|| Decimal::from(5));

            sqlx::query!(
                r#"
                INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock, safety_stock, rack_location, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (warehouse_id, spare_part_id)
                DO UPDATE SET
                    qty_on_hand = EXCLUDED.qty_on_hand,
                    min_stock = EXCLUDED.min_stock,
                    max_stock = EXCLUDED.max_stock,
                    safety_stock = EXCLUDED.safety_stock,
                    rack_location = COALESCE(EXCLUDED.rack_location, inventory_stock.rack_location),
                    updated_at = NOW()
                "#,
                payload.warehouse_id,
                row.spare_part_id,
                row.qty_on_hand,
                min_s,
                max_s,
                safety_s,
                row.rack_location
            )
            .execute(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO stock_movements (warehouse_id, spare_part_id, movement_type, qty, balance_after, reference_number, notes, created_by)
                VALUES ($1, $2, 'INITIAL_IMPORT', $3, $3, 'IMPORT-MANUAL', 'Import saldo awal kontainer', $4)
                "#,
                payload.warehouse_id,
                row.spare_part_id,
                row.qty_on_hand,
                user_id
            )
            .execute(&mut *tx)
            .await?;

            count += 1;
        }

        tx.commit().await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(user_id),
                Some(username),
                "IMPORT_INITIAL_STOCK",
                "INVENTORY",
                Some(&payload.warehouse_id),
                Some(json!({ "warehouse_id": payload.warehouse_id, "items_count": count })),
            )
            .await;

        Ok(count)
    }

    pub async fn get_dashboard_summary(
        &self,
        warehouse_id: &str,
    ) -> Result<DashboardSummary, AppError> {
        let stock_stats = sqlx::query!(
            r#"
            SELECT
                COUNT(*)::bigint as total_parts,
                COUNT(CASE WHEN qty_on_hand <= min_stock THEN 1 END)::bigint as critical_count,
                COUNT(CASE WHEN qty_on_hand > min_stock AND qty_on_hand <= (min_stock * 1.25) THEN 1 END)::bigint as warning_count
            FROM inventory_stock
            WHERE warehouse_id = $1 AND deleted_at IS NULL
            "#,
            warehouse_id
        )
        .fetch_one(&self.pool)
        .await?;

        let today_issues = sqlx::query!(
            r#"
            SELECT
                COUNT(t.id)::bigint as tx_count,
                COALESCE(SUM(i.qty), 0) as total_qty
            FROM issue_transactions t
            LEFT JOIN issue_transaction_items i ON t.id = i.transaction_id
            WHERE t.warehouse_id = $1
              AND t.created_at >= CURRENT_DATE
              AND t.status = 'COMPLETED'
            "#,
            warehouse_id
        )
        .fetch_one(&self.pool)
        .await?;

        let pending_reqs = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::bigint
            FROM replenishment_requests
            WHERE container_warehouse_id = $1
              AND status IN ('REQUESTED', 'VERIFIED', 'RETURNED_TO_MAIN_ADMIN')
            "#,
            warehouse_id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let active_warehouses = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE AND deleted_at IS NULL"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        Ok(DashboardSummary {
            total_parts_monitored: stock_stats.total_parts.unwrap_or(0),
            total_critical_items: stock_stats.critical_count.unwrap_or(0),
            total_warning_items: stock_stats.warning_count.unwrap_or(0),
            today_issues_count: today_issues.tx_count.unwrap_or(0),
            today_items_released: today_issues.total_qty.unwrap_or(Decimal::ZERO),
            pending_requests_count: pending_reqs,
            active_warehouses_count: active_warehouses,
        })
    }
}
