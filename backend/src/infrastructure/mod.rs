pub mod authentication;
pub mod database;
pub mod external_services;
pub mod repositories;

// Backward-compatible module aliases
pub mod auth {
    pub use crate::infrastructure::authentication::*;
}

pub mod db {
    pub use crate::infrastructure::database::*;
}

pub mod numbering {
    #[allow(unused_imports)]
    pub use crate::infrastructure::database::next_document_number;
}
