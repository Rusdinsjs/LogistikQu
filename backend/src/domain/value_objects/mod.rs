#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DocumentType {
    Issue,
    ReplenishmentRequest,
    MainWarehouseDrop,
    StockAdjustment,
    UsedPartReturn,
}

impl DocumentType {
    pub fn prefix(&self) -> &'static str {
        match self {
            DocumentType::Issue => "ISS",
            DocumentType::ReplenishmentRequest => "REQ",
            DocumentType::MainWarehouseDrop => "DROP",
            DocumentType::StockAdjustment => "ADJ",
            DocumentType::UsedPartReturn => "RET",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Priority {
    LOW,
    MEDIUM,
    HIGH,
    EMERGENCY,
}

impl Priority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Priority::LOW => "LOW",
            Priority::MEDIUM => "MEDIUM",
            Priority::HIGH => "HIGH",
            Priority::EMERGENCY => "EMERGENCY",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReplenishmentStatus {
    Requested,
    Verified,
    Approved,
    ReturnedToMainAdmin,
    ReturnedToContainerAdmin,
    InTransit,
    Completed,
}

impl ReplenishmentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReplenishmentStatus::Requested => "REQUESTED",
            ReplenishmentStatus::Verified => "VERIFIED",
            ReplenishmentStatus::Approved => "APPROVED",
            ReplenishmentStatus::ReturnedToMainAdmin => "RETURNED_TO_MAIN_ADMIN",
            ReplenishmentStatus::ReturnedToContainerAdmin => "RETURNED_TO_CONTAINER_ADMIN",
            ReplenishmentStatus::InTransit => "IN_TRANSIT",
            ReplenishmentStatus::Completed => "COMPLETED",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StockStatus {
    Normal,
    Warning,
    Critical,
}

impl StockStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            StockStatus::Normal => "NORMAL",
            StockStatus::Warning => "WARNING",
            StockStatus::Critical => "CRITICAL",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StockMovementType {
    Receive,
    Issue,
    Transfer,
    Return,
    Adjustment,
    Damage,
    Lost,
    InitialImport,
}

impl StockMovementType {
    pub fn as_str(&self) -> &'static str {
        match self {
            StockMovementType::Receive => "RECEIVE",
            StockMovementType::Issue => "ISSUE",
            StockMovementType::Transfer => "TRANSFER",
            StockMovementType::Return => "RETURN",
            StockMovementType::Adjustment => "ADJUSTMENT",
            StockMovementType::Damage => "DAMAGE",
            StockMovementType::Lost => "LOST",
            StockMovementType::InitialImport => "INITIAL_IMPORT",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "RECEIVE" | "DROP_IN" => Some(StockMovementType::Receive),
            "ISSUE" | "ISSUE_OUT" => Some(StockMovementType::Issue),
            "TRANSFER" => Some(StockMovementType::Transfer),
            "RETURN" => Some(StockMovementType::Return),
            "ADJUSTMENT" => Some(StockMovementType::Adjustment),
            "DAMAGE" => Some(StockMovementType::Damage),
            "LOST" => Some(StockMovementType::Lost),
            "INITIAL_IMPORT" => Some(StockMovementType::InitialImport),
            _ => None,
        }
    }

    pub fn is_deduction(&self) -> bool {
        matches!(
            self,
            StockMovementType::Issue | StockMovementType::Damage | StockMovementType::Lost
        )
    }

    pub fn is_addition(&self) -> bool {
        matches!(
            self,
            StockMovementType::Receive
                | StockMovementType::Return
                | StockMovementType::InitialImport
        )
    }
}
