use crate::{
    domain::entities::{
        Claims, CompleteReturnRequest, ReceiveContainerReturnRequest, TransferMainReturnRequest,
        UsedPartReturn,
    },
    error::AppError,
    infrastructure::repositories::{AuditRepository, ReturnRepository},
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ReturnService {
    pool: PgPool,
    return_repo: ReturnRepository,
    audit_repo: AuditRepository,
}

impl ReturnService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            return_repo: ReturnRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn list_returns(
        &self,
        wh_filter: &str,
        status_filter: &str,
        search: &str,
        mechanic_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<UsedPartReturn>, AppError> {
        self.return_repo
            .list_returns(wh_filter, status_filter, search, mechanic_filter, user_whs)
            .await
    }

    pub async fn get_return_detail(&self, id: Uuid) -> Result<UsedPartReturn, AppError> {
        self.return_repo.get_return_by_id(id).await?.ok_or_else(|| {
            AppError::NotFound("Data pengembalian part bekas tidak ditemukan".to_string())
        })
    }

    pub async fn receive_at_container(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: ReceiveContainerReturnRequest,
    ) -> Result<Value, AppError> {
        let current = sqlx::query!(
            "SELECT id, warehouse_id, status, return_number FROM used_part_returns WHERE id = $1 FOR UPDATE",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Data retur tidak ditemukan".to_string()))?;

        if current.status != "PENDING_RETURN" {
            return Err(AppError::BadRequest(
                "Part bekas ini sudah pernah diterima di kontainer atau telah selesai".to_string(),
            ));
        }

        let receiver_name =
            sqlx::query_scalar!("SELECT full_name FROM users WHERE id = $1", claims.sub)
                .fetch_one(&self.pool)
                .await?;

        let holder_label = format!("Admin Kontainer ({})", receiver_name);

        sqlx::query!(
            r#"
            UPDATE used_part_returns
            SET status = 'RECEIVED_AT_CONTAINER',
                current_holder_type = 'CONTAINER_ADMIN',
                current_holder_name = $1,
                container_received_at = NOW(),
                container_received_by = $2,
                container_notes = $3,
                container_photo_url = $4,
                updated_at = NOW()
            WHERE id = $5
            "#,
            holder_label,
            claims.sub,
            payload.container_notes,
            payload.container_photo_url,
            id
        )
        .execute(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "RECEIVE_CORE_RETURN",
                "USED_PART_RETURN",
                Some(&current.return_number),
                Some(json!({
                    "status": "RECEIVED_AT_CONTAINER",
                    "received_by": receiver_name,
                    "notes": payload.container_notes
                })),
            )
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Part bekas {} berhasil diterima di Gudang Kontainer", current.return_number)
        }))
    }

    pub async fn transfer_to_main(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: TransferMainReturnRequest,
    ) -> Result<Value, AppError> {
        let current = sqlx::query!(
            "SELECT id, warehouse_id, status, return_number FROM used_part_returns WHERE id = $1 FOR UPDATE",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Data retur tidak ditemukan".to_string()))?;

        if current.status != "RECEIVED_AT_CONTAINER" {
            return Err(AppError::BadRequest("Barang harus berstatus sudah diterima di Kontainer sebelum diserahkan ke Gudang Utama".to_string()));
        }

        let receiver_name =
            sqlx::query_scalar!("SELECT full_name FROM users WHERE id = $1", claims.sub)
                .fetch_one(&self.pool)
                .await?;

        let main_wh = payload.main_warehouse_id.unwrap_or_else(|| {
            if current.warehouse_id.contains("DT") {
                "WH-MAIN-DT".to_string()
            } else {
                "WH-MAIN-HE".to_string()
            }
        });

        let holder_label = format!("Admin Gudang Utama ({})", receiver_name);

        sqlx::query!(
            r#"
            UPDATE used_part_returns
            SET status = 'TRANSFERRED_TO_MAIN',
                current_holder_type = 'MAIN_ADMIN',
                current_holder_name = $1,
                main_received_at = NOW(),
                main_received_by = $2,
                main_warehouse_id = $3,
                main_notes = $4,
                updated_at = NOW()
            WHERE id = $5
            "#,
            holder_label,
            claims.sub,
            main_wh,
            payload.main_notes,
            id
        )
        .execute(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "TRANSFER_CORE_RETURN",
                "USED_PART_RETURN",
                Some(&current.return_number),
                Some(json!({
                    "status": "TRANSFERRED_TO_MAIN",
                    "transferred_to_main_by": receiver_name,
                    "main_warehouse": main_wh,
                    "notes": payload.main_notes
                })),
            )
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Part bekas {} berhasil diserahkan dan diterima di Gudang Utama", current.return_number)
        }))
    }

    pub async fn complete_return(
        &self,
        claims: &Claims,
        id: Uuid,
        payload: CompleteReturnRequest,
    ) -> Result<Value, AppError> {
        let current = sqlx::query!(
            "SELECT id, status, return_number FROM used_part_returns WHERE id = $1 FOR UPDATE",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Data retur tidak ditemukan".to_string()))?;

        if current.status == "COMPLETED" {
            return Err(AppError::BadRequest(
                "Data retur ini sudah selesai".to_string(),
            ));
        }

        let disp = payload
            .disposition
            .unwrap_or_else(|| "SCRAPPED".to_string());
        let holder_label = format!("SELESAI ({})", disp);

        sqlx::query!(
            r#"
            UPDATE used_part_returns
            SET status = 'COMPLETED',
                current_holder_type = 'COMPLETED',
                current_holder_name = $1,
                main_notes = COALESCE($2, main_notes),
                updated_at = NOW()
            WHERE id = $3
            "#,
            holder_label,
            payload.final_notes,
            id
        )
        .execute(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "COMPLETE_CORE_RETURN",
                "USED_PART_RETURN",
                Some(&current.return_number),
                Some(json!({
                    "status": "COMPLETED",
                    "disposition": disp,
                    "notes": payload.final_notes
                })),
            )
            .await;

        Ok(json!({
            "success": true,
            "message": format!("Siklus pengembalian part bekas {} telah diselesaikan", current.return_number)
        }))
    }
}
