use crate::{
    domain::entities::{
        ApproveMechanicRequestPayload, CancelMechanicRequestPayload, Claims,
        CreateMechanicRequestPayload, FulfillMechanicRequestPayload, MechanicRequest,
        MechanicRequestFilterQuery, MechanicRequestSummary, RejectMechanicRequestPayload,
        RequestRevisionPayload, UpdateMechanicRequestPayload,
    },
    error::AppError,
    infrastructure::{
        database::next_document_number,
        repositories::{AuditRepository, MechanicRequestRepository},
    },
};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct MechanicRequestService {
    pool: PgPool,
    repo: MechanicRequestRepository,
    audit_repo: AuditRepository,
}

impl MechanicRequestService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            repo: MechanicRequestRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn get_mechanic_context(&self, claims: &Claims) -> Result<Value, AppError> {
        let employee = sqlx::query_as::<_, (String, String, Option<String>, Option<String>)>(
            r#"
            SELECT e.id, e.name, e.position, e.department_id
            FROM users u
            JOIN employees e ON u.employee_id = e.id
            WHERE u.id = $1
            "#,
        )
        .bind(claims.sub)
        .fetch_optional(&self.pool)
        .await?;

        let warehouses = sqlx::query_as::<_, (String, String, String, String)>(
            r#"
            SELECT w.id, w.name, w.warehouse_type, w.category
            FROM user_warehouses uw
            JOIN warehouses w ON uw.warehouse_id = w.id
            WHERE uw.user_id = $1
            ORDER BY w.name
            "#,
        )
        .bind(claims.sub)
        .fetch_all(&self.pool)
        .await?;

        let warehouses_json: Vec<Value> = warehouses
            .into_iter()
            .map(|(id, name, wh_type, cat)| {
                json!({
                    "id": id,
                    "name": name,
                    "warehouse_type": wh_type,
                    "category": cat
                })
            })
            .collect();

        Ok(json!({
            "employee": employee.map(|(id, name, pos, dept)| {
                json!({
                    "id": id,
                    "name": name,
                    "position": pos,
                    "department_id": dept
                })
            }),
            "warehouses": warehouses_json
        }))
    }

    pub async fn list_requests(
        &self,
        claims: &Claims,
        query: MechanicRequestFilterQuery,
        user_warehouses: &[String],
    ) -> Result<Vec<MechanicRequest>, AppError> {
        let is_mechanic = claims.role_id == "MECHANIC";
        let requester_filter = if is_mechanic || query.mine.unwrap_or(false) {
            Some(claims.sub)
        } else {
            None
        };

        self.repo
            .list_requests(&query, user_warehouses, requester_filter)
            .await
    }

    pub async fn get_summary(
        &self,
        claims: &Claims,
        warehouse_id: Option<&str>,
        user_warehouses: &[String],
    ) -> Result<MechanicRequestSummary, AppError> {
        let requester_filter = if claims.role_id == "MECHANIC" {
            Some(claims.sub)
        } else {
            None
        };

        self.repo
            .get_summary(warehouse_id, user_warehouses, requester_filter)
            .await
    }

    pub async fn get_request_detail(
        &self,
        id: Uuid,
        warehouse_id: Option<&str>,
    ) -> Result<Value, AppError> {
        let request = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan stok tidak ditemukan".to_string()))?;

        let wh = warehouse_id.unwrap_or(&request.warehouse_id);
        let items = self.repo.get_items(id, wh).await?;
        let history = self.repo.get_history(id).await?;

        Ok(json!({
            "request": request,
            "items": items,
            "history": history
        }))
    }

    pub async fn create_request(
        &self,
        claims: &Claims,
        payload: CreateMechanicRequestPayload,
        force: bool,
    ) -> Result<Value, AppError> {
        // Idempotency check for mobile sync
        if let Some(client_uuid) = payload.client_uuid {
            if let Some(existing) = self.repo.find_by_client_uuid(client_uuid).await? {
                return Ok(json!({
                    "success": true,
                    "idempotent": true,
                    "id": existing.id,
                    "request_number": existing.request_number,
                    "status": existing.status,
                    "message": "Permohonan dengan client_uuid ini sudah tersimpan sebelumnya"
                }));
            }
        }

        // Basic validations
        if payload.items.is_empty() {
            return Err(AppError::BadRequest(
                "Daftar item permohonan tidak boleh kosong".to_string(),
            ));
        }

        for item in &payload.items {
            if item.qty <= Decimal::ZERO {
                return Err(AppError::BadRequest(format!(
                    "Jumlah qty untuk item {} harus lebih besar dari 0",
                    item.spare_part_id
                )));
            }
        }

        let is_replacement = payload.request_type == "REPLACEMENT";
        let is_return = payload.request_type == "RETURN";

        if !is_replacement && !is_return {
            return Err(AppError::BadRequest(
                "Tipe permohonan harus REPLACEMENT atau RETURN".to_string(),
            ));
        }

        if is_replacement {
            if payload
                .unit_number
                .as_deref()
                .unwrap_or("")
                .trim()
                .is_empty()
            {
                return Err(AppError::BadRequest(
                    "Nomor unit wajib diisi untuk permohonan penggantian".to_string(),
                ));
            }
            if payload
                .damage_description
                .as_deref()
                .unwrap_or("")
                .trim()
                .is_empty()
            {
                return Err(AppError::BadRequest(
                    "Deskripsi kerusakan wajib diisi sebagai bukti analisa".to_string(),
                ));
            }
            if payload
                .damage_photo_url
                .as_deref()
                .unwrap_or("")
                .trim()
                .is_empty()
            {
                return Err(AppError::BadRequest(
                    "Foto bukti kerusakan wajib dilampirkan".to_string(),
                ));
            }
        }

        if is_return
            && payload
                .return_reason
                .as_deref()
                .unwrap_or("")
                .trim()
                .is_empty()
        {
            return Err(AppError::BadRequest(
                "Alasan pengembalian wajib dipilih".to_string(),
            ));
        }

        // Resolve mechanic identity
        let (mechanic_id, mechanic_name, input_channel) = if claims.role_id == "MECHANIC" {
            let channel = if payload.device_id.is_some() {
                "MOBILE"
            } else {
                "MECHANIC"
            };

            let emp_id: Option<String> =
                sqlx::query_scalar("SELECT employee_id FROM users WHERE id = $1")
                    .bind(claims.sub)
                    .fetch_optional(&self.pool)
                    .await?;

            let emp_name: Option<String> = if let Some(ref eid) = emp_id {
                sqlx::query_scalar("SELECT name FROM employees WHERE id = $1")
                    .bind(eid)
                    .fetch_optional(&self.pool)
                    .await?
            } else {
                None
            };

            let final_name = emp_name.unwrap_or_else(|| claims.username.clone());
            (
                emp_id.or(payload.mechanic_id),
                final_name,
                channel.to_string(),
            )
        } else {
            // Admin Kontainer / Manager inputting on behalf of mechanic
            let name = payload.mechanic_name.ok_or_else(|| {
                AppError::BadRequest("Nama mekanik wajib diisi oleh Admin Kontainer".to_string())
            })?;
            (payload.mechanic_id, name, "ADMIN_CONTAINER".to_string())
        };

        // 30-minute duplicate warning
        if !force && is_replacement {
            if let Some(ref unit) = payload.unit_number {
                let part_ids: Vec<String> = payload
                    .items
                    .iter()
                    .map(|i| i.spare_part_id.clone())
                    .collect();
                if let Some((dup_req_no, dup_part)) =
                    self.repo.check_recent_duplicate(unit, &part_ids).await?
                {
                    return Ok(json!({
                        "duplicate_warning": true,
                        "message": format!(
                            "Peringatan: Unit {} baru saja diajukan spare part {} dalam 30 menit terakhir (No: {}). Lanjutkan pengajuan?",
                            unit, dup_part, dup_req_no
                        )
                    }));
                }
            }
        }

        let mut tx = self.pool.begin().await?;

        let request_no = next_document_number(&mut tx, "MRQ").await?;

        let priority = payload.priority.unwrap_or_else(|| "NORMAL".to_string());
        let hm_km = payload.hm_km.unwrap_or(Decimal::ZERO);

        let site_id = if let Some(ref sid) = payload.site_id {
            Some(sid.clone())
        } else if let Some(ref unit) = payload.unit_number {
            sqlx::query_scalar(
                "SELECT current_site_id FROM equipment WHERE unit_number = $1 OR id = $1",
            )
            .bind(unit)
            .fetch_optional(&self.pool)
            .await
            .unwrap_or(None)
            .or_else(|| Some("SITE-VALE-A".to_string()))
        } else {
            Some("SITE-VALE-A".to_string())
        };

        let req_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO mechanic_requests (
                request_number, request_type, warehouse_id, site_id, status,
                unit_number, unit_name, unit_type, ct_number, serial_number,
                hm_km, work_order_number, maintenance_type, priority,
                mechanic_id, mechanic_name, requester_user_id, input_channel,
                damage_category, damage_description, damage_photo_url,
                old_part_photo_url, document_url, return_reason,
                reference_issue_number, notes, client_uuid, device_id,
                created_by
            ) VALUES (
                $1, $2, $3, $4, 'SUBMITTED',
                $5, $6, $7, $8, $9,
                $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20,
                $21, $22, $23,
                $24, $25, $26, $27,
                $28
            ) RETURNING id
            "#,
        )
        .bind(&request_no)
        .bind(&payload.request_type)
        .bind(&payload.warehouse_id)
        .bind(site_id)
        .bind(payload.unit_number)
        .bind(payload.unit_name)
        .bind(payload.unit_type)
        .bind(payload.ct_number)
        .bind(payload.serial_number)
        .bind(hm_km)
        .bind(payload.work_order_number)
        .bind(payload.maintenance_type)
        .bind(priority)
        .bind(mechanic_id)
        .bind(&mechanic_name)
        .bind(claims.sub)
        .bind(input_channel)
        .bind(payload.damage_category)
        .bind(payload.damage_description)
        .bind(payload.damage_photo_url)
        .bind(payload.old_part_photo_url)
        .bind(payload.document_url)
        .bind(payload.return_reason)
        .bind(payload.reference_issue_number)
        .bind(payload.notes)
        .bind(payload.client_uuid)
        .bind(payload.device_id)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        // Insert items
        for item in &payload.items {
            let uom: String =
                sqlx::query_scalar("SELECT unit_of_measure FROM spare_parts WHERE id = $1")
                    .bind(&item.spare_part_id)
                    .fetch_optional(&mut *tx)
                    .await?
                    .unwrap_or_else(|| "PCS".to_string());

            sqlx::query(
                r#"
                INSERT INTO mechanic_request_items (
                    request_id, spare_part_id, unit_of_measure, requested_qty,
                    approved_qty, item_condition, notes
                ) VALUES ($1, $2, $3, $4, $4, $5, $6)
                "#,
            )
            .bind(req_id)
            .bind(&item.spare_part_id)
            .bind(uom)
            .bind(item.qty)
            .bind(item.item_condition.as_deref())
            .bind(item.notes.as_deref())
            .execute(&mut *tx)
            .await?;
        }

        // Record history
        MechanicRequestRepository::record_history(
            &mut tx,
            req_id,
            "CREATE",
            None,
            "SUBMITTED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            Some("Permohonan stok baru diajukan"),
            None,
        )
        .await?;

        // Audit log
        let _ = self
            .audit_repo
            .record_log_full(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_MECHANIC_REQUEST",
                "MECHANIC_REQUEST",
                Some(&request_no),
                None,
                Some(json!({
                    "id": req_id,
                    "type": payload.request_type,
                    "warehouse": payload.warehouse_id,
                    "items": payload.items.len()
                })),
                None,
                None,
            )
            .await;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "id": req_id,
            "request_number": request_no,
            "status": "SUBMITTED",
            "message": "Permohonan stok berhasil diajukan dan menunggu approval Admin Kontainer"
        }))
    }

    pub async fn update_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: UpdateMechanicRequestPayload,
    ) -> Result<Value, AppError> {
        let current = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if current.status != "SUBMITTED" && current.status != "REVISION_REQUESTED" {
            return Err(AppError::BadRequest(format!(
                "Permohonan dalam status {} tidak dapat diubah",
                current.status
            )));
        }

        // Check ownership if mechanic
        if claims.role_id == "MECHANIC" && current.requester_user_id != Some(claims.sub) {
            return Err(AppError::Forbidden(
                "Anda hanya dapat mengubah permohonan yang Anda buat sendiri".to_string(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        let was_revision = current.status == "REVISION_REQUESTED";
        let new_revision_count = if was_revision {
            current.revision_count + 1
        } else {
            current.revision_count
        };

        sqlx::query(
            r#"
            UPDATE mechanic_requests
            SET 
                site_id = COALESCE($1, site_id),
                unit_number = COALESCE($2, unit_number),
                unit_name = COALESCE($3, unit_name),
                unit_type = COALESCE($4, unit_type),
                hm_km = COALESCE($5, hm_km),
                work_order_number = COALESCE($6, work_order_number),
                maintenance_type = COALESCE($7, maintenance_type),
                damage_category = COALESCE($8, damage_category),
                damage_description = COALESCE($9, damage_description),
                damage_photo_url = COALESCE($10, damage_photo_url),
                old_part_photo_url = COALESCE($11, old_part_photo_url),
                return_reason = COALESCE($12, return_reason),
                notes = COALESCE($13, notes),
                status = 'SUBMITTED',
                revision_count = $14,
                updated_at = NOW()
            WHERE id = $15
            "#,
        )
        .bind(payload.site_id)
        .bind(payload.unit_number)
        .bind(payload.unit_name)
        .bind(payload.unit_type)
        .bind(payload.hm_km)
        .bind(payload.work_order_number)
        .bind(payload.maintenance_type)
        .bind(payload.damage_category)
        .bind(payload.damage_description)
        .bind(payload.damage_photo_url)
        .bind(payload.old_part_photo_url)
        .bind(payload.return_reason)
        .bind(payload.notes)
        .bind(new_revision_count)
        .bind(id)
        .execute(&mut *tx)
        .await?;

        // If items are provided, replace them
        if let Some(items) = payload.items {
            if items.is_empty() {
                return Err(AppError::BadRequest(
                    "Daftar item tidak boleh kosong".to_string(),
                ));
            }

            sqlx::query("DELETE FROM mechanic_request_items WHERE request_id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;

            for itm in &items {
                let uom: String =
                    sqlx::query_scalar("SELECT unit_of_measure FROM spare_parts WHERE id = $1")
                        .bind(&itm.spare_part_id)
                        .fetch_optional(&mut *tx)
                        .await?
                        .unwrap_or_else(|| "PCS".to_string());

                sqlx::query(
                    r#"
                    INSERT INTO mechanic_request_items (
                        request_id, spare_part_id, unit_of_measure, requested_qty,
                        approved_qty, item_condition, notes
                    ) VALUES ($1, $2, $3, $4, $4, $5, $6)
                    "#,
                )
                .bind(id)
                .bind(&itm.spare_part_id)
                .bind(uom)
                .bind(itm.qty)
                .bind(itm.item_condition.as_deref())
                .bind(itm.notes.as_deref())
                .execute(&mut *tx)
                .await?;
            }
        }

        MechanicRequestRepository::record_history(
            &mut tx,
            id,
            "UPDATE",
            Some(&current.status),
            "SUBMITTED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            Some(if was_revision {
                "Permohonan direvisi dan diajukan ulang oleh pemohon"
            } else {
                "Permohonan diperbarui oleh pemohon"
            }),
            None,
        )
        .await?;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "status": "SUBMITTED",
            "message": "Permohonan berhasil diperbarui dan diajukan ulang"
        }))
    }

    pub async fn approve_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: ApproveMechanicRequestPayload,
    ) -> Result<Value, AppError> {
        let current = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if current.status != "SUBMITTED" {
            return Err(AppError::BadRequest(format!(
                "Hanya permohonan berstatus SUBMITTED yang dapat disetujui (status saat ini: {})",
                current.status
            )));
        }

        let mut tx = self.pool.begin().await?;

        // Approver can adjust qty per item if provided
        if let Some(items) = payload.items {
            for itm in &items {
                if itm.qty < Decimal::ZERO {
                    return Err(AppError::BadRequest(
                        "Jumlah approved qty tidak boleh negatif".to_string(),
                    ));
                }
                sqlx::query(
                    "UPDATE mechanic_request_items SET approved_qty = $1 WHERE id = $2 AND request_id = $3",
                )
                .bind(itm.qty)
                .bind(itm.item_id)
                .bind(id)
                .execute(&mut *tx)
                .await?;
            }
        } else {
            // Default: approved_qty = requested_qty
            sqlx::query(
                "UPDATE mechanic_request_items SET approved_qty = requested_qty WHERE request_id = $1",
            )
            .bind(id)
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query(
            r#"
            UPDATE mechanic_requests
            SET 
                status = 'APPROVED',
                approved_by = $1,
                approved_at = NOW(),
                approve_notes = $2,
                updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(claims.sub)
        .bind(payload.notes.as_deref())
        .bind(id)
        .execute(&mut *tx)
        .await?;

        MechanicRequestRepository::record_history(
            &mut tx,
            id,
            "APPROVE",
            Some("SUBMITTED"),
            "APPROVED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            payload
                .notes
                .as_deref()
                .or(Some("Permohonan disetujui oleh Admin Kontainer")),
            None,
        )
        .await?;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "status": "APPROVED",
            "message": "Permohonan berhasil disetujui. Silakan lakukan serah terima barang fisik untuk menyelesaikan."
        }))
    }

    pub async fn request_revision(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: RequestRevisionPayload,
    ) -> Result<Value, AppError> {
        let current = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if current.status != "SUBMITTED" {
            return Err(AppError::BadRequest(
                "Hanya permohonan berstatus SUBMITTED yang dapat dikembalikan untuk revisi"
                    .to_string(),
            ));
        }

        if payload.notes.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Catatan alasan revisi wajib diisi".to_string(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            UPDATE mechanic_requests
            SET 
                status = 'REVISION_REQUESTED',
                revision_notes = $1,
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(&payload.notes)
        .bind(id)
        .execute(&mut *tx)
        .await?;

        MechanicRequestRepository::record_history(
            &mut tx,
            id,
            "REQUEST_REVISION",
            Some("SUBMITTED"),
            "REVISION_REQUESTED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            Some(&payload.notes),
            None,
        )
        .await?;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "status": "REVISION_REQUESTED",
            "message": "Permohonan dikembalikan ke pemohon untuk direvisi"
        }))
    }

    pub async fn reject_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: RejectMechanicRequestPayload,
    ) -> Result<Value, AppError> {
        let current = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if current.status != "SUBMITTED" {
            return Err(AppError::BadRequest(
                "Hanya permohonan berstatus SUBMITTED yang dapat ditolak".to_string(),
            ));
        }

        if payload.reason.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Alasan penolakan wajib diisi".to_string(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            UPDATE mechanic_requests
            SET 
                status = 'REJECTED',
                rejected_by = $1,
                rejected_at = NOW(),
                reject_reason = $2,
                updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(claims.sub)
        .bind(&payload.reason)
        .bind(id)
        .execute(&mut *tx)
        .await?;

        MechanicRequestRepository::record_history(
            &mut tx,
            id,
            "REJECT",
            Some("SUBMITTED"),
            "REJECTED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            Some(&payload.reason),
            None,
        )
        .await?;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "status": "REJECTED",
            "message": "Permohonan telah ditolak"
        }))
    }

    pub async fn cancel_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: CancelMechanicRequestPayload,
    ) -> Result<Value, AppError> {
        let current = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if current.status != "SUBMITTED" && current.status != "REVISION_REQUESTED" {
            return Err(AppError::BadRequest(
                "Hanya permohonan berstatus SUBMITTED atau REVISION_REQUESTED yang dapat dibatalkan".to_string(),
            ));
        }

        // Check ownership if mechanic
        if claims.role_id == "MECHANIC" && current.requester_user_id != Some(claims.sub) {
            return Err(AppError::Forbidden(
                "Anda hanya dapat membatalkan permohonan yang Anda buat sendiri".to_string(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        sqlx::query(
            "UPDATE mechanic_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;

        let notes = payload
            .reason
            .as_deref()
            .unwrap_or("Dibatalkan oleh pemohon");

        MechanicRequestRepository::record_history(
            &mut tx,
            id,
            "CANCEL",
            Some(&current.status),
            "CANCELLED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            Some(notes),
            None,
        )
        .await?;

        tx.commit().await?;

        Ok(json!({
            "success": true,
            "status": "CANCELLED",
            "message": "Permohonan berhasil dibatalkan"
        }))
    }

    pub async fn fulfill_request(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: FulfillMechanicRequestPayload,
    ) -> Result<Value, AppError> {
        let current = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

        if current.status != "APPROVED" {
            return Err(AppError::BadRequest(format!(
                "Hanya permohonan berstatus APPROVED yang dapat diserahkan/diselesaikan (status saat ini: {})",
                current.status
            )));
        }

        let mut tx = self.pool.begin().await?;

        // Update fulfilled_qty for items
        let items = self.repo.get_items(id, &current.warehouse_id).await?;

        // Map overrides if any
        let mut final_items: Vec<(Uuid, String, Decimal, String)> = Vec::new();
        for item in &items {
            let approved = item.approved_qty.unwrap_or(item.requested_qty);
            let fulfilled = if let Some(ref list) = payload.items {
                list.iter()
                    .find(|p| p.item_id == item.id)
                    .map(|p| p.qty)
                    .unwrap_or(approved)
            } else {
                approved
            };

            if fulfilled > approved {
                return Err(AppError::BadRequest(format!(
                    "Jumlah qty yang diserahkan ({}) melebihi jumlah yang disetujui ({}) untuk {}",
                    fulfilled, approved, item.spare_part_id
                )));
            }

            sqlx::query("UPDATE mechanic_request_items SET fulfilled_qty = $1 WHERE id = $2")
                .bind(fulfilled)
                .bind(item.id)
                .execute(&mut *tx)
                .await?;

            if fulfilled > Decimal::ZERO {
                final_items.push((
                    item.id,
                    item.spare_part_id.clone(),
                    fulfilled,
                    item.unit_of_measure.clone(),
                ));
            }
        }

        if final_items.is_empty() {
            return Err(AppError::BadRequest(
                "Minimal satu item harus diserahkan dengan qty > 0".to_string(),
            ));
        }

        let mut issue_trans_no: Option<String> = None;

        if current.request_type == "REPLACEMENT" {
            // Check stock and deduct
            for (_, part_id, qty, _) in &final_items {
                let current_stock = sqlx::query_scalar::<_, Decimal>(
                    r#"
                    SELECT qty_on_hand FROM inventory_stock
                    WHERE warehouse_id = $1 AND spare_part_id = $2
                    FOR UPDATE
                    "#,
                )
                .bind(&current.warehouse_id)
                .bind(part_id)
                .fetch_optional(&mut *tx)
                .await?
                .unwrap_or(Decimal::ZERO);

                if current_stock < *qty {
                    return Err(AppError::BadRequest(format!(
                        "Stok fisik spare part {} di gudang {} tidak mencukupi (Tersedia: {}, Dibutuhkan: {})",
                        part_id, current.warehouse_id, current_stock, qty
                    )));
                }

                let new_stock = current_stock - *qty;

                sqlx::query(
                    r#"
                    UPDATE inventory_stock
                    SET qty_on_hand = $1, updated_at = NOW()
                    WHERE warehouse_id = $2 AND spare_part_id = $3
                    "#,
                )
                .bind(new_stock)
                .bind(&current.warehouse_id)
                .bind(part_id)
                .execute(&mut *tx)
                .await?;
            }

            // Generate atomic POS transaction
            let iss_no = next_document_number(&mut tx, "ISS").await?;
            issue_trans_no = Some(iss_no.clone());

            let site_id = if let Some(ref s) = current.site_id {
                let exists: bool =
                    sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM sites WHERE id = $1)")
                        .bind(s)
                        .fetch_one(&mut *tx)
                        .await
                        .unwrap_or(false);
                if exists {
                    s.clone()
                } else {
                    "SITE-VALE-A".to_string()
                }
            } else if let Some(ref u) = current.unit_number {
                let site_from_eq: Option<String> = sqlx::query_scalar(
                    "SELECT current_site_id FROM equipment WHERE unit_number = $1 OR id = $1",
                )
                .bind(u)
                .fetch_optional(&mut *tx)
                .await
                .unwrap_or(None);
                site_from_eq.unwrap_or_else(|| "SITE-VALE-A".to_string())
            } else {
                "SITE-VALE-A".to_string()
            };
            let unit_number = current
                .unit_number
                .clone()
                .unwrap_or_else(|| "UNKNOWN".to_string());
            let unit_name = current
                .unit_name
                .clone()
                .unwrap_or_else(|| unit_number.clone());
            let unit_type = current
                .unit_type
                .clone()
                .unwrap_or_else(|| "GENERAL".to_string());

            let iss_id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO issue_transactions (
                    transaction_number, warehouse_id, site_id,
                    receiver_name, receiver_employee_id, receiver_department,
                    unit_number, unit_name, unit_type, ct_number, serial_number,
                    hm_km, mechanic_name, mechanic_id, work_order_number,
                    maintenance_type, priority, status, notes,
                    evidence_photo_url, document_url, created_by, approved_by
                ) VALUES (
                    $1, $2, $3,
                    $4, $5, 'Mechanic',
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14,
                    $15, $16, 'COMPLETED', $17,
                    $18, $19, $20, $21
                ) RETURNING id
                "#,
            )
            .bind(&iss_no)
            .bind(&current.warehouse_id)
            .bind(&site_id)
            .bind(&current.mechanic_name)
            .bind(current.mechanic_id.as_deref())
            .bind(&unit_number)
            .bind(&unit_name)
            .bind(&unit_type)
            .bind(current.ct_number.as_deref())
            .bind(current.serial_number.as_deref())
            .bind(current.hm_km.unwrap_or(Decimal::ZERO))
            .bind(&current.mechanic_name)
            .bind(current.mechanic_id.as_deref())
            .bind(current.work_order_number.as_deref())
            .bind(current.maintenance_type.as_deref())
            .bind(&current.priority)
            .bind(format!(
                "Fulfill Permohonan Mekanik: {}",
                current.request_number
            ))
            .bind(current.damage_photo_url.as_deref())
            .bind(current.document_url.as_deref())
            .bind(claims.sub)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;

            // Insert issue items & stock movements & core returns
            for (_, part_id, qty, uom) in &final_items {
                sqlx::query(
                    r#"
                    INSERT INTO issue_transaction_items (transaction_id, spare_part_id, qty, unit_of_measure)
                    VALUES ($1, $2, $3, $4)
                    "#,
                )
                .bind(iss_id)
                .bind(part_id)
                .bind(*qty)
                .bind(uom)
                .execute(&mut *tx)
                .await?;

                let balance = sqlx::query_scalar::<_, Decimal>(
                    "SELECT qty_on_hand FROM inventory_stock WHERE warehouse_id = $1 AND spare_part_id = $2",
                )
                .bind(&current.warehouse_id)
                .bind(part_id)
                .fetch_one(&mut *tx)
                .await?;

                sqlx::query(
                    r#"
                    INSERT INTO stock_movements (
                        warehouse_id, spare_part_id, movement_type, qty,
                        balance_after, reference_number, notes, created_by
                    ) VALUES ($1, $2, 'ISSUE_OUT', $3, $4, $5, $6, $7)
                    "#,
                )
                .bind(&current.warehouse_id)
                .bind(part_id)
                .bind(*qty)
                .bind(balance)
                .bind(&iss_no)
                .bind(format!(
                    "Penyerahan part untuk unit {} via MRQ {}",
                    unit_number, current.request_number
                ))
                .bind(claims.sub)
                .execute(&mut *tx)
                .await?;

                // Automatic Used Part Return entry for traceability
                let ret_no = next_document_number(&mut tx, "RET").await?;
                sqlx::query(
                    r#"
                    INSERT INTO used_part_returns (
                        return_number, issue_transaction_id, spare_part_id, qty, unit_of_measure,
                        unit_number, mechanic_name, mechanic_id, warehouse_id,
                        status, current_holder_type, current_holder_name
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_RETURN', 'MECHANIC', $10)
                    "#,
                )
                .bind(&ret_no)
                .bind(iss_id)
                .bind(part_id)
                .bind(*qty)
                .bind(uom)
                .bind(&unit_number)
                .bind(&current.mechanic_name)
                .bind(current.mechanic_id.as_deref())
                .bind(&current.warehouse_id)
                .bind(&current.mechanic_name)
                .execute(&mut *tx)
                .await?;
            }

            // Update request header with issue link
            sqlx::query(
                r#"
                UPDATE mechanic_requests
                SET 
                    status = 'COMPLETED',
                    fulfilled_by = $1,
                    fulfilled_at = NOW(),
                    fulfill_notes = $2,
                    issue_transaction_id = $3,
                    updated_at = NOW()
                WHERE id = $4
                "#,
            )
            .bind(claims.sub)
            .bind(payload.notes.as_deref())
            .bind(iss_id)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        } else {
            // RETURN mode: Increase container stock
            for (_, part_id, qty, _) in &final_items {
                // Ensure inventory_stock row exists
                let exists = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM inventory_stock WHERE warehouse_id = $1 AND spare_part_id = $2)",
                )
                .bind(&current.warehouse_id)
                .bind(part_id)
                .fetch_one(&mut *tx)
                .await?;

                if !exists {
                    sqlx::query(
                        r#"
                        INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock)
                        VALUES ($1, $2, $3, 5, 50)
                        "#,
                    )
                    .bind(&current.warehouse_id)
                    .bind(part_id)
                    .bind(*qty)
                    .execute(&mut *tx)
                    .await?;
                } else {
                    sqlx::query(
                        r#"
                        UPDATE inventory_stock
                        SET qty_on_hand = qty_on_hand + $1, updated_at = NOW()
                        WHERE warehouse_id = $2 AND spare_part_id = $3
                        "#,
                    )
                    .bind(*qty)
                    .bind(&current.warehouse_id)
                    .bind(part_id)
                    .execute(&mut *tx)
                    .await?;
                }

                let balance = sqlx::query_scalar::<_, Decimal>(
                    "SELECT qty_on_hand FROM inventory_stock WHERE warehouse_id = $1 AND spare_part_id = $2",
                )
                .bind(&current.warehouse_id)
                .bind(part_id)
                .fetch_one(&mut *tx)
                .await?;

                sqlx::query(
                    r#"
                    INSERT INTO stock_movements (
                        warehouse_id, spare_part_id, movement_type, qty,
                        balance_after, reference_number, notes, created_by
                    ) VALUES ($1, $2, 'ADJUSTMENT_IN', $3, $4, $5, $6, $7)
                    "#,
                )
                .bind(&current.warehouse_id)
                .bind(part_id)
                .bind(*qty)
                .bind(balance)
                .bind(&current.request_number)
                .bind(format!(
                    "Pengembalian part oleh mekanik ({})",
                    current.mechanic_name
                ))
                .bind(claims.sub)
                .execute(&mut *tx)
                .await?;
            }

            sqlx::query(
                r#"
                UPDATE mechanic_requests
                SET 
                    status = 'COMPLETED',
                    fulfilled_by = $1,
                    fulfilled_at = NOW(),
                    fulfill_notes = $2,
                    updated_at = NOW()
                WHERE id = $3
                "#,
            )
            .bind(claims.sub)
            .bind(payload.notes.as_deref())
            .bind(id)
            .execute(&mut *tx)
            .await?;
        }

        MechanicRequestRepository::record_history(
            &mut tx,
            id,
            "FULFILL",
            Some("APPROVED"),
            "COMPLETED",
            Some(claims.sub),
            &claims.username,
            &claims.role_id,
            payload.notes.as_deref().or(Some(
                "Barang fisik telah diserahkan/diterima oleh Admin Kontainer",
            )),
            issue_trans_no
                .as_ref()
                .map(|n| json!({ "issue_transaction_number": n })),
        )
        .await?;

        tx.commit().await?;

        let msg = if current.request_type == "REPLACEMENT" {
            format!(
                "Serah terima barang berhasil. Transaksi POS terbit ({}) dan stok kontainer telah terpotong.",
                issue_trans_no.as_deref().unwrap_or("-")
            )
        } else {
            "Penerimaan pengembalian barang berhasil dan stok kontainer telah bertambah."
                .to_string()
        };

        Ok(json!({
            "success": true,
            "status": "COMPLETED",
            "message": msg,
            "issue_transaction_number": issue_trans_no
        }))
    }
}
