use crate::{
    domain::{
        business_rules::TraceabilityRules,
        entities::{
            CreateAdjustmentRequest, CreateIssueRequest, CreateReplenishmentRequest,
            CreateUserRequest,
        },
    },
    error::AppError,
};
use rust_decimal::Decimal;

pub struct IssueValidator;

impl IssueValidator {
    pub fn validate(req: &CreateIssueRequest) -> Result<(), AppError> {
        if req.items.is_empty() {
            return Err(AppError::ValidationError(
                "Minimal harus ada 1 item spare part yang dikeluarkan".to_string(),
            ));
        }

        for item in &req.items {
            if item.qty <= Decimal::ZERO {
                return Err(AppError::ValidationError(format!(
                    "Jumlah pengeluaran part {} harus lebih besar dari 0",
                    item.spare_part_id
                )));
            }
        }

        TraceabilityRules::validate_issue_traceability(
            &req.unit_number,
            &req.receiver_name,
            &req.mechanic_name,
            &req.site_id,
            req.hm_km,
        )?;

        Ok(())
    }
}

pub struct ReplenishmentValidator;

impl ReplenishmentValidator {
    pub fn validate(req: &CreateReplenishmentRequest) -> Result<(), AppError> {
        if req.items.is_empty() {
            return Err(AppError::ValidationError(
                "Minimal harus ada 1 item yang diajukan dalam permohonan".to_string(),
            ));
        }

        for item in &req.items {
            if item.requested_qty <= Decimal::ZERO {
                return Err(AppError::ValidationError(format!(
                    "Jumlah permohonan part {} harus lebih besar dari 0",
                    item.spare_part_id
                )));
            }
        }

        Ok(())
    }
}

pub struct AdjustmentValidator;

impl AdjustmentValidator {
    pub fn validate(req: &CreateAdjustmentRequest) -> Result<(), AppError> {
        if req.items.is_empty() {
            return Err(AppError::ValidationError(
                "Minimal harus ada 1 item yang disesuaikan dalam opname".to_string(),
            ));
        }

        if req.reason.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Alasan penyesuaian stok opname wajib diisi".to_string(),
            ));
        }

        for item in &req.items {
            if item.qty_physical < Decimal::ZERO {
                return Err(AppError::ValidationError(format!(
                    "Jumlah fisik part {} tidak boleh bernilai negatif",
                    item.spare_part_id
                )));
            }
        }

        Ok(())
    }
}

pub struct UserValidator;

impl UserValidator {
    pub fn validate_password(password: &str) -> Result<(), AppError> {
        if password.len() < 8 {
            return Err(AppError::ValidationError(
                "Kebijakan Password: Minimal 8 karakter".to_string(),
            ));
        }

        let has_letter = password.chars().any(|c| c.is_alphabetic());
        let has_digit = password.chars().any(|c| c.is_ascii_digit());

        if !has_letter || !has_digit {
            return Err(AppError::ValidationError(
                "Kebijakan Password: Harus mengombinasikan huruf dan angka".to_string(),
            ));
        }

        Ok(())
    }

    pub fn validate_create(req: &CreateUserRequest) -> Result<(), AppError> {
        if req.username.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Username tidak boleh kosong".to_string(),
            ));
        }

        Self::validate_password(&req.password)?;

        if req.full_name.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Nama lengkap tidak boleh kosong".to_string(),
            ));
        }

        Ok(())
    }
}

pub struct StockTransferValidator;

impl StockTransferValidator {
    pub fn validate(req: &crate::domain::entities::StockTransferRequest) -> Result<(), AppError> {
        if req.from_warehouse_id.trim().is_empty() || req.to_warehouse_id.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Gudang asal dan gudang tujuan wajib diisi".into(),
            ));
        }
        if req.from_warehouse_id.trim() == req.to_warehouse_id.trim() {
            return Err(AppError::ValidationError(
                "Gudang asal dan tujuan tidak boleh sama".into(),
            ));
        }
        if req.spare_part_id.trim().is_empty() {
            return Err(AppError::ValidationError("Part ID wajib diisi".into()));
        }
        if req.qty <= Decimal::ZERO {
            return Err(AppError::ValidationError(
                "Jumlah mutasi harus lebih besar dari 0".into(),
            ));
        }
        Ok(())
    }
}

pub struct StockWriteOffValidator;

impl StockWriteOffValidator {
    pub fn validate(req: &crate::domain::entities::StockWriteOffRequest) -> Result<(), AppError> {
        if req.warehouse_id.trim().is_empty() {
            return Err(AppError::ValidationError("Gudang wajib diisi".into()));
        }
        if req.spare_part_id.trim().is_empty() {
            return Err(AppError::ValidationError("Part ID wajib diisi".into()));
        }
        let mtype = req.movement_type.to_uppercase();
        if mtype != "DAMAGE" && mtype != "LOST" {
            return Err(AppError::ValidationError(
                "Tipe write-off harus 'DAMAGE' atau 'LOST'".into(),
            ));
        }
        if req.qty <= Decimal::ZERO {
            return Err(AppError::ValidationError(
                "Jumlah write-off harus lebih besar dari 0".into(),
            ));
        }
        if req.notes.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Alasan/keterangan write-off wajib dicantumkan".into(),
            ));
        }
        Ok(())
    }
}
