use crate::{
    application::validators::ReplenishmentValidator,
    domain::{
        business_rules::ReplenishmentRules,
        entities::{
            ApproveReplenishmentRequest, Claims, CreateReplenishmentRequest, RecommendationItem,
            RejectReplenishmentRequest, ReplenishmentIntelligenceItem, ReplenishmentRequest,
            VerifyReplenishmentRequest,
        },
    },
    error::AppError,
    infrastructure::{
        database::next_document_number,
        repositories::{AuditRepository, ReplenishmentRepository},
    },
};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ReplenishmentService {
    pool: PgPool,
    replenishment_repo: ReplenishmentRepository,
    audit_repo: AuditRepository,
}

impl ReplenishmentService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            replenishment_repo: ReplenishmentRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn get_recommendations(
        &self,
        warehouse_id: &str,
    ) -> Result<Vec<RecommendationItem>, AppError> {
        self.replenishment_repo
            .get_recommendations(warehouse_id)
            .await
    }

    pub async fn get_replenishment_intelligence(
        &self,
        warehouse_id: &str,
    ) -> Result<Vec<ReplenishmentIntelligenceItem>, AppError> {
        self.replenishment_repo
            .get_replenishment_intelligence(warehouse_id)
            .await
    }

    pub async fn create_request(
        &self,
        claims: &Claims,
        payload: CreateReplenishmentRequest,
    ) -> Result<Value, AppError> {
        ReplenishmentValidator::validate(&payload)?;

        let main_wh = if payload.container_warehouse_id == "WH-CONT-DT" {
            "WH-MAIN-DT"
        } else {
            "WH-MAIN-HE"
        };

        let mut tx = self.pool.begin().await?;
        let req_no = next_document_number(&mut tx, "REQ").await?;

        let req_id = sqlx::query_scalar!(
            r#"
            INSERT INTO replenishment_requests (
                request_number, container_warehouse_id, main_warehouse_id,
                status, notes, requested_by
            ) VALUES ($1, $2, $3, 'REQUESTED', $4, $5)
            RETURNING id
            "#,
            req_no,
            payload.container_warehouse_id,
            main_wh,
            payload.notes,
            claims.sub
        )
        .fetch_one(&mut *tx)
        .await?;

        let item_count = payload.items.len();
        for item in payload.items {
            let rec = item.recommended_qty.unwrap_or(Decimal::ZERO);
            sqlx::query!(
                r#"
                INSERT INTO replenishment_request_items (
                    request_id, spare_part_id, requested_qty, recommended_qty,
                    verified_qty, approved_qty, notes
                ) VALUES ($1, $2, $3, $4, $3, $3, $5)
                "#,
                req_id,
                item.spare_part_id,
                item.requested_qty,
                rec,
                item.notes
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
                "CREATE_REPLENISHMENT_REQUEST",
                "REPLENISHMENT_REQUEST",
                Some(&req_no),
                Some(json!({
                    "container_warehouse_id": payload.container_warehouse_id,
                    "main_warehouse_id": main_wh
                })),
            )
            .await;

        let notif_repo =
            crate::infrastructure::repositories::NotificationRepository::new(self.pool.clone());
        let target_admin_role = if payload.container_warehouse_id == "WH-CONT-DT" {
            "MAIN_ADMIN_DT"
        } else {
            "MAIN_ADMIN_HE"
        };

        // 1. Notify Main Warehouse Admin
        let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
            user_id: None,
            recipient_role: Some(target_admin_role.to_string()),
            recipient_email: None,
            recipient_phone: None,
            title: format!("Permohonan Stok Masuk: {}", req_no),
            message: format!("Gudang {} mengajukan permohonan pengadaan stok ({}) sebanyak {} item. Mohon lakukan verifikasi ketersediaan barang.", payload.container_warehouse_id, req_no, item_count),
            channel: Some("IN_APP".to_string()),
            trigger_type: "APPROVAL_REQUEST".to_string(),
            reference_id: Some(req_no.clone()),
            metadata: Some(json!({
                "request_id": req_id,
                "request_number": req_no,
                "container_warehouse_id": payload.container_warehouse_id,
                "main_warehouse_id": main_wh,
                "item_count": item_count
            })),
        }).await;

        // 2. Notify Super Admin
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: None,
                recipient_role: Some("SUPER_ADMIN".to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Permohonan Stok Baru: {}", req_no),
                message: format!(
                    "Permohonan stok baru {} diajukan dari {} menuju {}.",
                    req_no, payload.container_warehouse_id, main_wh
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "APPROVAL_REQUEST".to_string(),
                reference_id: Some(req_no.clone()),
                metadata: Some(json!({ "request_id": req_id })),
            })
            .await;

        Ok(json!({
            "success": true,
            "request_id": req_id,
            "request_number": req_no,
            "status": "REQUESTED",
            "message": "Permohonan pengadaan stok berhasil diajukan ke Gudang Utama"
        }))
    }

    pub async fn list_requests(
        &self,
        wh_filter: &str,
        status_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<ReplenishmentRequest>, AppError> {
        let items = sqlx::query_as!(
            ReplenishmentRequest,
            r#"
            SELECT id, request_number, container_warehouse_id, main_warehouse_id,
                   status, notes, admin_notes, supervisor_notes, requested_by,
                   verified_by, verified_at, approved_by, approved_at,
                   shipped_by, shipped_at, received_by, received_at,
                   created_at, updated_at
            FROM replenishment_requests
            WHERE ($1 = '' OR container_warehouse_id = $1 OR main_warehouse_id = $1)
              AND (container_warehouse_id = ANY($2) OR main_warehouse_id = ANY($2))
              AND ($3 = '' OR status = $3)
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            wh_filter,
            &user_whs[..],
            status_filter
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn get_request_detail(&self, id: Uuid) -> Result<Value, AppError> {
        let req = self
            .replenishment_repo
            .get_request_by_id(id)
            .await?
            .ok_or_else(|| {
                AppError::NotFound("Permohonan replenishment tidak ditemukan".to_string())
            })?;

        let items = self.replenishment_repo.get_request_items(id).await?;
        let drop = self.replenishment_repo.get_drop_by_request_id(id).await?;

        Ok(json!({
            "request": req,
            "items": items,
            "drop": drop
        }))
    }

    pub async fn verify_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: VerifyReplenishmentRequest,
    ) -> Result<Value, AppError> {
        let mut tx = self.pool.begin().await?;

        let req = sqlx::query!(
            r#"
            SELECT id, status, request_number, main_warehouse_id, container_warehouse_id, requested_by
            FROM replenishment_requests
            WHERE id = $1 FOR UPDATE
            "#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        ReplenishmentRules::validate_transition(&req.status, "VERIFIED")?;

        for item in payload.items {
            sqlx::query!(
                r#"
                UPDATE replenishment_request_items
                SET verified_qty = $1, approved_qty = $1, notes = COALESCE($2, notes)
                WHERE request_id = $3 AND spare_part_id = $4
                "#,
                item.verified_qty,
                item.notes,
                id,
                item.spare_part_id
            )
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query!(
            r#"
            UPDATE replenishment_requests
            SET status = 'VERIFIED', admin_notes = $1, verified_by = $2,
                verified_at = NOW(), updated_at = NOW()
            WHERE id = $3
            "#,
            payload.admin_notes,
            claims.sub,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let notif_repo =
            crate::infrastructure::repositories::NotificationRepository::new(self.pool.clone());
        let container_role = if req.container_warehouse_id == "WH-CONT-DT" {
            "CONTAINER_ADMIN_DT"
        } else {
            "CONTAINER_ADMIN_HE"
        };

        // 1. Notify Supervisor (Role: SUPERVISOR) - IN_APP
        let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
            user_id: None,
            recipient_role: Some("SUPERVISOR".to_string()),
            recipient_email: None,
            recipient_phone: Some("+628114000003".to_string()),
            title: format!("Approval Diperlukan: Permohonan {}", req.request_number),
            message: format!("Permohonan pengadaan stok {} telah diverifikasi Admin Gudang Utama dan siap disetujui Supervisor.", req.request_number),
            channel: Some("IN_APP".to_string()),
            trigger_type: "APPROVAL_REQUEST".to_string(),
            reference_id: Some(req.request_number.clone()),
            metadata: Some(json!({ "request_id": id, "main_warehouse_id": req.main_warehouse_id, "container_warehouse_id": req.container_warehouse_id })),
        }).await;

        // 2. WhatsApp Multi-Channel alert for Supervisor
        let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
            user_id: None,
            recipient_role: Some("SUPERVISOR".to_string()),
            recipient_email: None,
            recipient_phone: Some("+628114000003".to_string()),
            title: format!("Approval Diperlukan: Permohonan {}", req.request_number),
            message: format!("Permohonan pengadaan stok {} telah diverifikasi dan siap disetujui Supervisor.", req.request_number),
            channel: Some("WHATSAPP".to_string()),
            trigger_type: "APPROVAL_REQUEST".to_string(),
            reference_id: Some(req.request_number.clone()),
            metadata: Some(json!({ "request_id": id, "main_warehouse_id": req.main_warehouse_id })),
        }).await;

        // 3. Notify Container Admin
        let _ = notif_repo.create_notification(&crate::domain::entities::CreateNotificationRequest {
            user_id: Some(req.requested_by),
            recipient_role: Some(container_role.to_string()),
            recipient_email: None,
            recipient_phone: None,
            title: format!("Permohonan Diverifikasi: {}", req.request_number),
            message: format!("Permohonan {} telah diverifikasi oleh Admin Gudang Utama dan saat ini sedang menunggu persetujuan Supervisor.", req.request_number),
            channel: Some("IN_APP".to_string()),
            trigger_type: "APPROVAL_REQUEST".to_string(),
            reference_id: Some(req.request_number.clone()),
            metadata: Some(json!({ "request_id": id, "status": "VERIFIED" })),
        }).await;

        Ok(json!({
            "success": true,
            "message": format!("Permohonan {} berhasil diverifikasi dan diteruskan ke Supervisor", req.request_number)
        }))
    }

    pub async fn approve_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: ApproveReplenishmentRequest,
    ) -> Result<Value, AppError> {
        let mut tx = self.pool.begin().await?;

        let req = sqlx::query!(
            r#"
            SELECT id, request_number, main_warehouse_id, container_warehouse_id, status
            FROM replenishment_requests
            WHERE id = $1 FOR UPDATE
            "#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if req.status != "VERIFIED" {
            return Err(AppError::BadRequest(
                "Permohonan harus berstatus VERIFIED sebelum disetujui".to_string(),
            ));
        }

        sqlx::query!(
            r#"
            UPDATE replenishment_requests
            SET status = 'APPROVED', supervisor_notes = $1, approved_by = $2,
                approved_at = NOW(), updated_at = NOW()
            WHERE id = $3
            "#,
            payload.supervisor_notes,
            claims.sub,
            id
        )
        .execute(&mut *tx)
        .await?;

        let drop_no = next_document_number(&mut tx, "DROP").await?;
        let drop_id = sqlx::query_scalar!(
            r#"
            INSERT INTO main_warehouse_drops (
                drop_number, request_id, main_warehouse_id,
                container_warehouse_id, status, dropped_by, shipped_at, notes
            ) VALUES ($1, $2, $3, $4, 'IN_TRANSIT', $5, NOW(), $6)
            RETURNING id
            "#,
            drop_no,
            id,
            req.main_warehouse_id,
            req.container_warehouse_id,
            claims.sub,
            format!("Penerbitan STO atas permohonan {}", req.request_number)
        )
        .fetch_one(&mut *tx)
        .await?;

        let items = sqlx::query!(
            r#"
            SELECT spare_part_id, approved_qty
            FROM replenishment_request_items
            WHERE request_id = $1
            "#,
            id
        )
        .fetch_all(&mut *tx)
        .await?;

        for itm in items {
            let uom = sqlx::query_scalar!(
                "SELECT unit_of_measure FROM spare_parts WHERE id = $1",
                itm.spare_part_id
            )
            .fetch_one(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO main_warehouse_drop_items (drop_id, spare_part_id, qty, unit_of_measure)
                VALUES ($1, $2, $3, $4)
                "#,
                drop_id,
                itm.spare_part_id,
                itm.approved_qty,
                uom
            )
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query!(
            r#"
            UPDATE replenishment_requests
            SET status = 'IN_TRANSIT', shipped_by = $1, shipped_at = NOW(), updated_at = NOW()
            WHERE id = $2
            "#,
            claims.sub,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let notif_repo =
            crate::infrastructure::repositories::NotificationRepository::new(self.pool.clone());
        let container_role = if req.container_warehouse_id == "WH-CONT-DT" {
            "CONTAINER_ADMIN_DT"
        } else {
            "CONTAINER_ADMIN_HE"
        };
        let main_role = if req.main_warehouse_id == "WH-MAIN-DT" {
            "MAIN_ADMIN_DT"
        } else {
            "MAIN_ADMIN_HE"
        };

        // 1. Notify Container Admin (IN_APP)
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: None,
                recipient_role: Some(container_role.to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Permohonan Disetujui: {}", req.request_number),
                message: format!(
                    "Permohonan {} disetujui Supervisor. Surat Jalan Drop STO ({}) telah diterbitkan dan barang dalam pengiriman.",
                    req.request_number, drop_no
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "APPROVAL_COMPLETED".to_string(),
                reference_id: Some(drop_no.clone()),
                metadata: Some(
                    json!({ "request_number": req.request_number, "drop_number": drop_no }),
                ),
            })
            .await;

        // 2. Notify Main Warehouse Admin (IN_APP)
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: None,
                recipient_role: Some(main_role.to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("STO Disetujui & Diterbitkan: {}", drop_no),
                message: format!(
                    "Permohonan {} disetujui Supervisor. Silakan kirimkan fisik barang STO ({}) ke {}.",
                    req.request_number, drop_no, req.container_warehouse_id
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "APPROVAL_COMPLETED".to_string(),
                reference_id: Some(drop_no.clone()),
                metadata: Some(
                    json!({ "request_number": req.request_number, "drop_number": drop_no }),
                ),
            })
            .await;

        Ok(json!({
            "success": true,
            "drop_number": drop_no,
            "message": format!("Permohonan disetujui Supervisor dan dokumen Drop STO ({}) otomatis diterbitkan", drop_no)
        }))
    }

    pub async fn supervisor_reject(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: RejectReplenishmentRequest,
    ) -> Result<Value, AppError> {
        let req = sqlx::query!(
            "SELECT request_number, main_warehouse_id, container_warehouse_id, requested_by, status FROM replenishment_requests WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if req.status != "VERIFIED" {
            return Err(AppError::BadRequest(
                "Permohonan tidak dapat ditolak (bukan berstatus VERIFIED)".to_string(),
            ));
        }

        sqlx::query!(
            r#"
            UPDATE replenishment_requests
            SET status = 'RETURNED_TO_MAIN_ADMIN', supervisor_notes = $1, updated_at = NOW()
            WHERE id = $2
            "#,
            payload.reason,
            id
        )
        .execute(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "SUPERVISOR_REJECT",
                "REPLENISHMENT_REQUEST",
                Some(&req.request_number),
                Some(json!({ "reason": payload.reason })),
            )
            .await;

        let main_role = if req.main_warehouse_id == "WH-MAIN-DT" {
            "MAIN_ADMIN_DT"
        } else {
            "MAIN_ADMIN_HE"
        };
        let container_role = if req.container_warehouse_id == "WH-CONT-DT" {
            "CONTAINER_ADMIN_DT"
        } else {
            "CONTAINER_ADMIN_HE"
        };

        let notif_repo =
            crate::infrastructure::repositories::NotificationRepository::new(self.pool.clone());
        // 1. Notify Main Admin
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: None,
                recipient_role: Some(main_role.to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Permohonan Ditolak Spv: {}", req.request_number),
                message: format!(
                    "Permohonan {} ditolak oleh Supervisor: {}. Mohon lakukan penyesuaian kuota/alasan.",
                    req.request_number, payload.reason
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "REJECTED_TRANSACTION".to_string(),
                reference_id: Some(req.request_number.clone()),
                metadata: Some(json!({ "reason": payload.reason })),
            })
            .await;

        // 2. Notify Container Admin
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: Some(req.requested_by),
                recipient_role: Some(container_role.to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Status Permohonan: {}", req.request_number),
                message: format!(
                    "Permohonan {} dikembalikan oleh Supervisor ke Admin Gudang Utama untuk revisi: {}.",
                    req.request_number, payload.reason
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "REJECTED_TRANSACTION".to_string(),
                reference_id: Some(req.request_number.clone()),
                metadata: Some(json!({ "reason": payload.reason })),
            })
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Permohonan {} ditolak Supervisor dan dikembalikan ke Admin Gudang Utama untuk revisi", req.request_number)
        }))
    }

    pub async fn return_to_container(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: RejectReplenishmentRequest,
    ) -> Result<Value, AppError> {
        let req = sqlx::query!(
            "SELECT request_number, main_warehouse_id, container_warehouse_id, requested_by, status FROM replenishment_requests WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if req.status != "REQUESTED" && req.status != "RETURNED_TO_MAIN_ADMIN" {
            return Err(AppError::BadRequest(
                "Permohonan tidak dalam status yang dapat dikembalikan ke kontainer".to_string(),
            ));
        }

        sqlx::query!(
            r#"
            UPDATE replenishment_requests
            SET status = 'RETURNED_TO_CONTAINER_ADMIN', admin_notes = $1, updated_at = NOW()
            WHERE id = $2
            "#,
            payload.reason,
            id
        )
        .execute(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "RETURN_TO_CONTAINER",
                "REPLENISHMENT_REQUEST",
                Some(&req.request_number),
                Some(json!({ "reason": payload.reason })),
            )
            .await;

        let container_role = if req.container_warehouse_id == "WH-CONT-DT" {
            "CONTAINER_ADMIN_DT"
        } else {
            "CONTAINER_ADMIN_HE"
        };
        let notif_repo =
            crate::infrastructure::repositories::NotificationRepository::new(self.pool.clone());
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: Some(req.requested_by),
                recipient_role: Some(container_role.to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Permohonan Dikembalikan ke Kontainer: {}", req.request_number),
                message: format!(
                    "Permohonan {} dikembalikan oleh Admin Gudang Utama: {}. Silakan perbaiki permohonan Anda.",
                    req.request_number, payload.reason
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "REJECTED_TRANSACTION".to_string(),
                reference_id: Some(req.request_number.clone()),
                metadata: Some(json!({ "reason": payload.reason })),
            })
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Permohonan {} dikembalikan ke Admin Kontainer", req.request_number)
        }))
    }

    pub async fn receive_drop(&self, claims: &Claims, id: Uuid) -> Result<Value, AppError> {
        let mut tx = self.pool.begin().await?;

        let req = sqlx::query!(
            r#"
            SELECT id, request_number, container_warehouse_id, status
            FROM replenishment_requests
            WHERE id = $1 FOR UPDATE
            "#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if req.status != "IN_TRANSIT" {
            return Err(AppError::BadRequest(
                "Barang permohonan belum dalam pengiriman (IN_TRANSIT)".to_string(),
            ));
        }

        let items = sqlx::query!(
            r#"
            SELECT spare_part_id, approved_qty
            FROM replenishment_request_items
            WHERE request_id = $1
            "#,
            id
        )
        .fetch_all(&mut *tx)
        .await?;

        for itm in items {
            let current_qty = sqlx::query_scalar!(
                r#"
                SELECT qty_on_hand FROM inventory_stock
                WHERE warehouse_id = $1 AND spare_part_id = $2
                FOR UPDATE
                "#,
                req.container_warehouse_id,
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
                req.container_warehouse_id,
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
                req.container_warehouse_id,
                itm.spare_part_id,
                itm.approved_qty,
                new_qty,
                req.request_number,
                format!(
                    "Penerimaan suplai dari Gudang Utama atas STO {}",
                    req.request_number
                ),
                claims.sub
            )
            .execute(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                UPDATE replenishment_request_items
                SET received_qty = approved_qty
                WHERE request_id = $1 AND spare_part_id = $2
                "#,
                id,
                itm.spare_part_id
            )
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query!(
            r#"
            UPDATE main_warehouse_drops
            SET status = 'COMPLETED', received_by = $1, received_at = NOW()
            WHERE request_id = $2
            "#,
            claims.sub,
            id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            UPDATE replenishment_requests
            SET status = 'COMPLETED', received_by = $1, received_at = NOW(), updated_at = NOW()
            WHERE id = $2
            "#,
            claims.sub,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let notif_repo =
            crate::infrastructure::repositories::NotificationRepository::new(self.pool.clone());
        let main_role = if req.container_warehouse_id == "WH-CONT-DT" {
            "MAIN_ADMIN_DT"
        } else {
            "MAIN_ADMIN_HE"
        };

        // 1. Notify Main Warehouse Admin
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: None,
                recipient_role: Some(main_role.to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Barang STO Diterima: {}", req.request_number),
                message: format!(
                    "Barang STO atas permohonan {} telah diterima dengan lengkap di {}. Saldo fisik kontainer telah bertambah.",
                    req.request_number, req.container_warehouse_id
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "APPROVAL_COMPLETED".to_string(),
                reference_id: Some(req.request_number.clone()),
                metadata: Some(json!({ "request_id": id, "container_warehouse_id": req.container_warehouse_id })),
            })
            .await;

        // 2. Notify Supervisor
        let _ = notif_repo
            .create_notification(&crate::domain::entities::CreateNotificationRequest {
                user_id: None,
                recipient_role: Some("SUPERVISOR".to_string()),
                recipient_email: None,
                recipient_phone: None,
                title: format!("Replenishment Selesai: {}", req.request_number),
                message: format!(
                    "Siklus STO permohonan {} selesai. Stok di {} telah diterima dan status COMPLETED.",
                    req.request_number, req.container_warehouse_id
                ),
                channel: Some("IN_APP".to_string()),
                trigger_type: "APPROVAL_COMPLETED".to_string(),
                reference_id: Some(req.request_number.clone()),
                metadata: Some(json!({ "request_id": id, "container_warehouse_id": req.container_warehouse_id })),
            })
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Barang permohonan {} berhasil diterima dan stok kontainer telah bertambah!", req.request_number)
        }))
    }
}
