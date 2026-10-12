use crate::{
    domain::entities::{
        DashboardSummary, InventoryStockItem, LedgerQuery, PaginatedResponse, StockMovement,
        StockTransferRequest, StockWriteOffRequest,
    },
    domain::value_objects::StockMovementType,
    error::AppError,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct InventoryRepository {
    pool: PgPool,
}

impl InventoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_stock(
        &self,
        warehouse_id: &str,
        search: &str,
    ) -> Result<Vec<InventoryStockItem>, AppError> {
        let search_pattern = format!("%{}%", search);

        let rows = sqlx::query!(
            r#"
            SELECT s.id, s.warehouse_id, w.name as warehouse_name,
                   s.spare_part_id, p.part_name, pc.name as "category_name?",
                   p.brand, p.unit_of_measure, s.qty_on_hand, s.min_stock,
                   s.max_stock, s.safety_stock, s.rack_location,
                   p.critical_level, p.requires_issue_approval, p.requires_core_return, s.updated_at,
                   COALESCE(s.photo_url, p.photo_url) as "photo_url?",
                   COALESCE(p.qr_code, CONCAT('QR-PART-', s.spare_part_id)) as "qr_code?",
                   p.unit_cost as "unit_cost?",
                   CASE
                       WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                       WHEN s.qty_on_hand <= (s.min_stock * 1.25) THEN 'WARNING'
                       ELSE 'NORMAL'
                   END as status
            FROM inventory_stock s
            INNER JOIN warehouses w ON s.warehouse_id = w.id
            INNER JOIN spare_parts p ON s.spare_part_id = p.id
            LEFT JOIN part_categories pc ON p.category_id = pc.id
            WHERE (
                  s.warehouse_id = $1
                  OR s.warehouse_id IN (
                      SELECT sub_warehouse_id FROM warehouse_supply_links WHERE main_warehouse_id = $1
                  )
                  OR s.warehouse_id IN (
                      SELECT id FROM warehouses WHERE parent_warehouse_id = $1
                  )
              )
              AND s.deleted_at IS NULL
              AND w.deleted_at IS NULL
              AND p.deleted_at IS NULL
              AND ($2 = '' OR s.spare_part_id ILIKE $3 OR p.part_name ILIKE $3)
            ORDER BY
                CASE
                    WHEN s.qty_on_hand <= s.min_stock THEN 1
                    WHEN s.qty_on_hand <= (s.min_stock * 1.25) THEN 2
                    ELSE 3
                END,
                s.spare_part_id
            "#,
            warehouse_id,
            search,
            search_pattern
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| InventoryStockItem {
                id: r.id,
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                spare_part_id: r.spare_part_id,
                part_name: r.part_name,
                category_name: r.category_name,
                brand: r.brand,
                unit_of_measure: r.unit_of_measure,
                qty_on_hand: r.qty_on_hand,
                min_stock: r.min_stock,
                max_stock: r.max_stock,
                safety_stock: r.safety_stock,
                rack_location: r.rack_location,
                critical_level: r.critical_level,
                requires_issue_approval: r.requires_issue_approval,
                requires_core_return: r.requires_core_return,
                status: r.status.unwrap_or_else(|| "NORMAL".to_string()),
                updated_at: r.updated_at,
                photo_url: r.photo_url,
                qr_code: r.qr_code,
                unit_cost: r.unit_cost,
            })
            .collect();

        Ok(items)
    }

    pub async fn get_stock_item(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
    ) -> Result<Option<InventoryStockItem>, AppError> {
        let row = sqlx::query!(
            r#"
            SELECT s.id, s.warehouse_id, w.name as warehouse_name,
                   s.spare_part_id, p.part_name, pc.name as "category_name?",
                   p.brand, p.unit_of_measure, s.qty_on_hand, s.min_stock,
                   s.max_stock, s.safety_stock, s.rack_location,
                   p.critical_level, p.requires_issue_approval, p.requires_core_return, s.updated_at,
                   COALESCE(s.photo_url, p.photo_url) as "photo_url?",
                   COALESCE(p.qr_code, CONCAT('QR-PART-', s.spare_part_id)) as "qr_code?",
                   p.unit_cost as "unit_cost?",
                   CASE
                       WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                       WHEN s.qty_on_hand <= (s.min_stock * 1.25) THEN 'WARNING'
                       ELSE 'NORMAL'
                   END as status
            FROM inventory_stock s
            INNER JOIN warehouses w ON s.warehouse_id = w.id
            INNER JOIN spare_parts p ON s.spare_part_id = p.id
            LEFT JOIN part_categories pc ON p.category_id = pc.id
            WHERE s.warehouse_id = $1
              AND s.spare_part_id = $2
              AND s.deleted_at IS NULL
              AND w.deleted_at IS NULL
              AND p.deleted_at IS NULL
            "#,
            warehouse_id,
            spare_part_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| InventoryStockItem {
            id: r.id,
            warehouse_id: r.warehouse_id,
            warehouse_name: r.warehouse_name,
            spare_part_id: r.spare_part_id,
            part_name: r.part_name,
            category_name: r.category_name,
            brand: r.brand,
            unit_of_measure: r.unit_of_measure,
            qty_on_hand: r.qty_on_hand,
            min_stock: r.min_stock,
            max_stock: r.max_stock,
            safety_stock: r.safety_stock,
            rack_location: r.rack_location,
            critical_level: r.critical_level,
            requires_issue_approval: r.requires_issue_approval,
            requires_core_return: r.requires_core_return,
            status: r.status.unwrap_or_else(|| "NORMAL".to_string()),
            updated_at: r.updated_at,
            photo_url: r.photo_url,
            qr_code: r.qr_code,
            unit_cost: r.unit_cost,
        }))
    }

    pub async fn update_stock_photo(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
        photo_url: Option<&str>,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE inventory_stock
            SET photo_url = $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND spare_part_id = $3
            "#,
            photo_url,
            warehouse_id,
            spare_part_id
        )
        .execute(&self.pool)
        .await?;

        sqlx::query!(
            r#"
            UPDATE spare_parts
            SET photo_url = $1
            WHERE id = $2
            "#,
            photo_url,
            spare_part_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_movements(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
    ) -> Result<Vec<StockMovement>, AppError> {
        let movements = sqlx::query_as!(
            StockMovement,
            r#"
            SELECT id, warehouse_id, spare_part_id, movement_type,
                   qty, balance_after, reference_number, notes,
                   batch_number, serial_number, bin_id, created_at
            FROM stock_movements
            WHERE warehouse_id = $1 AND spare_part_id = $2
            ORDER BY created_at DESC
            LIMIT 50
            "#,
            warehouse_id,
            spare_part_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(movements)
    }

    pub async fn query_ledger_paginated(
        &self,
        query: LedgerQuery,
    ) -> Result<PaginatedResponse<StockMovement>, AppError> {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * limit;

        let total = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM stock_movements
            WHERE ($1::text IS NULL OR warehouse_id = $1)
              AND ($2::text IS NULL OR spare_part_id = $2)
              AND ($3::text IS NULL OR movement_type = $3)
              AND ($4::text IS NULL OR batch_number = $4)
              AND ($5::text IS NULL OR serial_number = $5)
            "#,
            query.warehouse_id,
            query.spare_part_id,
            query.movement_type,
            query.batch_number,
            query.serial_number
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let data = sqlx::query_as!(
            StockMovement,
            r#"
            SELECT id, warehouse_id, spare_part_id, movement_type,
                   qty, balance_after, reference_number, notes,
                   batch_number, serial_number, bin_id, created_at
            FROM stock_movements
            WHERE ($1::text IS NULL OR warehouse_id = $1)
              AND ($2::text IS NULL OR spare_part_id = $2)
              AND ($3::text IS NULL OR movement_type = $3)
              AND ($4::text IS NULL OR batch_number = $4)
              AND ($5::text IS NULL OR serial_number = $5)
            ORDER BY created_at DESC
            LIMIT $6 OFFSET $7
            "#,
            query.warehouse_id,
            query.spare_part_id,
            query.movement_type,
            query.batch_number,
            query.serial_number,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(PaginatedResponse::new(data, total, page, limit))
    }

    pub async fn transfer_stock_tx(
        &self,
        req: StockTransferRequest,
        doc_no: &str,
        user_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        if req.qty <= Decimal::ZERO {
            return Err(AppError::BadRequest(
                "Jumlah transfer harus lebih dari 0".into(),
            ));
        }

        if req.from_warehouse_id == req.to_warehouse_id {
            return Err(AppError::BadRequest(
                "Gudang asal dan tujuan tidak boleh sama".into(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        // 1. Lock and check source warehouse stock
        let source_row = sqlx::query!(
            r#"
            SELECT qty_on_hand FROM inventory_stock
            WHERE warehouse_id = $1 AND spare_part_id = $2 AND deleted_at IS NULL
            FOR UPDATE
            "#,
            req.from_warehouse_id,
            req.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let source_qty = match source_row {
            Some(r) => r.qty_on_hand,
            None => {
                tx.rollback().await?;
                return Err(AppError::BadRequest(format!(
                    "Part '{}' tidak tersedia pada gudang '{}'",
                    req.spare_part_id, req.from_warehouse_id
                )));
            }
        };

        if source_qty < req.qty {
            tx.rollback().await?;
            return Err(AppError::BadRequest(format!(
                "Stok fisik tidak mencukupi. Tersedia: {}, Diminta transfer: {}",
                source_qty, req.qty
            )));
        }

        let new_source_bal = source_qty - req.qty;

        // Deduct from source warehouse
        sqlx::query!(
            r#"
            UPDATE inventory_stock
            SET qty_on_hand = $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND spare_part_id = $3
            "#,
            new_source_bal,
            req.from_warehouse_id,
            req.spare_part_id
        )
        .execute(&mut *tx)
        .await?;

        let notes_out = format!(
            "Transfer OUT ke {} - {}",
            req.to_warehouse_id,
            req.notes.as_deref().unwrap_or("Pengiriman antar gudang")
        );

        // Record immutable ledger: TRANSFER OUT
        sqlx::query!(
            r#"
            INSERT INTO stock_movements (
                warehouse_id, spare_part_id, movement_type, qty, balance_after,
                reference_number, notes, batch_number, serial_number, bin_id, created_by
            )
            VALUES ($1, $2, 'TRANSFER', $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
            req.from_warehouse_id,
            req.spare_part_id,
            -req.qty,
            new_source_bal,
            doc_no,
            notes_out,
            req.batch_number,
            req.serial_number,
            req.from_bin_id,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        // 2. Upsert into target warehouse stock
        let target_row = sqlx::query!(
            r#"
            INSERT INTO inventory_stock (
                warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock, safety_stock, updated_at
            )
            VALUES ($1, $2, $3, 10, 100, 5, NOW())
            ON CONFLICT (warehouse_id, spare_part_id)
            DO UPDATE SET qty_on_hand = inventory_stock.qty_on_hand + EXCLUDED.qty_on_hand, updated_at = NOW()
            RETURNING qty_on_hand
            "#,
            req.to_warehouse_id,
            req.spare_part_id,
            req.qty
        )
        .fetch_one(&mut *tx)
        .await?;

        let notes_in = format!(
            "Transfer IN dari {} - {}",
            req.from_warehouse_id,
            req.notes.as_deref().unwrap_or("Penerimaan antar gudang")
        );

        // Record immutable ledger: TRANSFER IN
        sqlx::query!(
            r#"
            INSERT INTO stock_movements (
                warehouse_id, spare_part_id, movement_type, qty, balance_after,
                reference_number, notes, batch_number, serial_number, bin_id, created_by
            )
            VALUES ($1, $2, 'TRANSFER', $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
            req.to_warehouse_id,
            req.spare_part_id,
            req.qty,
            target_row.qty_on_hand,
            doc_no,
            notes_in,
            req.batch_number,
            req.serial_number,
            req.to_bin_id,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    pub async fn write_off_stock_tx(
        &self,
        req: StockWriteOffRequest,
        doc_no: &str,
        user_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let mtype = StockMovementType::from_str(&req.movement_type).ok_or_else(|| {
            AppError::BadRequest(format!(
                "Tipe mutasi '{}' tidak valid. Gunakan 'DAMAGE' atau 'LOST'",
                req.movement_type
            ))
        })?;

        if !matches!(mtype, StockMovementType::Damage | StockMovementType::Lost) {
            return Err(AppError::BadRequest(
                "Write-off hanya menerima tipe 'DAMAGE' atau 'LOST'".into(),
            ));
        }

        if req.qty <= Decimal::ZERO {
            return Err(AppError::BadRequest(
                "Jumlah write-off harus lebih dari 0".into(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        let source_row = sqlx::query!(
            r#"
            SELECT qty_on_hand FROM inventory_stock
            WHERE warehouse_id = $1 AND spare_part_id = $2 AND deleted_at IS NULL
            FOR UPDATE
            "#,
            req.warehouse_id,
            req.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let source_qty = match source_row {
            Some(r) => r.qty_on_hand,
            None => {
                tx.rollback().await?;
                return Err(AppError::BadRequest(format!(
                    "Part '{}' tidak ditemukan di gudang '{}'",
                    req.spare_part_id, req.warehouse_id
                )));
            }
        };

        if source_qty < req.qty {
            tx.rollback().await?;
            return Err(AppError::BadRequest(format!(
                "Stok fisik tidak mencukupi untuk write-off. Tersedia: {}, Write-off: {}",
                source_qty, req.qty
            )));
        }

        let new_bal = source_qty - req.qty;

        sqlx::query!(
            r#"
            UPDATE inventory_stock
            SET qty_on_hand = $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND spare_part_id = $3
            "#,
            new_bal,
            req.warehouse_id,
            req.spare_part_id
        )
        .execute(&mut *tx)
        .await?;

        let movement_str = mtype.as_str();

        sqlx::query!(
            r#"
            INSERT INTO stock_movements (
                warehouse_id, spare_part_id, movement_type, qty, balance_after,
                reference_number, notes, batch_number, serial_number, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
            req.warehouse_id,
            req.spare_part_id,
            movement_str,
            -req.qty,
            new_bal,
            doc_no,
            req.notes,
            req.batch_number,
            req.serial_number,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_dashboard_summary(&self) -> Result<DashboardSummary, AppError> {
        let total_parts = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM spare_parts WHERE is_active = TRUE AND deleted_at IS NULL"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let total_critical = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM inventory_stock WHERE qty_on_hand <= min_stock AND deleted_at IS NULL"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let total_warning = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM inventory_stock WHERE qty_on_hand > min_stock AND qty_on_hand <= (min_stock * 1.25) AND deleted_at IS NULL"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let today_issues = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM issue_transactions WHERE created_at >= CURRENT_DATE"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let today_released = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(i.qty), 0)
            FROM issue_transaction_items i
            JOIN issue_transactions t ON i.transaction_id = t.id
            WHERE t.created_at >= CURRENT_DATE AND t.status = 'COMPLETED'
            "#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(Decimal::ZERO);

        let pending_reqs = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM replenishment_requests WHERE status IN ('REQUESTED', 'VERIFIED')"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let active_wh = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE AND deleted_at IS NULL"#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        Ok(DashboardSummary {
            total_parts_monitored: total_parts,
            total_critical_items: total_critical,
            total_warning_items: total_warning,
            today_issues_count: today_issues,
            today_items_released: today_released,
            pending_requests_count: pending_reqs,
            active_warehouses_count: active_wh,
        })
    }
}
