use crate::{
    domain::entities::{EmailNotificationPayload, WhatsAppNotificationPayload},
    error::AppError,
};

#[derive(Clone, Default)]
pub struct ExternalNotificationService;

impl ExternalNotificationService {
    pub fn new() -> Self {
        Self
    }

    /// WhatsApp-ready API Dispatcher (Wablas / Fonnte / WhatsApp Business API Standard)
    pub async fn dispatch_whatsapp(
        &self,
        payload: &WhatsAppNotificationPayload,
    ) -> Result<(), AppError> {
        tracing::info!(
            target: "notification::whatsapp",
            "📱 [WA-READY API GATEWAY] Mengirim pesan ke {} | Judul: {} | Konten: {}",
            payload.to,
            payload.title,
            payload.message
        );
        // Di lingkungan operasional nyata, HTTP POST request dikirim ke endpoint webhook WA
        // misal: reqwest::Client::new().post(&wa_gateway_url).json(&payload).send().await
        Ok(())
    }

    /// Enterprise SMTP / Email Dispatcher
    pub async fn dispatch_email(&self, payload: &EmailNotificationPayload) -> Result<(), AppError> {
        tracing::info!(
            target: "notification::email",
            "📧 [EMAIL ENGINE] Mengirim email ke {} | Subjek: {} | Isi: {}",
            payload.to,
            payload.subject,
            payload.body
        );
        // Di lingkungan operasional nyata, SMTP mailer (lettre / AWS SES) mengirim email HTML
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn notify_critical_issue(
        &self,
        transaction_number: &str,
        unit_number: &str,
        part_name: &str,
    ) -> Result<(), AppError> {
        tracing::info!(
            "🔔 [NOTIFICATION SERVICE] Pengeluaran part kritis diajukan: Tx={}, Unit={}, Part={}",
            transaction_number,
            unit_number,
            part_name
        );
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn notify_low_stock(
        &self,
        warehouse_id: &str,
        part_name: &str,
        qty: rust_decimal::Decimal,
    ) -> Result<(), AppError> {
        tracing::warn!(
            "⚠️ [NOTIFICATION SERVICE] Stok kritis di {}: Part={}, Sisa={}",
            warehouse_id,
            part_name,
            qty
        );
        Ok(())
    }
}
