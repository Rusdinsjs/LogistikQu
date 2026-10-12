use crate::{
    domain::entities::{
        CreateBinRequest, RelocateStockBinRequest, UpdateBinRequest, WarehouseBinItem,
    },
    error::AppError,
    infrastructure::repositories::{AuditRepository, BinRepository},
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct BinService {
    pool: PgPool,
    bin_repo: BinRepository,
    audit_repo: AuditRepository,
}

impl BinService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            bin_repo: BinRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn list_bins(&self, warehouse_id: &str) -> Result<Vec<WarehouseBinItem>, AppError> {
        self.bin_repo.list_bins(warehouse_id).await
    }

    pub async fn create_bin(
        &self,
        user_id: Uuid,
        username: &str,
        warehouse_id: &str,
        payload: CreateBinRequest,
    ) -> Result<Value, AppError> {
        let bin_code = payload.bin_code.trim().to_uppercase();
        if bin_code.is_empty() {
            return Err(AppError::BadRequest("Kode bin wajib diisi".to_string()));
        }

        let zone = payload
            .zone
            .map(|z| z.trim().to_uppercase())
            .filter(|z| !z.is_empty())
            .unwrap_or_else(|| "BAY-LEFT".to_string());
        let shelf_level = payload
            .shelf_level
            .map(|l| l.trim().to_uppercase())
            .filter(|l| !l.is_empty())
            .unwrap_or_else(|| "LEVEL-1".to_string());
        let capacity = payload.capacity_parts.unwrap_or(10);
        let id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO warehouse_bins (id, warehouse_id, bin_code, zone, shelf_level, capacity_parts, description, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            ON CONFLICT (warehouse_id, bin_code) DO UPDATE SET
                zone = EXCLUDED.zone,
                shelf_level = EXCLUDED.shelf_level,
                capacity_parts = EXCLUDED.capacity_parts,
                description = EXCLUDED.description,
                is_active = TRUE
            "#,
            id,
            warehouse_id,
            bin_code,
            zone,
            shelf_level,
            capacity,
            payload.description
        )
        .execute(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(user_id),
                Some(username),
                "CREATE_BIN",
                "WAREHOUSE_BIN",
                Some(&id.to_string()),
                Some(json!({
                    "warehouse_id": warehouse_id,
                    "bin_code": bin_code,
                    "zone": zone,
                    "shelf_level": shelf_level
                })),
            )
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Bin {} berhasil ditambahkan di {}", bin_code, warehouse_id)
        }))
    }

    pub async fn update_bin(
        &self,
        user_id: Uuid,
        username: &str,
        warehouse_id: &str,
        bin_id: Uuid,
        payload: UpdateBinRequest,
    ) -> Result<Value, AppError> {
        let existing = sqlx::query!(
            "SELECT bin_code, zone, shelf_level, capacity_parts, description, is_active FROM warehouse_bins WHERE id = $1 AND warehouse_id = $2",
            bin_id,
            warehouse_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Bin ID '{}' tidak ditemukan di {}", bin_id, warehouse_id)))?;

        let new_bin_code = payload
            .bin_code
            .map(|c| c.trim().to_uppercase())
            .filter(|c| !c.is_empty())
            .unwrap_or(existing.bin_code.clone());
        let new_zone = payload
            .zone
            .map(|z| z.trim().to_uppercase())
            .filter(|z| !z.is_empty())
            .unwrap_or(existing.zone);
        let new_level = payload
            .shelf_level
            .map(|l| l.trim().to_uppercase())
            .filter(|l| !l.is_empty())
            .unwrap_or(existing.shelf_level);
        let new_capacity = payload.capacity_parts.unwrap_or(existing.capacity_parts);
        let new_desc = payload.description.or(existing.description);
        let new_active = payload.is_active.unwrap_or(existing.is_active);

        sqlx::query!(
            r#"
            UPDATE warehouse_bins
            SET bin_code = $1, zone = $2, shelf_level = $3, capacity_parts = $4, description = $5, is_active = $6
            WHERE id = $7
            "#,
            new_bin_code,
            new_zone,
            new_level,
            new_capacity,
            new_desc,
            new_active,
            bin_id
        )
        .execute(&self.pool)
        .await?;

        if new_bin_code != existing.bin_code {
            sqlx::query!(
                "UPDATE inventory_stock SET rack_location = $1 WHERE warehouse_id = $2 AND rack_location = $3",
                new_bin_code,
                warehouse_id,
                existing.bin_code
            )
            .execute(&self.pool)
            .await?;
        }

        let _ = self.audit_repo.record_log(
            Some(user_id),
            Some(username),
            "UPDATE_BIN",
            "WAREHOUSE_BIN",
            Some(&bin_id.to_string()),
            Some(json!({ "old_code": existing.bin_code, "new_code": new_bin_code, "is_active": new_active })),
        ).await;

        Ok(json!({
            "success": true,
            "message": format!("Bin {} berhasil diperbarui", new_bin_code)
        }))
    }

    pub async fn delete_bin(
        &self,
        user_id: Uuid,
        username: &str,
        warehouse_id: &str,
        bin_id: Uuid,
    ) -> Result<Value, AppError> {
        let existing = sqlx::query!(
            "SELECT bin_code FROM warehouse_bins WHERE id = $1 AND warehouse_id = $2",
            bin_id,
            warehouse_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Bin tidak ditemukan".to_string()))?;

        let has_stock = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM inventory_stock WHERE warehouse_id = $1 AND rack_location = $2 AND qty_on_hand > 0)",
            warehouse_id,
            existing.bin_code
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);

        if has_stock {
            sqlx::query!(
                "UPDATE warehouse_bins SET is_active = FALSE WHERE id = $1",
                bin_id
            )
            .execute(&self.pool)
            .await?;

            return Ok(json!({
                "success": true,
                "is_soft_deleted": true,
                "message": format!("Bin {} masih berisi suku cadang, status dialihkan ke Non-Aktif", existing.bin_code)
            }));
        }

        sqlx::query!("DELETE FROM warehouse_bins WHERE id = $1", bin_id)
            .execute(&self.pool)
            .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(user_id),
                Some(username),
                "DELETE_BIN",
                "WAREHOUSE_BIN",
                Some(&bin_id.to_string()),
                Some(json!({ "bin_code": existing.bin_code })),
            )
            .await;

        Ok(json!({
            "success": true,
            "is_soft_deleted": false,
            "message": format!("Bin {} berhasil dihapus", existing.bin_code)
        }))
    }

    pub async fn relocate_stock_bin(
        &self,
        user_id: Uuid,
        username: &str,
        warehouse_id: &str,
        payload: RelocateStockBinRequest,
    ) -> Result<Value, AppError> {
        let part_id = payload.spare_part_id.trim().to_uppercase();
        let target_bin = payload
            .target_bin_code
            .as_deref()
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty());

        if let Some(ref tb) = target_bin {
            let _ = sqlx::query!(
                r#"
                INSERT INTO warehouse_bins (warehouse_id, bin_code, zone, shelf_level, capacity_parts)
                VALUES ($1, $2, 'BAY-GENERAL', 'LEVEL-1', 10)
                ON CONFLICT (warehouse_id, bin_code) DO NOTHING
                "#,
                warehouse_id,
                tb
            )
            .execute(&self.pool)
            .await;
        }

        let updated = sqlx::query!(
            r#"
            UPDATE inventory_stock
            SET rack_location = $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND spare_part_id = $3
            RETURNING qty_on_hand, rack_location
            "#,
            target_bin,
            warehouse_id,
            part_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Suku cadang {} tidak ditemukan di {}",
                part_id, warehouse_id
            ))
        })?;

        let _ = self
            .audit_repo
            .record_log(
                Some(user_id),
                Some(username),
                "RELOCATE_BIN",
                "INVENTORY_STOCK",
                Some(&part_id),
                Some(json!({
                    "warehouse_id": warehouse_id,
                    "target_bin": target_bin,
                    "qty_on_hand": updated.qty_on_hand
                })),
            )
            .await;

        Ok(json!({
            "success": true,
            "message": format!(
                "Suku cadang {} berhasil dipindahkan ke lokasi bin: {}",
                part_id,
                target_bin.unwrap_or_else(|| "Tanpa Bin (Unassigned)".to_string())
            )
        }))
    }
}
