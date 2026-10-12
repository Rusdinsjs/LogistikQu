use crate::{
    domain::entities::{
        CreateNotificationRequest, EmailNotificationPayload, Notification, NotificationQuery,
        WhatsAppNotificationPayload,
    },
    error::AppError,
    infrastructure::{
        external_services::ExternalNotificationService, repositories::NotificationRepository,
    },
};
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct NotificationService {
    notification_repo: NotificationRepository,
    external_service: ExternalNotificationService,
}

impl NotificationService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            notification_repo: NotificationRepository::new(pool),
            external_service: ExternalNotificationService::new(),
        }
    }

    pub async fn list_notifications(
        &self,
        user_id: Uuid,
        role_id: &str,
        query: NotificationQuery,
    ) -> Result<Vec<Notification>, AppError> {
        self.notification_repo
            .list_notifications(user_id, role_id, &query)
            .await
    }

    pub async fn create_notification(
        &self,
        req: CreateNotificationRequest,
    ) -> Result<Notification, AppError> {
        let channel = req.channel.as_deref().unwrap_or("IN_APP");

        // Dispatch to external channels if needed
        if channel == "WHATSAPP" || channel == "ALL" {
            if let Some(ref phone) = req.recipient_phone {
                let _ = self
                    .external_service
                    .dispatch_whatsapp(&WhatsAppNotificationPayload {
                        to: phone.clone(),
                        message: req.message.clone(),
                        template: Some(req.trigger_type.clone()),
                        title: req.title.clone(),
                    })
                    .await;
            }
        }

        if channel == "EMAIL" || channel == "ALL" {
            if let Some(ref email) = req.recipient_email {
                let _ = self
                    .external_service
                    .dispatch_email(&EmailNotificationPayload {
                        to: email.clone(),
                        subject: req.title.clone(),
                        body: req.message.clone(),
                    })
                    .await;
            }
        }

        // Always persist in-app notification
        self.notification_repo.create_notification(&req).await
    }

    pub async fn mark_as_read(&self, id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        self.notification_repo.mark_as_read(id, user_id).await
    }

    pub async fn mark_all_read(&self, user_id: Uuid, role_id: &str) -> Result<u64, AppError> {
        self.notification_repo.mark_all_read(user_id, role_id).await
    }

    pub async fn get_unread_count(&self, user_id: Uuid, role_id: &str) -> Result<i64, AppError> {
        self.notification_repo
            .get_unread_count(user_id, role_id)
            .await
    }

    // --- Specialized Notification Triggers (Phase 9) ---

    pub async fn trigger_low_stock(
        &self,
        warehouse_id: &str,
        spare_part_id: &str,
        part_name: &str,
        current_stock: Decimal,
        min_stock: Decimal,
        rec_order_qty: Decimal,
    ) -> Result<(), AppError> {
        let title = format!("Peringatan Stok Menipis: {}", part_name);
        let message = format!(
            "Suku cadang {} ({}) di gudang {} tersisa {} (Batas Minimum: {}). Rekomendasi order: {}.",
            part_name, spare_part_id, warehouse_id, current_stock, min_stock, rec_order_qty
        );

        let req = CreateNotificationRequest {
            user_id: None,
            recipient_role: Some("SUPERVISOR_HE".to_string()),
            recipient_email: None,
            recipient_phone: None,
            title,
            message,
            channel: Some("IN_APP".to_string()),
            trigger_type: "LOW_STOCK".to_string(),
            reference_id: Some(spare_part_id.to_string()),
            metadata: Some(json!({
                "warehouse_id": warehouse_id,
                "spare_part_id": spare_part_id,
                "current_stock": current_stock,
                "min_stock": min_stock,
            })),
        };

        let _ = self.create_notification(req).await;
        Ok(())
    }

    pub async fn trigger_approval_request(
        &self,
        request_number: &str,
        container_warehouse_id: &str,
        target_role: &str,
    ) -> Result<(), AppError> {
        let title = format!("Permohonan Menunggu Persetujuan: {}", request_number);
        let message = format!(
            "Permohonan pengadaan stok {} dari gudang {} memerlukan verifikasi dan persetujuan Anda.",
            request_number, container_warehouse_id
        );

        let req = CreateNotificationRequest {
            user_id: None,
            recipient_role: Some(target_role.to_string()),
            recipient_email: None,
            recipient_phone: Some("+628114000003".to_string()),
            title,
            message,
            channel: Some("WHATSAPP".to_string()),
            trigger_type: "APPROVAL_REQUEST".to_string(),
            reference_id: Some(request_number.to_string()),
            metadata: Some(json!({
                "request_number": request_number,
                "container_warehouse_id": container_warehouse_id,
            })),
        };

        let _ = self.create_notification(req).await;
        Ok(())
    }

    pub async fn trigger_approval_completed(
        &self,
        request_number: &str,
        drop_number: &str,
        target_role: &str,
        target_user_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let title = format!("Permohonan Disetujui: {}", request_number);
        let message = format!(
            "Permohonan {} telah disetujui. Dokumen Drop STO {} telah diterbitkan dan dalam proses pengiriman.",
            request_number, drop_number
        );

        let req = CreateNotificationRequest {
            user_id: target_user_id,
            recipient_role: Some(target_role.to_string()),
            recipient_email: Some("logistic.cont@sjsgroup.online".to_string()),
            recipient_phone: None,
            title,
            message,
            channel: Some("EMAIL".to_string()),
            trigger_type: "APPROVAL_COMPLETED".to_string(),
            reference_id: Some(drop_number.to_string()),
            metadata: Some(json!({
                "request_number": request_number,
                "drop_number": drop_number,
            })),
        };

        let _ = self.create_notification(req).await;
        Ok(())
    }

    pub async fn trigger_abnormal_consumption(
        &self,
        unit_number: &str,
        spare_part_id: &str,
        part_name: &str,
        issued_qty: Decimal,
        daily_baseline: Decimal,
    ) -> Result<(), AppError> {
        let title = format!("Deteksi Konsumsi Abnormal: Unit {}", unit_number);
        let message = format!(
            "Pengeluaran suku cadang {} ({}) sebanyak {} untuk unit {} terdeteksi melebihi 3x rata-rata konsumsi harian normal ({}).",
            part_name, spare_part_id, issued_qty, unit_number, daily_baseline
        );

        let req = CreateNotificationRequest {
            user_id: None,
            recipient_role: Some("SUPERVISOR_HE".to_string()),
            recipient_email: None,
            recipient_phone: None,
            title,
            message,
            channel: Some("IN_APP".to_string()),
            trigger_type: "ABNORMAL_CONSUMPTION".to_string(),
            reference_id: Some(unit_number.to_string()),
            metadata: Some(json!({
                "unit_number": unit_number,
                "spare_part_id": spare_part_id,
                "issued_qty": issued_qty,
                "baseline": daily_baseline,
            })),
        };

        let _ = self.create_notification(req).await;
        Ok(())
    }

    pub async fn trigger_rejected_transaction(
        &self,
        ref_number: &str,
        reason: &str,
        target_role: &str,
        target_user_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let title = format!("Transaksi Ditolak: {}", ref_number);
        let message = format!(
            "Pengajuan transaksi {} ditolak dengan alasan: {}",
            ref_number, reason
        );

        let req = CreateNotificationRequest {
            user_id: target_user_id,
            recipient_role: Some(target_role.to_string()),
            recipient_email: None,
            recipient_phone: None,
            title,
            message,
            channel: Some("IN_APP".to_string()),
            trigger_type: "REJECTED_TRANSACTION".to_string(),
            reference_id: Some(ref_number.to_string()),
            metadata: Some(json!({
                "reference_number": ref_number,
                "reason": reason,
            })),
        };

        let _ = self.create_notification(req).await;
        Ok(())
    }
}
