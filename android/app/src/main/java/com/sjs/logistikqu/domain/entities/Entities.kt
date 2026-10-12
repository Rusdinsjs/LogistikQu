package com.sjs.logistikqu.domain.entities

data class User(
    val id: String,
    val username: String,
    val fullName: String,
    val role: String,
    val warehouseId: String?,
    val token: String,
    val refreshToken: String,
    val permissions: List<String> = emptyList()
) {
    val normalizedRole: String get() = role.uppercase()
    val isSupervisor: Boolean get() = normalizedRole.contains("SUPERVISOR") || normalizedRole.contains("MANAGER") || normalizedRole == "SUPER_ADMIN" || normalizedRole == "SUPERADMIN"
    val isContainerAdmin: Boolean get() = normalizedRole.contains("CONTAINER") || normalizedRole.contains("ADMIN_CONT") || normalizedRole == "SUPER_ADMIN" || normalizedRole == "SUPERADMIN"
    val isMainAdmin: Boolean get() = normalizedRole.contains("MAIN_ADMIN") || normalizedRole.contains("ADMIN_MAIN") || normalizedRole.contains("MAIN") || normalizedRole == "SUPER_ADMIN" || normalizedRole == "SUPERADMIN"
    val isMechanic: Boolean get() = normalizedRole.contains("MECHANIC") || normalizedRole.contains("MEKANIK")
    val isSuperAdmin: Boolean get() = normalizedRole == "SUPERADMIN" || normalizedRole == "SUPER_ADMIN" || normalizedRole == "MANAGER"

    fun hasPermission(permission: String): Boolean {
        if (isSuperAdmin) return true
        return permissions.contains(permission)
    }
}

data class SparePart(
    val id: String,
    val partNumber: String,
    val name: String,
    val categoryName: String,
    val brand: String,
    val uom: String,
    val unitCost: Double,
    val minStock: Double,
    val maxStock: Double,
    val safetyStock: Double,
    val isCritical: Boolean
)

data class InventoryStock(
    val id: String,
    val warehouseId: String,
    val sparePartId: String,
    val partNumber: String,
    val partName: String,
    val uom: String,
    val qtyOnHand: Double,
    val binCode: String?,
    val zone: String?,
    val shelfLevel: String?,
    val batchNumber: String?,
    val serialNumber: String?,
    val status: String // NORMAL, LOW, CRITICAL
)

data class Equipment(
    val id: String,
    val unitNumber: String,
    val equipmentNumber: String,
    val name: String,
    val model: String,
    val currentHmKm: Double,
    val currentSiteId: String,
    val isActive: Boolean
)

enum class SyncStatus {
    PENDING,
    PROCESSING,
    SUCCESS,
    FAILED,
    CONFLICT;

    companion object {
        val IN_PROGRESS get() = PROCESSING
        val SYNCED get() = SUCCESS
    }
}

enum class TransactionType {
    ISSUE,
    RECEIVE,
    TRANSFER,
    STOCK_CHECK,
    ADJUSTMENT,
    RETURN
}

data class SyncProcessResult(
    val successCount: Int = 0,
    val failedCount: Int = 0,
    val conflictCount: Int = 0
) {
    val isAllSuccess: Boolean get() = failedCount == 0 && conflictCount == 0
}

data class SyncQueueItem(
    val id: String,
    val transactionType: String,
    val payload: String, // Serialized JSON
    val status: String,
    val retryCount: Int,
    val createdAt: Long,
    val updatedAt: Long = System.currentTimeMillis(),
    val errorMessage: String? = null
)

data class IssueTransaction(
    val localId: String,
    val warehouseId: String,
    val siteId: String,
    val unitNumber: String,
    val currentHmKm: Double,
    val mechanicName: String,
    val receiverName: String,
    val workOrderNumber: String,
    val maintenanceType: String,
    val priority: String,
    val sparePartId: String,
    val qty: Double,
    val evidencePhotoPath: String?,
    val latitude: Double?,
    val longitude: Double?,
    val timestamp: Long,
    val signatureType: String = "DIGITAL",
    val mechanicSignatureUrl: String? = null,
    val receiptPrinted: Boolean = true,
    val signedReceiptPhotoUrl: String? = null
)

data class GoodsReceipt(
    val localId: String,
    val replenishmentRequestId: String,
    val dropNumber: String,
    val containerWarehouseId: String,
    val receivedBy: String,
    val notes: String,
    val proofPhotoPath: String?,
    val timestamp: Long,
    val sparePartId: String? = null,
    val receivedQty: Double? = null,
    val targetBinCode: String? = null
)

data class WarehouseTransfer(
    val localId: String,
    val sourceWarehouseId: String,
    val destinationWarehouseId: String,
    val sparePartId: String,
    val qty: Double,
    val notes: String,
    val timestamp: Long
)

enum class BarcodeType {
    PART,
    EQUIPMENT,
    LOCATION_BIN,
    SHIPMENT_DOC,
    UNKNOWN
}

data class BarcodeScanResult(
    val rawValue: String,
    val type: BarcodeType,
    val extractedCode: String
)

data class ReplenishmentRecommendation(
    val sparePartId: String,
    val partName: String,
    val unitOfMeasure: String,
    val currentStock: Double,
    val minStock: Double,
    val maxStock: Double,
    val safetyStock: Double,
    val leadTimeDays: Int,
    val avgDailyUsage: Double,
    val recommendedOrderQty: Double,
    val reorderPoint: Double?,
    val consumptionTrend: String?
)

data class ReplenishmentDraftItem(
    val sparePartId: String,
    val partName: String,
    val unitOfMeasure: String,
    val currentStock: Double,
    val recommendedQty: Double,
    val requestedQty: Double,
    val notes: String = ""
)

data class WarehouseBin(
    val id: String,
    val warehouseId: String,
    val binCode: String,
    val zone: String,
    val shelfLevel: String,
    val capacityParts: Int,
    val currentItemsCount: Long,
    val totalQty: Double,
    val description: String?
)

