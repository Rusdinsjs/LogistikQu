use rust_decimal::Decimal;
use rust_decimal_macros::dec;

// Business rule calculations test suite for LogisticQu Enterprise Standard

#[test]
fn test_reorder_point_calculation() {
    // Formula: Reorder Point = (Avg Daily Usage * Lead Time) + Safety Stock
    let avg_daily_usage = dec!(2.5);
    let lead_time_days = dec!(5);
    let safety_stock = dec!(10);

    let reorder_point = (avg_daily_usage * lead_time_days) + safety_stock;
    assert_eq!(reorder_point, dec!(22.5));
}

#[test]
fn test_recommended_order_quantity() {
    // Formula: Recommended Order Qty = Max(0, Max Stock - Current Stock - In Transit)
    let max_stock = dec!(100);
    let current_stock = dec!(25);
    let in_transit_qty = dec!(30);

    let recommended = max_stock - current_stock - in_transit_qty;
    assert_eq!(recommended, dec!(45));

    // When current + in-transit >= max, recommended is 0
    let high_stock = dec!(80);
    let in_transit_high = dec!(30);
    let recommended_zero = Decimal::max(Decimal::ZERO, max_stock - high_stock - in_transit_high);
    assert_eq!(recommended_zero, Decimal::ZERO);
}

#[test]
fn test_abnormal_consumption_rule() {
    let avg_daily_usage = dec!(4.0);
    let threshold_factor = dec!(3.0); // 3x threshold
    let normal_threshold = avg_daily_usage * threshold_factor;

    let transaction_qty_normal = dec!(8.0);
    let is_abnormal_normal = transaction_qty_normal > normal_threshold;
    assert!(
        !is_abnormal_normal,
        "8 PCS is not abnormal for 4 PCS daily avg"
    );

    let transaction_qty_burst = dec!(15.0);
    let is_abnormal_burst = transaction_qty_burst > normal_threshold;
    assert!(is_abnormal_burst, "15 PCS exceeds 3x threshold of 12 PCS");
}

#[test]
fn test_stock_aging_classification() {
    let classify_aging = |days: i64| -> &'static str {
        if days <= 30 {
            "< 30 Hari"
        } else if days <= 90 {
            "31-90 Hari"
        } else if days <= 180 {
            "91-180 Hari"
        } else {
            "> 180 Hari"
        }
    };

    assert_eq!(classify_aging(10), "< 30 Hari");
    assert_eq!(classify_aging(45), "31-90 Hari");
    assert_eq!(classify_aging(120), "91-180 Hari");
    assert_eq!(classify_aging(250), "> 180 Hari");
}

#[test]
fn test_turnover_velocity_classification() {
    let classify_velocity = |issues_30d: Decimal, current_stock: Decimal| -> &'static str {
        if issues_30d == Decimal::ZERO {
            return "NON_MOVING";
        }
        if current_stock == Decimal::ZERO {
            return "FAST_MOVING";
        }
        let ratio = issues_30d / current_stock;
        if ratio >= dec!(0.5) {
            "FAST_MOVING"
        } else if ratio >= dec!(0.2) {
            "MODERATE"
        } else {
            "SLOW_MOVING"
        }
    };

    assert_eq!(classify_velocity(dec!(0), dec!(100)), "NON_MOVING");
    assert_eq!(classify_velocity(dec!(60), dec!(100)), "FAST_MOVING");
    assert_eq!(classify_velocity(dec!(30), dec!(100)), "MODERATE");
    assert_eq!(classify_velocity(dec!(10), dec!(100)), "SLOW_MOVING");
}

#[test]
fn test_stock_movement_balance_integrity() {
    let initial_balance = dec!(100);
    let issue_qty = dec!(15);
    let balance_after_issue = initial_balance - issue_qty;
    assert_eq!(balance_after_issue, dec!(85));

    let drop_in_qty = dec!(50);
    let balance_after_drop = balance_after_issue + drop_in_qty;
    assert_eq!(balance_after_drop, dec!(135));
}
