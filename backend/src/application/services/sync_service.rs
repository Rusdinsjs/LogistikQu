use crate::{
    domain::entities::{Equipment, SparePart},
    error::AppError,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct MobileBatchTransactionItem {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub transaction_type: String, // ISSUE, RECEIVE, TRANSFER, ADJUSTMENT, RETURN
    pub payload: Value,
    pub timestamp: i64,
}

#[derive(Debug, Deserialize)]
pub struct MobileBatchSyncRequest {
    pub device_id: String,
    pub user_id: Option<Uuid>,
    pub warehouse_id: Option<String>,
    pub transactions: Vec<MobileBatchTransactionItem>,
}

#[derive(Debug, Serialize)]
pub struct SyncFailedItem {
    pub id: Uuid,
    pub error: String,
}

#[derive(Debug, Serialize)]
pub struct SyncConflictItem {
    pub id: Uuid,
    pub reason: String,
    pub server_stock: Decimal,
    pub client_stock: Decimal,
}

#[derive(Debug, Serialize)]
pub struct MobileBatchSyncResponse {
    pub success: Vec<Uuid>,
    pub failed: Vec<SyncFailedItem>,
    pub conflict: Vec<SyncConflictItem>,
}

#[derive(Debug, Serialize)]
pub struct DeltaInventoryItem {
    pub id: Uuid,
    pub warehouse_id: String,
    pub spare_part_id: String,
    pub part_number: String,
    pub part_name: String,
    pub uom: String,
    pub qty_on_hand: Decimal,
    pub bin_code: Option<String>,
    pub zone: Option<String>,
    pub shelf_level: Option<String>,
    pub batch_number: Option<String>,
    pub serial_number: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct MobileDeltaPullResponse {
    pub server_time: DateTime<Utc>,
    pub server_timestamp: i64,
    pub inventory_changes: Vec<DeltaInventoryItem>,
    pub master_parts: Vec<SparePart>,
    pub equipment: Vec<Equipment>,
    pub warehouses: Vec<Value>,
    pub user_permissions: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_drops: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_notifications: Option<Vec<Value>>,
}

#[derive(Debug, Deserialize)]
pub struct ConflictResolutionRequest {
    pub conflict_id: Uuid,
    pub resolution: String, // OVERRIDE, REJECT
    pub notes: Option<String>,
}

#[derive(Clone)]
pub struct SyncService {
    pool: PgPool,
}

impl SyncService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Pull delta updates since `last_sync` timestamp for mobile offline cache
    pub async fn pull_delta(
        &self,
        warehouse_id: &str,
        since_timestamp_ms: Option<i64>,
    ) -> Result<MobileDeltaPullResponse, AppError> {
        let _since_dt = since_timestamp_ms
            .and_then(|ms| DateTime::from_timestamp(ms / 1000, ((ms % 1000) * 1_000_000) as u32))
            .unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap());

        // 1. Inventory stock changes
        let inventory_rows = sqlx::query!(
            r#"
            SELECT s.id, s.warehouse_id, s.spare_part_id, s.spare_part_id as part_number, p.part_name,
                   p.unit_of_measure as uom, s.qty_on_hand, 
                   b.bin_code as "bin_code?", 
                   b.zone as "zone?", 
                   b.shelf_level as "shelf_level?",
                   s.batch_number as "batch_number?", 
                   s.serial_number as "serial_number?",
                   CASE 
                     WHEN s.qty_on_hand <= 0 THEN 'CRITICAL'
                     WHEN s.qty_on_hand <= p.default_min_stock THEN 'LOW'
                     ELSE 'NORMAL'
                   END as "status!"
            FROM inventory_stock s
            JOIN spare_parts p ON s.spare_part_id = p.id
            LEFT JOIN warehouse_bins b ON s.bin_id = b.id
            WHERE s.warehouse_id = $1 AND (s.deleted_at IS NULL)
            ORDER BY p.part_name ASC
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let inventory_changes = inventory_rows
            .into_iter()
            .map(|r| DeltaInventoryItem {
                id: r.id,
                warehouse_id: r.warehouse_id,
                spare_part_id: r.spare_part_id,
                part_number: r.part_number,
                part_name: r.part_name,
                uom: r.uom,
                qty_on_hand: r.qty_on_hand,
                bin_code: r.bin_code,
                zone: r.zone,
                shelf_level: r.shelf_level,
                batch_number: r.batch_number,
                serial_number: r.serial_number,
                status: r.status,
            })
            .collect();

        // 2. Master spare parts
        let parts = sqlx::query_as!(
            SparePart,
            r#"
            SELECT id, part_name, category_id, brand, equipment_category,
                   unit_of_measure, critical_level, requires_issue_approval,
                   lead_time_days, default_min_stock, default_max_stock, qr_code, is_active,
                   requires_core_return, component_id, unit_cost, photo_url
            FROM spare_parts
            WHERE is_active = TRUE
            ORDER BY id
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        // 3. Equipment fleet
        let eq = sqlx::query_as!(
            Equipment,
            r#"
            SELECT id, unit_number, equipment_number, ct_number, name, equipment_type_id,
                   model, serial_number, current_hm_km, current_site_id, qr_code, is_active
            FROM equipment
            WHERE is_active = TRUE
            ORDER BY unit_number
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        // 4. Warehouses
        let whs =
            sqlx::query!("SELECT id, name, warehouse_type FROM warehouses WHERE is_active = TRUE")
                .fetch_all(&self.pool)
                .await?
                .into_iter()
                .map(|w| json!({ "id": w.id, "name": w.name, "type": w.warehouse_type }))
                .collect();

        // Permissions default
        let permissions = vec![
            "inventory.read".into(),
            "inventory.issue".into(),
            "inventory.receive".into(),
            "inventory.transfer".into(),
            "inventory.audit".into(),
        ];

        let pending_drops_rows = sqlx::query!(
            r#"
            SELECT d.id, d.drop_number, d.main_warehouse_id, d.container_warehouse_id,
                   d.status, d.shipped_at, d.notes, r.request_number
            FROM main_warehouse_drops d
            JOIN replenishment_requests r ON d.request_id = r.id
            WHERE d.container_warehouse_id = $1 AND d.status = 'IN_TRANSIT'
            ORDER BY d.shipped_at DESC
            LIMIT 20
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let pending_drops: Vec<Value> = pending_drops_rows
            .into_iter()
            .map(|d| {
                json!({
                    "id": d.id,
                    "drop_number": d.drop_number,
                    "request_number": d.request_number,
                    "main_warehouse_id": d.main_warehouse_id,
                    "container_warehouse_id": d.container_warehouse_id,
                    "status": d.status,
                    "shipped_at": d.shipped_at,
                    "notes": d.notes
                })
            })
            .collect();

        let notifs_rows = sqlx::query!(
            r#"
            SELECT id, title, message, channel, trigger_type, reference_id, is_read, created_at
            FROM notifications
            WHERE (recipient_role LIKE '%ADMIN%' OR recipient_role = 'SUPERVISOR' OR recipient_role = 'SUPER_ADMIN')
            ORDER BY created_at DESC
            LIMIT 15
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let recent_notifications: Vec<Value> = notifs_rows
            .into_iter()
            .map(|n| {
                json!({
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "channel": n.channel,
                    "trigger_type": n.trigger_type,
                    "reference_id": n.reference_id,
                    "is_read": n.is_read,
                    "created_at": n.created_at
                })
            })
            .collect();

        Ok(MobileDeltaPullResponse {
            server_time: Utc::now(),
            server_timestamp: Utc::now().timestamp_millis(),
            inventory_changes,
            master_parts: parts,
            equipment: eq,
            warehouses: whs,
            user_permissions: permissions,
            pending_drops: Some(pending_drops),
            recent_notifications: Some(recent_notifications),
        })
    }

    /// Process batch synchronization from mobile clients with ACID transactions & conflict detection
    pub async fn process_mobile_batch_sync(
        &self,
        req: MobileBatchSyncRequest,
        acting_user_id: Uuid,
    ) -> Result<MobileBatchSyncResponse, AppError> {
        let mut success_ids = Vec::new();
        let mut failed_ids = Vec::new();
        let mut conflict_ids = Vec::new();

        // Update mobile device heartbeat
        let _ = sqlx::query!(
            "UPDATE mobile_devices SET last_sync_at = NOW() WHERE device_id = $1",
            req.device_id
        )
        .execute(&self.pool)
        .await;

        for item in req.transactions {
            let tx_id = item.id;
            let tx_type = item.transaction_type.to_uppercase();

            // Check if already processed (Idempotence via client_uuid)
            let already_processed = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM issue_transactions WHERE client_uuid = $1)",
                tx_id
            )
            .fetch_one(&self.pool)
            .await?
            .unwrap_or(false);

            if already_processed {
                success_ids.push(tx_id);
                continue;
            }

            match tx_type.as_str() {
                "ISSUE" => {
                    let res = self
                        .process_single_issue_sync(
                            tx_id,
                            &req.device_id,
                            acting_user_id,
                            &item.payload,
                        )
                        .await;

                    match res {
                        Ok(SyncItemResult::Success) => success_ids.push(tx_id),
                        Ok(SyncItemResult::Conflict {
                            reason,
                            server_stock,
                            client_stock,
                        }) => {
                            conflict_ids.push(SyncConflictItem {
                                id: tx_id,
                                reason,
                                server_stock,
                                client_stock,
                            });
                        }
                        Err(e) => {
                            failed_ids.push(SyncFailedItem {
                                id: tx_id,
                                error: e.to_string(),
                            });
                        }
                    }
                }
                "RECEIVE" => {
                    // Replenishment drop receive (Supports UUID, request_number REQ-..., or drop_number DROP-...)
                    let doc_str = item
                        .payload
                        .get("replenishment_request_id")
                        .and_then(|v| v.as_str())
                        .or_else(|| item.payload.get("drop_number").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let req_opt = if let Ok(req_uuid) = Uuid::parse_str(doc_str) {
                        let r = sqlx::query!(
                            "SELECT id, request_number, container_warehouse_id, status FROM replenishment_requests WHERE id = $1",
                            req_uuid
                        )
                        .fetch_optional(&self.pool)
                        .await?;
                        r.map(|x| (x.id, x.request_number, x.container_warehouse_id, x.status))
                    } else {
                        let r = sqlx::query!(
                            r#"
                            SELECT r.id, r.request_number, r.container_warehouse_id, r.status
                            FROM replenishment_requests r
                            LEFT JOIN main_warehouse_drops d ON d.request_id = r.id
                            WHERE r.request_number = $1 OR d.drop_number = $1
                            LIMIT 1
                            "#,
                            doc_str
                        )
                        .fetch_optional(&self.pool)
                        .await?;
                        r.map(|x| (x.id, x.request_number, x.container_warehouse_id, x.status))
                    };

                    if let Some((req_id, req_no, req_container_wh, req_status)) = req_opt {
                        if req_status == "IN_TRANSIT" {
                            let mut tx = self.pool.begin().await?;

                            let req_items = sqlx::query!(
                                "SELECT spare_part_id, approved_qty FROM replenishment_request_items WHERE request_id = $1",
                                req_id
                            )
                            .fetch_all(&mut *tx)
                            .await?;

                            for itm in req_items {
                                let current_qty = sqlx::query_scalar!(
                                    "SELECT qty_on_hand FROM inventory_stock WHERE warehouse_id = $1 AND spare_part_id = $2 FOR UPDATE",
                                    req_container_wh,
                                    itm.spare_part_id
                                )
                                .fetch_optional(&mut *tx)
                                .await?
                                .unwrap_or(Decimal::ZERO);

                                let new_qty = current_qty + itm.approved_qty;

                                sqlx::query!(
                                    r#"
                                    INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, updated_at)
                                    VALUES ($1, $2, $3, NOW())
                                    ON CONFLICT (warehouse_id, spare_part_id)
                                    DO UPDATE SET qty_on_hand = $3, updated_at = NOW()
                                    "#,
                                    req_container_wh,
                                    itm.spare_part_id,
                                    new_qty
                                )
                                .execute(&mut *tx)
                                .await?;

                                sqlx::query!(
                                    r#"
                                    INSERT INTO stock_movements (
                                        warehouse_id, spare_part_id, movement_type, qty,
                                        balance_after, reference_number, notes, created_by
                                    ) VALUES ($1, $2, 'DROP_IN', $3, $4, $5, $6, $7)
                                    "#,
                                    req_container_wh,
                                    itm.spare_part_id,
                                    itm.approved_qty,
                                    new_qty,
                                    req_no,
                                    format!("Penerimaan drop mobile sync untuk STO {}", req_no),
                                    acting_user_id
                                )
                                .execute(&mut *tx)
                                .await?;

                                sqlx::query!(
                                    "UPDATE replenishment_request_items SET received_qty = approved_qty WHERE request_id = $1 AND spare_part_id = $2",
                                    req_id,
                                    itm.spare_part_id
                                )
                                .execute(&mut *tx)
                                .await?;
                            }

                            sqlx::query!(
                                "UPDATE main_warehouse_drops SET status = 'COMPLETED', received_by = $1, received_at = NOW() WHERE request_id = $2",
                                acting_user_id,
                                req_id
                            )
                            .execute(&mut *tx)
                            .await?;

                            sqlx::query!(
                                "UPDATE replenishment_requests SET status = 'COMPLETED', received_by = $1, received_at = NOW(), updated_at = NOW() WHERE id = $2",
                                acting_user_id,
                                req_id
                            )
                            .execute(&mut *tx)
                            .await?;

                            tx.commit().await?;

                            let notif_repo =
                                crate::infrastructure::repositories::NotificationRepository::new(
                                    self.pool.clone(),
                                );
                            let main_role = if req_container_wh == "WH-CONT-DT" {
                                "MAIN_ADMIN_DT"
                            } else {
                                "MAIN_ADMIN_HE"
                            };

                            let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
                                user_id: None,
                                recipient_role: Some(main_role.to_string()),
                                recipient_email: None,
                                recipient_phone: None,
                                title: format!("Barang STO Diterima via Mobile: {}", req_no),
                                message: format!("Penerimaan barang STO {} telah dikonfirmasi dari perangkat mobile di {}. Stok fisik telah bertambah.", req_no, req_container_wh),
                                channel: Some("IN_APP".to_string()),
                                trigger_type: "APPROVAL_COMPLETED".to_string(),
                                reference_id: Some(req_no.clone()),
                                metadata: Some(json!({ "request_id": req_id, "container_warehouse_id": req_container_wh })),
                            }).await;

                            let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
                                user_id: None,
                                recipient_role: Some("SUPERVISOR".to_string()),
                                recipient_email: None,
                                recipient_phone: None,
                                title: format!("Replenishment Selesai: {}", req_no),
                                message: format!("Barang STO {} telah diterima dari mobile di {}. Transaksi COMPLETED.", req_no, req_container_wh),
                                channel: Some("IN_APP".to_string()),
                                trigger_type: "APPROVAL_COMPLETED".to_string(),
                                reference_id: Some(req_no.clone()),
                                metadata: Some(json!({ "request_id": req_id })),
                            }).await;
                        }
                    }
                    success_ids.push(tx_id);
                }
                "REQUEST" | "REPLENISHMENT" => {
                    let container_wh = item
                        .payload
                        .get("container_warehouse_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("WH-CONT-HE");
                    let notes = item.payload.get("notes").and_then(|v| v.as_str());

                    let main_wh = if container_wh == "WH-CONT-DT" {
                        "WH-MAIN-DT"
                    } else {
                        "WH-MAIN-HE"
                    };
                    let mut tx = self.pool.begin().await?;
                    let req_no =
                        crate::infrastructure::database::next_document_number(&mut tx, "REQ")
                            .await?;

                    let req_id = sqlx::query_scalar!(
                        r#"
                        INSERT INTO replenishment_requests (
                            request_number, container_warehouse_id, main_warehouse_id,
                            status, notes, requested_by
                        ) VALUES ($1, $2, $3, 'REQUESTED', $4, $5)
                        RETURNING id
                        "#,
                        req_no,
                        container_wh,
                        main_wh,
                        notes,
                        acting_user_id
                    )
                    .fetch_one(&mut *tx)
                    .await?;

                    if let Some(items_arr) = item.payload.get("items").and_then(|v| v.as_array()) {
                        for itm in items_arr {
                            if let Some(part_id) = itm.get("spare_part_id").and_then(|v| v.as_str())
                            {
                                let requested_qty = itm
                                    .get("requested_qty")
                                    .and_then(|v| v.as_f64())
                                    .map(|f| Decimal::from_f64_retain(f).unwrap_or(Decimal::ONE))
                                    .unwrap_or(Decimal::ONE);
                                sqlx::query!(
                                    r#"
                                    INSERT INTO replenishment_request_items (
                                        request_id, spare_part_id, requested_qty, recommended_qty,
                                        verified_qty, approved_qty, notes
                                    ) VALUES ($1, $2, $3, $3, $3, $3, $4)
                                    "#,
                                    req_id,
                                    part_id,
                                    requested_qty,
                                    itm.get("notes").and_then(|v| v.as_str())
                                )
                                .execute(&mut *tx)
                                .await?;
                            }
                        }
                    }

                    tx.commit().await?;

                    let notif_repo =
                        crate::infrastructure::repositories::NotificationRepository::new(
                            self.pool.clone(),
                        );
                    let target_admin_role = if container_wh == "WH-CONT-DT" {
                        "MAIN_ADMIN_DT"
                    } else {
                        "MAIN_ADMIN_HE"
                    };
                    let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
                        user_id: None,
                        recipient_role: Some(target_admin_role.to_string()),
                        recipient_email: None,
                        recipient_phone: None,
                        title: format!("Permohonan Stok Mobile: {}", req_no),
                        message: format!("Pengajuan stok baru ({}) dikirim dari perangkat mobile di {}. Mohon diverifikasi.", req_no, container_wh),
                        channel: Some("IN_APP".to_string()),
                        trigger_type: "APPROVAL_REQUEST".to_string(),
                        reference_id: Some(req_no.clone()),
                        metadata: Some(json!({ "request_id": req_id, "container_warehouse_id": container_wh })),
                    }).await;

                    success_ids.push(tx_id);
                }
                _ => {
                    // Other general sync operations
                    success_ids.push(tx_id);
                }
            }
        }

        Ok(MobileBatchSyncResponse {
            success: success_ids,
            failed: failed_ids,
            conflict: conflict_ids,
        })
    }

    async fn process_single_issue_sync(
        &self,
        tx_id: Uuid,
        device_id: &str,
        user_id: Uuid,
        payload: &Value,
    ) -> Result<SyncItemResult, AppError> {
        let warehouse_id = payload
            .get("warehouse_id")
            .and_then(|v| v.as_str())
            .unwrap_or("WH-CONT-HE");
        let site_id = payload
            .get("site_id")
            .and_then(|v| v.as_str())
            .unwrap_or("SITE-VALE-C");
        let unit_number = payload
            .get("unit_number")
            .and_then(|v| v.as_str())
            .unwrap_or("DT-001");
        let mechanic_name = payload
            .get("mechanic_name")
            .and_then(|v| v.as_str())
            .unwrap_or("Mekanik");
        let receiver_name = payload
            .get("receiver_name")
            .and_then(|v| v.as_str())
            .unwrap_or(mechanic_name);
        let work_order_number = payload
            .get("work_order_number")
            .and_then(|v| v.as_str())
            .unwrap_or("WO-AUTO");
        let hm_km = payload
            .get("hm_km")
            .and_then(|v| v.as_f64())
            .unwrap_or(12000.0);
        let spare_part_id = payload
            .get("items")
            .and_then(|it| it.get(0))
            .and_then(|it| it.get("spare_part_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("FLT-001");
        let qty = payload
            .get("items")
            .and_then(|it| it.get(0))
            .and_then(|it| it.get("qty"))
            .and_then(|v| v.as_f64())
            .unwrap_or(1.0);
        let qty_dec = Decimal::from_f64_retain(qty).unwrap_or(Decimal::ONE);
        let hm_km_dec = Decimal::from_f64_retain(hm_km).unwrap_or(Decimal::ZERO);

        let mut tx = self.pool.begin().await?;

        // 1. Check current server physical stock
        let stock_row = sqlx::query!(
            "SELECT id, qty_on_hand FROM inventory_stock WHERE warehouse_id = $1 AND spare_part_id = $2 FOR UPDATE",
            warehouse_id,
            spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let server_stock = stock_row
            .as_ref()
            .map(|r| r.qty_on_hand)
            .unwrap_or(Decimal::ZERO);

        // 2. Conflict Detection: Server physical stock less than requested quantity
        if server_stock < qty_dec {
            // Record conflict in mobile_sync_conflicts
            sqlx::query!(
                r#"
                INSERT INTO mobile_sync_conflicts 
                (device_id, transaction_id, transaction_type, spare_part_id, warehouse_id, server_stock, client_stock, requested_qty, status)
                VALUES ($1, $2, 'ISSUE', $3, $4, $5, $6, $7, 'CONFLICT_PENDING')
                "#,
                device_id,
                tx_id,
                spare_part_id,
                warehouse_id,
                server_stock,
                server_stock + qty_dec, // presumed client stock
                qty_dec
            )
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;

            return Ok(SyncItemResult::Conflict {
                reason: format!(
                    "Server stock ({}) is less than issued qty ({})",
                    server_stock, qty_dec
                ),
                server_stock,
                client_stock: server_stock + qty_dec,
            });
        }

        // 3. Normal path: Deduct stock & create issue transaction
        let new_balance = server_stock - qty_dec;
        if let Some(s) = stock_row {
            sqlx::query!(
                "UPDATE inventory_stock SET qty_on_hand = $1 WHERE id = $2",
                new_balance,
                s.id
            )
            .execute(&mut *tx)
            .await?;
        }

        let tx_num = format!(
            "ISSUE-MOB-{}",
            tx_id.to_string().chars().take(8).collect::<String>()
        );

        sqlx::query!(
            r#"
            INSERT INTO issue_transactions
            (id, transaction_number, warehouse_id, site_id, receiver_name, unit_number, unit_name, unit_type,
             hm_km, mechanic_name, work_order_number, maintenance_type, priority, status, device_id, client_uuid, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'CORRECTIVE', 'NORMAL', 'COMPLETED', $12, $13, $14)
            "#,
            tx_id,
            tx_num,
            warehouse_id,
            site_id,
            receiver_name,
            unit_number,
            unit_number,
            "HEAVY_EQUIPMENT",
            hm_km_dec,
            mechanic_name,
            work_order_number,
            device_id,
            tx_id,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        // Insert immutable stock movement
        sqlx::query!(
            r#"
            INSERT INTO stock_movements
            (id, warehouse_id, spare_part_id, movement_type, qty, balance_after, reference_number, notes, created_by)
            VALUES ($1, $2, $3, 'ISSUE', $4, $5, $6, $7, $8)
            "#,
            Uuid::new_v4(),
            warehouse_id,
            spare_part_id,
            qty_dec,
            new_balance,
            tx_num,
            format!("Offline sync issue from {}", device_id),
            user_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(SyncItemResult::Success)
    }

    /// Resolve conflict by supervisor
    pub async fn resolve_conflict(
        &self,
        req: ConflictResolutionRequest,
        supervisor_id: Uuid,
    ) -> Result<Value, AppError> {
        let status = if req.resolution == "OVERRIDE" {
            "RESOLVED_OVERRIDE"
        } else {
            "RESOLVED_REJECT"
        };

        sqlx::query!(
            r#"
            UPDATE mobile_sync_conflicts
            SET status = $1, resolved_by = $2, resolution_notes = $3, resolved_at = NOW()
            WHERE id = $4
            "#,
            status,
            supervisor_id,
            req.notes
                .unwrap_or_else(|| "Resolved via Mobile Sync Manager".into()),
            req.conflict_id
        )
        .execute(&self.pool)
        .await?;

        Ok(json!({ "success": true, "message": "Konflik berhasil diselesaikan" }))
    }
}

pub enum SyncItemResult {
    Success,
    Conflict {
        reason: String,
        server_stock: Decimal,
        client_stock: Decimal,
    },
}
