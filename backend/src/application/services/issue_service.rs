use crate::{
    application::validators::IssueValidator,
    domain::entities::{Claims, CreateIssueRequest, IssueTransaction},
    error::AppError,
    infrastructure::{
        database::next_document_number,
        repositories::{AuditRepository, IssueRepository},
    },
};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct IssueService {
    pool: PgPool,
    issue_repo: IssueRepository,
    #[allow(dead_code)]
    audit_repo: AuditRepository,
}

pub struct CreateIssueResult {
    pub duplicate_warning: bool,
    pub response_value: Value,
}

impl IssueService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            issue_repo: IssueRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn create_issue(
        &self,
        claims: &Claims,
        payload: CreateIssueRequest,
        force_submit: bool,
    ) -> Result<CreateIssueResult, AppError> {
        IssueValidator::validate(&payload)?;

        // 1. Validasi 30-Menit Duplicate Issue Prevention
        if !force_submit {
            let part_ids: Vec<String> = payload
                .items
                .iter()
                .map(|i| i.spare_part_id.clone())
                .collect();
            let recent = self
                .issue_repo
                .check_recent_duplicate(&payload.unit_number, &part_ids)
                .await?;

            if let Some(dup) = recent {
                return Ok(CreateIssueResult {
                    duplicate_warning: true,
                    response_value: json!({
                        "duplicate_warning": true,
                        "message": format!(
                            "Peringatan: Unit {} baru saja mengambil spare part {} pada {} (No: {}). Lanjutkan transaksi?",
                            payload.unit_number, dup.spare_part_id, dup.created_at.format("%H:%M"), dup.transaction_number
                        )
                    }),
                });
            }
        }

        let mut tx = self.pool.begin().await?;

        // Generate atomic document number
        let transaction_no = next_document_number(&mut tx, "ISS").await?;

        // 2. Check if any item requires supervisor approval
        let mut requires_approval = false;
        for item in &payload.items {
            let is_crit = sqlx::query_scalar!(
                r#"SELECT requires_issue_approval FROM spare_parts WHERE id = $1"#,
                item.spare_part_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(false);

            if is_crit {
                requires_approval = true;
                break;
            }
        }

        let status = if requires_approval {
            "PENDING_APPROVAL"
        } else {
            "COMPLETED"
        };

        let priority = payload.priority.unwrap_or_else(|| "NORMAL".to_string());

        // Insert issue header
        let issue_id = sqlx::query_scalar!(
            r#"
            INSERT INTO issue_transactions (
                transaction_number, warehouse_id, site_id, receiver_name,
                receiver_employee_id, receiver_department, unit_number, unit_name,
                unit_type, ct_number, serial_number, hm_km, mechanic_name,
                mechanic_id, work_order_number, maintenance_type, priority,
                status, notes, latitude, longitude, device_id, client_uuid,
                evidence_photo_url, document_url, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
            )
            RETURNING id
            "#,
            transaction_no,
            payload.warehouse_id,
            payload.site_id,
            payload.receiver_name,
            payload.receiver_employee_id,
            payload.receiver_department,
            payload.unit_number,
            payload.unit_name,
            payload.unit_type,
            payload.ct_number,
            payload.serial_number,
            payload.hm_km,
            payload.mechanic_name,
            payload.mechanic_id,
            payload.work_order_number,
            payload.maintenance_type,
            priority,
            status,
            payload.notes,
            payload.latitude,
            payload.longitude,
            payload.device_id,
            payload.client_uuid,
            payload.evidence_photo_url,
            payload.document_url,
            claims.sub
        )
        .fetch_one(&mut *tx)
        .await?;

        // 3. Process items and deduct stock if COMPLETED
        for item in &payload.items {
            sqlx::query!(
                r#"
                INSERT INTO issue_transaction_items (transaction_id, spare_part_id, qty, unit_of_measure)
                VALUES ($1, $2, $3, $4)
                "#,
                issue_id,
                item.spare_part_id,
                item.qty,
                item.unit_of_measure
            )
            .execute(&mut *tx)
            .await?;

            let requires_core_return = sqlx::query_scalar!(
                "SELECT requires_core_return FROM spare_parts WHERE id = $1",
                item.spare_part_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(false);

            if requires_core_return {
                let return_no = next_document_number(&mut tx, "RET").await?;
                sqlx::query!(
                    r#"
                    INSERT INTO used_part_returns (
                        return_number, issue_transaction_id, spare_part_id, qty, unit_of_measure,
                        unit_number, mechanic_name, mechanic_id, warehouse_id,
                        status, current_holder_type, current_holder_name
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_RETURN', 'MECHANIC', $10)
                    "#,
                    return_no,
                    issue_id,
                    item.spare_part_id,
                    item.qty,
                    item.unit_of_measure,
                    payload.unit_number,
                    payload.mechanic_name,
                    payload.mechanic_id,
                    payload.warehouse_id,
                    payload.mechanic_name
                )
                .execute(&mut *tx)
                .await?;
            }

            if status == "COMPLETED" {
                let current_qty = sqlx::query_scalar!(
                    r#"
                    SELECT qty_on_hand FROM inventory_stock
                    WHERE warehouse_id = $1 AND spare_part_id = $2
                    FOR UPDATE
                    "#,
                    payload.warehouse_id,
                    item.spare_part_id
                )
                .fetch_optional(&mut *tx)
                .await?
                .unwrap_or(Decimal::ZERO);

                if current_qty < item.qty {
                    return Err(AppError::BadRequest(format!(
                        "Stok spare part {} di {} tidak mencukupi (Tersedia: {}, Diminta: {})",
                        item.spare_part_id, payload.warehouse_id, current_qty, item.qty
                    )));
                }

                let new_qty = current_qty - item.qty;

                sqlx::query!(
                    r#"
                    UPDATE inventory_stock
                    SET qty_on_hand = $1, updated_at = NOW()
                    WHERE warehouse_id = $2 AND spare_part_id = $3
                    "#,
                    new_qty,
                    payload.warehouse_id,
                    item.spare_part_id
                )
                .execute(&mut *tx)
                .await?;

                sqlx::query!(
                    r#"
                    INSERT INTO stock_movements (
                        warehouse_id, spare_part_id, movement_type, qty,
                        balance_after, reference_number, notes, created_by
                    ) VALUES (
                        $1, $2, 'ISSUE_OUT', $3, $4, $5, $6, $7
                    )
                    "#,
                    payload.warehouse_id,
                    item.spare_part_id,
                    item.qty,
                    new_qty,
                    transaction_no,
                    format!(
                        "Pengeluaran untuk unit {} (Mekanik: {})",
                        payload.unit_number, payload.mechanic_name
                    ),
                    claims.sub
                )
                .execute(&mut *tx)
                .await?;
            }
        }

        sqlx::query!(
            r#"
            INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
            VALUES ($1, $2, 'CREATE_ISSUE', 'ISSUE_TRANSACTION', $3, $4)
            "#,
            claims.sub,
            claims.username,
            transaction_no,
            json!({
                "status": status,
                "unit_number": payload.unit_number,
                "mechanic": payload.mechanic_name,
                "items_count": payload.items.len()
            })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let msg = if status == "PENDING_APPROVAL" {
            "Transaksi berhasil dibuat dan menunggu persetujuan Supervisor (terdapat komponen kritikal)"
        } else {
            "Transaksi berhasil diselesaikan dan stok langsung terpotong"
        };

        Ok(CreateIssueResult {
            duplicate_warning: false,
            response_value: json!({
                "success": true,
                "issue_id": issue_id,
                "transaction_number": transaction_no,
                "status": status,
                "message": msg
            }),
        })
    }

    pub async fn list_issues(
        &self,
        warehouse_id: &str,
        search: &str,
        status: &str,
    ) -> Result<Vec<IssueTransaction>, AppError> {
        let search_pattern = format!("%{}%", search);

        let items = sqlx::query_as!(
            IssueTransaction,
            r#"
            SELECT id, transaction_number, warehouse_id, site_id, receiver_name,
                   receiver_employee_id, receiver_department, unit_number, unit_name,
                   unit_type, ct_number, serial_number, hm_km, mechanic_name,
                   mechanic_id, work_order_number, maintenance_type, priority,
                   status, notes, evidence_photo_url, document_url, created_by, approved_by, created_at
            FROM issue_transactions
            WHERE warehouse_id = $1
              AND ($2 = '' OR transaction_number ILIKE $3 OR unit_number ILIKE $3 OR mechanic_name ILIKE $3)
              AND ($4 = '' OR status = $4)
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            warehouse_id,
            search,
            search_pattern,
            status
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn get_issue_detail(&self, id: Uuid) -> Result<Value, AppError> {
        let tx_record = self.issue_repo.get_issue_by_id(id).await?.ok_or_else(|| {
            AppError::NotFound("Bukti transaksi pengeluaran tidak ditemukan".to_string())
        })?;

        let items = self.issue_repo.get_issue_items(id).await?;

        Ok(json!({
            "transaction": tx_record,
            "items": items
        }))
    }

    pub async fn approve_critical_issue(
        &self,
        claims: &Claims,
        id: Uuid,
    ) -> Result<Value, AppError> {
        let mut tx = self.pool.begin().await?;

        let issue = sqlx::query!(
            r#"
            SELECT id, transaction_number, warehouse_id, unit_number, mechanic_name, mechanic_id, status
            FROM issue_transactions
            WHERE id = $1
            FOR UPDATE
            "#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Transaksi tidak ditemukan".to_string()))?;

        if issue.status != "PENDING_APPROVAL" {
            return Err(AppError::BadRequest(
                "Transaksi tidak dalam status menunggu approval".to_string(),
            ));
        }

        let items = sqlx::query!(
            r#"
            SELECT spare_part_id, qty, unit_of_measure FROM issue_transaction_items
            WHERE transaction_id = $1
            "#,
            id
        )
        .fetch_all(&mut *tx)
        .await?;

        for itm in &items {
            let current_qty = sqlx::query_scalar!(
                r#"
                SELECT qty_on_hand FROM inventory_stock
                WHERE warehouse_id = $1 AND spare_part_id = $2
                FOR UPDATE
                "#,
                issue.warehouse_id,
                itm.spare_part_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(Decimal::ZERO);

            if current_qty < itm.qty {
                return Err(AppError::BadRequest(format!(
                    "Stok part {} tidak mencukupi saat approval (tersedia: {})",
                    itm.spare_part_id, current_qty
                )));
            }

            let new_qty = current_qty - itm.qty;
            sqlx::query!(
                r#"
                UPDATE inventory_stock
                SET qty_on_hand = $1, updated_at = NOW()
                WHERE warehouse_id = $2 AND spare_part_id = $3
                "#,
                new_qty,
                issue.warehouse_id,
                itm.spare_part_id
            )
            .execute(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO stock_movements (
                    warehouse_id, spare_part_id, movement_type, qty,
                    balance_after, reference_number, notes, created_by
                ) VALUES ($1, $2, 'ISSUE_OUT', $3, $4, $5, $6, $7)
                "#,
                issue.warehouse_id,
                itm.spare_part_id,
                itm.qty,
                new_qty,
                issue.transaction_number,
                format!("Approved by Supervisor for unit {}", issue.unit_number),
                claims.sub
            )
            .execute(&mut *tx)
            .await?;

            let requires_core_return = sqlx::query_scalar!(
                "SELECT requires_core_return FROM spare_parts WHERE id = $1",
                itm.spare_part_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(false);

            if requires_core_return {
                let exists = sqlx::query_scalar!(
                    "SELECT EXISTS(SELECT 1 FROM used_part_returns WHERE issue_transaction_id = $1 AND spare_part_id = $2)",
                    id,
                    itm.spare_part_id
                )
                .fetch_one(&mut *tx)
                .await?
                .unwrap_or(false);

                if !exists {
                    let return_no = next_document_number(&mut tx, "RET").await?;
                    sqlx::query!(
                        r#"
                        INSERT INTO used_part_returns (
                            return_number, issue_transaction_id, spare_part_id, qty, unit_of_measure,
                            unit_number, mechanic_name, mechanic_id, warehouse_id,
                            status, current_holder_type, current_holder_name
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_RETURN', 'MECHANIC', $10)
                        "#,
                        return_no,
                        id,
                        itm.spare_part_id,
                        itm.qty,
                        itm.unit_of_measure,
                        issue.unit_number,
                        issue.mechanic_name,
                        issue.mechanic_id,
                        issue.warehouse_id,
                        issue.mechanic_name
                    )
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }

        sqlx::query!(
            r#"
            UPDATE issue_transactions
            SET status = 'COMPLETED', approved_by = $1
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
            "message": format!("Transaksi {} berhasil disetujui dan stok dipotong", issue.transaction_number)
        }))
    }
}
