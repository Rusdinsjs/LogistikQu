use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, check_warehouse_access, AuthUser},
    },
    domain::models::{CreateBinRequest, RelocateStockBinRequest, UpdateBinRequest, WarehouseBinItem},
    error::AppError,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn list_warehouse_bins(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(warehouse_id): Path<String>,
) -> Result<Json<Vec<WarehouseBinItem>>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let bins = sqlx::query_as!(
        WarehouseBinItem,
        r#"
        SELECT 
            b.id, b.warehouse_id, b.bin_code, b.zone, b.shelf_level, b.capacity_parts, b.description, b.is_active, b.created_at,
            COUNT(s.id) as current_items_count,
            COALESCE(SUM(s.qty_on_hand), 0) as total_qty,
            COALESCE(
                json_agg(
                    json_build_object(
                        'spare_part_id', s.spare_part_id,
                        'part_name', p.part_name,
                        'qty_on_hand', s.qty_on_hand,
                        'unit_of_measure', p.unit_of_measure,
                        'status', CASE 
                            WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                            WHEN s.qty_on_hand <= s.min_stock * 1.25 THEN 'WARNING'
                            ELSE 'NORMAL'
                        END
                    )
                ) FILTER (WHERE s.spare_part_id IS NOT NULL), '[]'::json
            ) as "parts!"
        FROM warehouse_bins b
        LEFT JOIN inventory_stock s ON s.warehouse_id = b.warehouse_id AND s.rack_location = b.bin_code
        LEFT JOIN spare_parts p ON s.spare_part_id = p.id
        WHERE b.warehouse_id = $1
        GROUP BY b.id
        ORDER BY b.zone, b.shelf_level, b.bin_code
        "#,
        warehouse_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(bins))
}

pub async fn create_warehouse_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(warehouse_id): Path<String>,
    Json(payload): Json<CreateBinRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "master.manage").await?;

    let bin_code = payload.bin_code.trim().to_uppercase();
    if bin_code.is_empty() {
        return Err(AppError::BadRequest("Kode bin wajib diisi".to_string()));
    }

    let zone = payload.zone.map(|z| z.trim().to_uppercase()).filter(|z| !z.is_empty()).unwrap_or_else(|| "BAY-LEFT".to_string());
    let shelf_level = payload.shelf_level.map(|l| l.trim().to_uppercase()).filter(|l| !l.is_empty()).unwrap_or_else(|| "LEVEL-1".to_string());
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
    .execute(&state.pool)
    .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'CREATE_BIN', 'WAREHOUSE_BIN', $3, $4)
        "#,
        user.sub,
        user.username,
        id.to_string(),
        json!({"warehouse_id": warehouse_id, "bin_code": bin_code, "zone": zone, "shelf_level": shelf_level})
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Bin {} berhasil ditambahkan di {}", bin_code, warehouse_id)
    })))
}

pub async fn update_warehouse_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, bin_id)): Path<(String, Uuid)>,
    Json(payload): Json<UpdateBinRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query!(
        "SELECT bin_code, zone, shelf_level, capacity_parts, description, is_active FROM warehouse_bins WHERE id = $1 AND warehouse_id = $2",
        bin_id,
        warehouse_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Bin ID '{}' tidak ditemukan di {}", bin_id, warehouse_id)))?;

    let new_bin_code = payload.bin_code.map(|c| c.trim().to_uppercase()).filter(|c| !c.is_empty()).unwrap_or(existing.bin_code.clone());
    let new_zone = payload.zone.map(|z| z.trim().to_uppercase()).filter(|z| !z.is_empty()).unwrap_or(existing.zone);
    let new_level = payload.shelf_level.map(|l| l.trim().to_uppercase()).filter(|l| !l.is_empty()).unwrap_or(existing.shelf_level);
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
    .execute(&state.pool)
    .await?;

    // If bin code changed, cascade update to inventory_stock
    if new_bin_code != existing.bin_code {
        sqlx::query!(
            "UPDATE inventory_stock SET rack_location = $1 WHERE warehouse_id = $2 AND rack_location = $3",
            new_bin_code,
            warehouse_id,
            existing.bin_code
        )
        .execute(&state.pool)
        .await?;
    }

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'UPDATE_BIN', 'WAREHOUSE_BIN', $3, $4)
        "#,
        user.sub,
        user.username,
        bin_id.to_string(),
        json!({"old_code": existing.bin_code, "new_code": new_bin_code, "is_active": new_active})
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Bin {} berhasil diperbarui", new_bin_code)
    })))
}

pub async fn delete_warehouse_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((warehouse_id, bin_id)): Path<(String, Uuid)>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query!(
        "SELECT bin_code FROM warehouse_bins WHERE id = $1 AND warehouse_id = $2",
        bin_id,
        warehouse_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Bin tidak ditemukan".to_string()))?;

    // Check if stock uses this bin
    let has_stock = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM inventory_stock WHERE warehouse_id = $1 AND rack_location = $2 AND qty_on_hand > 0)",
        warehouse_id,
        existing.bin_code
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(false);

    if has_stock {
        // Soft delete / nonaktifkan
        sqlx::query!("UPDATE warehouse_bins SET is_active = FALSE WHERE id = $1", bin_id)
            .execute(&state.pool)
            .await?;

        return Ok(Json(json!({
            "success": true,
            "is_soft_deleted": true,
            "message": format!("Bin {} masih berisi suku cadang, status dialihkan ke Non-Aktif", existing.bin_code)
        })));
    }

    sqlx::query!("DELETE FROM warehouse_bins WHERE id = $1", bin_id)
        .execute(&state.pool)
        .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'DELETE_BIN', 'WAREHOUSE_BIN', $3, $4)
        "#,
        user.sub,
        user.username,
        bin_id.to_string(),
        json!({"bin_code": existing.bin_code})
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "is_soft_deleted": false,
        "message": format!("Bin {} berhasil dihapus", existing.bin_code)
    })))
}

pub async fn relocate_stock_bin(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(warehouse_id): Path<String>,
    Json(payload): Json<RelocateStockBinRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let part_id = payload.spare_part_id.trim().to_uppercase();
    let target_bin = payload.target_bin_code.as_deref().map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty());

    // If target_bin provided, ensure it exists in warehouse_bins or insert as custom bin
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
        .execute(&state.pool)
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
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Suku cadang {} tidak ditemukan di {}", part_id, warehouse_id)))?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'RELOCATE_BIN', 'INVENTORY_STOCK', $3, $4)
        "#,
        user.sub,
        user.username,
        part_id,
        json!({
            "warehouse_id": warehouse_id,
            "target_bin": target_bin,
            "qty_on_hand": updated.qty_on_hand
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!(
            "Suku cadang {} berhasil dipindahkan ke lokasi bin: {}",
            part_id,
            target_bin.unwrap_or_else(|| "Tanpa Bin (Unassigned)".to_string())
        )
    })))
}
