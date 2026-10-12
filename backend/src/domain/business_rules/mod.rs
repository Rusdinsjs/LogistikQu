#![allow(dead_code)]

use crate::error::AppError;
use rust_decimal::Decimal;

/// Mining Traceability Business Rules (BR-001 s/d BR-004)
pub struct TraceabilityRules;

impl TraceabilityRules {
    /// BR-001 & BR-002: Memastikan data unit, receiver, dan mekanik lengkap sebelum barang dikeluarkan
    pub fn validate_issue_traceability(
        unit_number: &str,
        receiver_name: &str,
        mechanic_name: &str,
        site_id: &str,
        hm_km: Option<Decimal>,
    ) -> Result<(), AppError> {
        if unit_number.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Traceability BR-001: Nomor Unit Alat Berat / Dump Truck wajib diisi".to_string(),
            ));
        }

        if receiver_name.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Traceability BR-002: Nama Penerima Barang wajib diisi".to_string(),
            ));
        }

        if mechanic_name.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Traceability BR-003: Nama Mekanik yang bertugas wajib diisi".to_string(),
            ));
        }

        if site_id.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Traceability BR-004: Site Tambang / Pit Lokasi wajib dipilih".to_string(),
            ));
        }

        if let Some(val) = hm_km {
            if val < Decimal::ZERO {
                return Err(AppError::ValidationError(
                    "HM/KM tidak boleh bernilai negatif".to_string(),
                ));
            }
        }

        Ok(())
    }
}

/// Aturan Perhitungan Rekomendasi Pemesanan Ulang (Replenishment)
pub struct ReplenishmentRules;

impl ReplenishmentRules {
    /// Formula Phase 7:
    /// Reorder Point = (Average Daily Usage x Lead Time) + Safety Stock
    pub fn calculate_reorder_point(
        avg_daily_usage: Decimal,
        lead_time_days: i32,
        safety_stock: Decimal,
    ) -> Decimal {
        let lead_time_dec = Decimal::from(lead_time_days);
        (avg_daily_usage * lead_time_dec) + safety_stock
    }

    /// Formula Phase 7:
    /// Automatic Recommendation:
    /// Effective Stock = Current Stock + In Transit
    /// Jika Effective Stock <= Reorder Point:
    ///   Recommended Purchase Qty = max(0, Max Stock - Effective Stock)
    /// Jika Effective Stock > Reorder Point:
    ///   Recommended Purchase Qty = 0
    pub fn calculate_recommended_purchase_qty(
        current_stock: Decimal,
        in_transit_qty: Decimal,
        reorder_point: Decimal,
        max_stock: Decimal,
    ) -> Decimal {
        let effective_stock = current_stock + in_transit_qty;
        if effective_stock <= reorder_point {
            let needed = max_stock - effective_stock;
            if needed > Decimal::ZERO {
                needed
            } else {
                Decimal::ZERO
            }
        } else {
            Decimal::ZERO
        }
    }

    /// Formula Phase 7: Demand Forecasting - Consumption Trend
    /// Membandingkan pemakaian 30 hari terakhir dengan 30 hari sebelumnya (hari 31-60)
    pub fn calculate_trend(recent_30d: Decimal, prior_30d: Decimal) -> (Decimal, &'static str) {
        if prior_30d <= Decimal::ZERO {
            if recent_30d > Decimal::ZERO {
                return (Decimal::new(100, 0), "UPWARD (NEW DEMAND)");
            } else {
                return (Decimal::ZERO, "STABLE (NO USAGE)");
            }
        }

        let diff = recent_30d - prior_30d;
        let percentage = (diff / prior_30d) * Decimal::from(100);

        let direction = if percentage >= Decimal::new(10, 0) {
            "UPWARD"
        } else if percentage <= Decimal::new(-10, 0) {
            "DOWNWARD"
        } else {
            "STABLE"
        };

        (percentage.round_dp(1), direction)
    }

    /// Formula Phase 7: Demand Forecasting - Seasonal Analysis (Siklus Tambang Tropis)
    /// Periode Hujan (Okt - Mar) vs Kemarau / Puncak Hauling (Apr - Sep)
    pub fn get_seasonal_analysis(month: u32, category: &str) -> (Decimal, &'static str) {
        let is_wet_season = matches!(month, 10 | 11 | 12 | 1 | 2 | 3);
        let cat_upper = category.to_uppercase();

        if is_wet_season {
            if cat_upper.contains("HYDRAULIC") || cat_upper.contains("BRAKE") {
                (Decimal::new(115, 2), "WET_SEASON (HIGH MUD/WEAR)")
            } else {
                (Decimal::new(105, 2), "WET_SEASON")
            }
        } else {
            if cat_upper.contains("FILTER")
                || cat_upper.contains("LUBRICANT")
                || cat_upper.contains("ENGINE")
            {
                (Decimal::new(120, 2), "DRY_SEASON (HIGH HAUL/DUST)")
            } else {
                (Decimal::new(100, 2), "DRY_SEASON (NORMAL)")
            }
        }
    }

    /// Menghitung Qty Rekomendasi berdasarkan Min-Max dan Safety Stock (Backward Compatible)
    pub fn calculate_recommended_order_qty(
        current_stock: Decimal,
        min_stock: Decimal,
        max_stock: Decimal,
    ) -> Decimal {
        if current_stock <= min_stock {
            let diff = max_stock - current_stock;
            if diff > Decimal::ZERO {
                diff
            } else {
                Decimal::ZERO
            }
        } else {
            Decimal::ZERO
        }
    }

    /// Validasi transisi status alur permohonan stok
    pub fn validate_transition(current_status: &str, target_status: &str) -> Result<(), AppError> {
        let valid = match (current_status, target_status) {
            ("REQUESTED", "VERIFIED") => true,
            ("REQUESTED", "RETURNED_TO_CONTAINER_ADMIN") => true,
            ("VERIFIED", "APPROVED") => true,
            ("VERIFIED", "RETURNED_TO_MAIN_ADMIN") => true,
            ("RETURNED_TO_MAIN_ADMIN", "VERIFIED") => true,
            ("RETURNED_TO_MAIN_ADMIN", "RETURNED_TO_CONTAINER_ADMIN") => true,
            ("RETURNED_TO_CONTAINER_ADMIN", "REQUESTED") => true,
            ("APPROVED", "IN_TRANSIT") => true,
            ("IN_TRANSIT", "COMPLETED") => true,
            _ => false,
        };

        if !valid {
            return Err(AppError::BadRequest(format!(
                "Transisi status permohonan tidak valid: {} -> {}",
                current_status, target_status
            )));
        }

        Ok(())
    }
}

/// Aturan Penentuan Status Stok Kontainer
pub struct StockRules;

impl StockRules {
    pub fn determine_stock_status(qty_on_hand: Decimal, min_stock: Decimal) -> &'static str {
        if qty_on_hand <= min_stock {
            "CRITICAL"
        } else if qty_on_hand <= (min_stock * Decimal::new(125, 2)) {
            "WARNING"
        } else {
            "NORMAL"
        }
    }
}

/// Aturan Peringatan dan Triger Notifikasi (Phase 9)
pub struct NotificationRules;

impl NotificationRules {
    pub fn is_abnormal_consumption(issued_qty: Decimal, avg_daily_usage: Decimal) -> bool {
        let baseline = if avg_daily_usage > Decimal::ZERO {
            avg_daily_usage
        } else {
            Decimal::ONE
        };

        issued_qty >= (baseline * Decimal::from(3)) && issued_qty >= Decimal::from(5)
    }

    pub fn is_low_stock(qty_on_hand: Decimal, min_stock: Decimal) -> bool {
        qty_on_hand <= min_stock
    }
}

/// Aturan Kecepatan dan Penuaan Stok (Phase 10)
pub struct KpiRules;

impl KpiRules {
    pub fn classify_velocity(issued_30d: Decimal, issue_frequency: i64) -> &'static str {
        if issued_30d >= Decimal::from(20) || issue_frequency >= 5 {
            "FAST_MOVING"
        } else if issued_30d >= Decimal::from(5) || issue_frequency >= 2 {
            "MODERATE"
        } else if issued_30d > Decimal::ZERO {
            "SLOW_MOVING"
        } else {
            "NON_MOVING"
        }
    }

    pub fn classify_aging(days_since_movement: i64) -> &'static str {
        if days_since_movement <= 30 {
            "UNDER_30_DAYS"
        } else if days_since_movement <= 90 {
            "31_TO_90_DAYS"
        } else if days_since_movement <= 180 {
            "91_TO_180_DAYS"
        } else {
            "OVER_180_DAYS"
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_traceability_validation() {
        let res = TraceabilityRules::validate_issue_traceability(
            "EX-201",
            "Agus",
            "Yusuf",
            "SITE-VALE-C",
            Some(Decimal::new(1200, 0)),
        );
        assert!(res.is_ok());

        let res_fail = TraceabilityRules::validate_issue_traceability(
            "",
            "Agus",
            "Yusuf",
            "SITE-VALE-C",
            None,
        );
        assert!(res_fail.is_err());
    }

    #[test]
    fn test_replenishment_calculation() {
        let rec = ReplenishmentRules::calculate_recommended_order_qty(
            Decimal::new(5, 0),
            Decimal::new(10, 0),
            Decimal::new(50, 0),
        );
        assert_eq!(rec, Decimal::new(45, 0));

        let rec_no_order = ReplenishmentRules::calculate_recommended_order_qty(
            Decimal::new(15, 0),
            Decimal::new(10, 0),
            Decimal::new(50, 0),
        );
        assert_eq!(rec_no_order, Decimal::ZERO);
    }
}
