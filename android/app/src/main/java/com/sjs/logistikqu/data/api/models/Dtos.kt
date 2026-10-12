package com.sjs.logistikqu.data.api.models

import com.google.gson.annotations.SerializedName

// Auth DTOs
data class LoginRequestDto(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String,
    @SerializedName("device_id") val deviceId: String? = null
)

data class LoginResponseDto(
    @SerializedName("token") val token: String,
    @SerializedName("refresh_token") val refreshToken: String,
    @SerializedName("user") val user: UserProfileDto
)

data class RefreshTokenRequestDto(
    @SerializedName("refresh_token") val refreshToken: String
)

data class RefreshTokenResponseDto(
    @SerializedName("token") val token: String,
    @SerializedName("refresh_token") val refreshToken: String?
)

data class UserWarehouseDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("warehouse_type") val warehouseType: String? = null
)

data class UserProfileDto(
    @SerializedName("id") val id: String,
    @SerializedName("username") val username: String,
    @SerializedName("full_name") val fullName: String,
    @SerializedName("role") val role: String? = null,
    @SerializedName("role_id") val roleId: String? = null,
    @SerializedName("role_name") val roleName: String? = null,
    @SerializedName("warehouse_id") val warehouseId: String? = null,
    @SerializedName("warehouses") val warehouses: List<UserWarehouseDto>? = null,
    @SerializedName("permissions") val permissions: List<String>? = null
) {
    val effectiveRole: String get() = role ?: roleId ?: roleName ?: "SUPER_ADMIN"
    val effectiveWarehouseId: String? get() = warehouseId ?: warehouses?.firstOrNull()?.id ?: "WH-CONT-HE"
    val effectivePermissions: List<String> get() = permissions ?: emptyList()
}

// Stock & Inventory DTOs
data class StockItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("warehouse_id") val warehouseId: String,
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("part_number") val partNumber: String? = null,
    @SerializedName("part_name") val partName: String,
    @SerializedName("uom") val uom: String? = null,
    @SerializedName("unit_of_measure") val unitOfMeasure: String? = null,
    @SerializedName("qty_on_hand") val qtyOnHand: Double,
    @SerializedName("bin_code") val binCode: String? = null,
    @SerializedName("zone") val zone: String? = null,
    @SerializedName("shelf_level") val shelfLevel: String? = null,
    @SerializedName("batch_number") val batchNumber: String? = null,
    @SerializedName("serial_number") val serialNumber: String? = null,
    @SerializedName("status") val status: String,
    @SerializedName("min_stock") val minStock: Double? = null
) {
    val effectiveUom: String get() = uom ?: unitOfMeasure ?: "PCS"
    val effectivePartNumber: String get() = partNumber ?: sparePartId
}

// Mobile Batch Sync Request & Response DTOs
data class MobileBatchSyncRequestDto(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("user_id") val userId: String? = null,
    @SerializedName("warehouse_id") val warehouseId: String? = null,
    @SerializedName("transactions") val transactions: List<MobileBatchTransactionItemDto>
)

data class MobileBatchTransactionItemDto(
    @SerializedName("id") val id: String, // UUID
    @SerializedName("type") val type: String, // ISSUE, RECEIVE, TRANSFER, ADJUSTMENT, RETURN
    @SerializedName("payload") val payload: Any, // JSON Object
    @SerializedName("timestamp") val timestamp: Long
)

data class MobileBatchSyncResponseDto(
    @SerializedName("success") val success: List<String>,
    @SerializedName("failed") val failed: List<SyncFailedDto>,
    @SerializedName("conflict") val conflict: List<SyncConflictDto>
)

data class SyncFailedDto(
    @SerializedName("id") val id: String,
    @SerializedName("error") val error: String
)

data class SyncConflictDto(
    @SerializedName("id") val id: String,
    @SerializedName("reason") val reason: String,
    @SerializedName("server_stock") val serverStock: Double,
    @SerializedName("client_stock") val clientStock: Double
)

// Pending Drops & Notifications DTOs
data class PendingDropDto(
    @SerializedName("drop_id") val dropId: String,
    @SerializedName("drop_number") val dropNumber: String,
    @SerializedName("request_id") val requestId: String,
    @SerializedName("request_number") val requestNumber: String,
    @SerializedName("source_warehouse_id") val sourceWarehouseId: String,
    @SerializedName("target_warehouse_id") val targetWarehouseId: String,
    @SerializedName("status") val status: String,
    @SerializedName("total_items") val totalItems: Int,
    @SerializedName("shipped_at") val shippedAt: String
)

data class MobileNotificationDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("message") val message: String,
    @SerializedName("channel") val channel: String,
    @SerializedName("trigger_type") val triggerType: String,
    @SerializedName("reference_id") val referenceId: String?,
    @SerializedName("is_read") val isRead: Boolean,
    @SerializedName("created_at") val createdAt: String
)

data class NotificationUnreadCountDto(
    @SerializedName("unread_count") val unreadCount: Int
)

// Mobile Delta Pull DTOs
data class MobileDeltaPullResponseDto(
    @SerializedName("server_time") val serverTime: String,
    @SerializedName("server_timestamp") val serverTimestamp: Long,
    @SerializedName("inventory_changes") val inventoryChanges: List<StockItemDto>,
    @SerializedName("user_permissions") val userPermissions: List<String>,
    @SerializedName("pending_drops") val pendingDrops: List<PendingDropDto>? = null,
    @SerializedName("recent_notifications") val recentNotifications: List<MobileNotificationDto>? = null
)

// Conflict Resolution Request DTO
data class ConflictResolutionRequestDto(
    @SerializedName("conflict_id") val conflictId: String,
    @SerializedName("resolution") val resolution: String, // OVERRIDE, REJECT
    @SerializedName("notes") val notes: String? = null
)

// Generic API response
data class ApiResponseDto<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: T?
)

// Issue Transaction DTOs
data class IssueRequestDto(
    @SerializedName("warehouse_id") val warehouseId: String,
    @SerializedName("site_id") val siteId: String?,
    @SerializedName("receiver_name") val receiverName: String?,
    @SerializedName("unit_number") val unitNumber: String?,
    @SerializedName("hm_km") val hmKm: Double?,
    @SerializedName("mechanic_name") val mechanicName: String?,
    @SerializedName("work_order_number") val workOrderNumber: String?,
    @SerializedName("maintenance_type") val maintenanceType: String?,
    @SerializedName("priority") val priority: String?,
    @SerializedName("items") val items: List<IssueItemDto>,
    @SerializedName("latitude") val latitude: Double?,
    @SerializedName("longitude") val longitude: Double?,
    @SerializedName("signature_type") val signatureType: String? = "DIGITAL",
    @SerializedName("mechanic_signature_url") val mechanicSignatureUrl: String? = null,
    @SerializedName("receipt_printed") val receiptPrinted: Boolean? = true,
    @SerializedName("signed_receipt_photo_url") val signedReceiptPhotoUrl: String? = null
)

data class RecordReceiptPrintedRequestDto(
    @SerializedName("printed_by") val printedBy: String? = null,
    @SerializedName("signed_receipt_photo_url") val signedReceiptPhotoUrl: String? = null,
    @SerializedName("notes") val notes: String? = null
)

data class IssueItemDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("qty") val qty: Double
)

// Replenishment DTOs
data class ReplenishmentRecommendationDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("part_name") val partName: String,
    @SerializedName("unit_of_measure") val unitOfMeasure: String,
    @SerializedName("current_stock") val currentStock: Double,
    @SerializedName("min_stock") val minStock: Double,
    @SerializedName("max_stock") val maxStock: Double,
    @SerializedName("safety_stock") val safetyStock: Double,
    @SerializedName("lead_time_days") val leadTimeDays: Int,
    @SerializedName("avg_daily_usage") val avgDailyUsage: Double,
    @SerializedName("recommended_order_qty") val recommendedOrderQty: Double,
    @SerializedName("reorder_point") val reorderPoint: Double? = null,
    @SerializedName("consumption_trend") val consumptionTrend: String? = null
)

data class CreateReplenishmentRequestDto(
    @SerializedName("container_warehouse_id") val containerWarehouseId: String,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("items") val items: List<CreateReplenishmentItemDto>
)

data class CreateReplenishmentItemDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("requested_qty") val requestedQty: Double,
    @SerializedName("recommended_qty") val recommendedQty: Double? = null,
    @SerializedName("notes") val notes: String? = null
)

// Warehouse Bin & Guided Put-Away DTOs
data class WarehouseBinItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("warehouse_id") val warehouseId: String,
    @SerializedName("bin_code") val binCode: String,
    @SerializedName("zone") val zone: String? = null,
    @SerializedName("shelf_level") val shelfLevel: String? = null,
    @SerializedName("capacity_parts") val capacityParts: Int? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("is_active") val isActive: Boolean = true,
    @SerializedName("current_items_count") val currentItemsCount: Long? = null,
    @SerializedName("total_qty") val totalQty: Double? = null
)

data class RelocateStockBinRequestDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("target_bin_code") val targetBinCode: String? = null
)

// ============================================================================
// Mechanic Stock Request DTOs
// ============================================================================

data class MechanicRequestDto(
    @SerializedName("id") val id: String,
    @SerializedName("request_number") val requestNumber: String,
    @SerializedName("request_type") val requestType: String,
    @SerializedName("warehouse_id") val warehouseId: String,
    @SerializedName("site_id") val siteId: String? = null,
    @SerializedName("status") val status: String,
    @SerializedName("unit_number") val unitNumber: String? = null,
    @SerializedName("unit_name") val unitName: String? = null,
    @SerializedName("unit_type") val unitType: String? = null,
    @SerializedName("ct_number") val ctNumber: String? = null,
    @SerializedName("serial_number") val serialNumber: String? = null,
    @SerializedName("hm_km") val hmKm: String? = null,
    @SerializedName("work_order_number") val workOrderNumber: String? = null,
    @SerializedName("maintenance_type") val maintenanceType: String? = null,
    @SerializedName("priority") val priority: String = "NORMAL",
    @SerializedName("mechanic_id") val mechanicId: String? = null,
    @SerializedName("mechanic_name") val mechanicName: String,
    @SerializedName("requester_user_id") val requesterUserId: String? = null,
    @SerializedName("requester_name") val requesterName: String? = null,
    @SerializedName("input_channel") val inputChannel: String = "MECHANIC",
    @SerializedName("damage_category") val damageCategory: String? = null,
    @SerializedName("damage_description") val damageDescription: String? = null,
    @SerializedName("damage_photo_url") val damagePhotoUrl: String? = null,
    @SerializedName("old_part_photo_url") val oldPartPhotoUrl: String? = null,
    @SerializedName("return_reason") val returnReason: String? = null,
    @SerializedName("reference_issue_number") val referenceIssueNumber: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("revision_notes") val revisionNotes: String? = null,
    @SerializedName("revision_count") val revisionCount: Int = 0,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("items_count") val itemsCount: Long? = null,
    @SerializedName("total_qty") val totalQty: String? = null
)

data class MechanicRequestItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("request_id") val requestId: String,
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("part_name") val partName: String,
    @SerializedName("unit_of_measure") val unitOfMeasure: String,
    @SerializedName("requested_qty") val requestedQty: String,
    @SerializedName("approved_qty") val approvedQty: String? = null,
    @SerializedName("fulfilled_qty") val fulfilledQty: String? = null,
    @SerializedName("item_condition") val itemCondition: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("stock_on_hand") val stockOnHand: String? = null
)

data class MechanicRequestHistoryDto(
    @SerializedName("id") val id: String,
    @SerializedName("request_id") val requestId: String,
    @SerializedName("action") val action: String,
    @SerializedName("from_status") val fromStatus: String? = null,
    @SerializedName("to_status") val toStatus: String,
    @SerializedName("actor_name") val actorName: String? = null,
    @SerializedName("actor_role") val actorRole: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("created_at") val createdAt: String
)

data class MechanicRequestDetailDto(
    @SerializedName("request") val request: MechanicRequestDto,
    @SerializedName("items") val items: List<MechanicRequestItemDto>,
    @SerializedName("history") val history: List<MechanicRequestHistoryDto>
)

data class MechanicRequestSummaryDto(
    @SerializedName("total") val total: Long,
    @SerializedName("submitted") val submitted: Long,
    @SerializedName("revision_requested") val revisionRequested: Long,
    @SerializedName("approved") val approved: Long,
    @SerializedName("completed") val completed: Long,
    @SerializedName("rejected") val rejected: Long,
    @SerializedName("cancelled") val cancelled: Long
)

data class MechanicEmployeeDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("position") val position: String? = null,
    @SerializedName("department_id") val departmentId: String? = null
)

data class MechanicContextDto(
    @SerializedName("employee") val employee: MechanicEmployeeDto? = null,
    @SerializedName("warehouses") val warehouses: List<UserWarehouseDto> = emptyList()
)

data class CreateMechanicRequestDto(
    @SerializedName("request_type") val requestType: String,
    @SerializedName("warehouse_id") val warehouseId: String,
    @SerializedName("site_id") val siteId: String? = null,
    @SerializedName("unit_number") val unitNumber: String? = null,
    @SerializedName("unit_name") val unitName: String? = null,
    @SerializedName("unit_type") val unitType: String? = null,
    @SerializedName("hm_km") val hmKm: Double? = null,
    @SerializedName("work_order_number") val workOrderNumber: String? = null,
    @SerializedName("maintenance_type") val maintenanceType: String? = null,
    @SerializedName("priority") val priority: String = "NORMAL",
    @SerializedName("mechanic_id") val mechanicId: String? = null,
    @SerializedName("mechanic_name") val mechanicName: String? = null,
    @SerializedName("damage_category") val damageCategory: String? = null,
    @SerializedName("damage_description") val damageDescription: String? = null,
    @SerializedName("damage_photo_url") val damagePhotoUrl: String? = null,
    @SerializedName("old_part_photo_url") val oldPartPhotoUrl: String? = null,
    @SerializedName("return_reason") val returnReason: String? = null,
    @SerializedName("reference_issue_number") val referenceIssueNumber: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("client_uuid") val clientUuid: String? = null,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("items") val items: List<CreateMechanicRequestItemDto>
)

data class CreateMechanicRequestItemDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("qty") val qty: Double,
    @SerializedName("item_condition") val itemCondition: String? = null,
    @SerializedName("notes") val notes: String? = null
)

data class CreateMechanicRequestResponseDto(
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("duplicate_warning") val duplicateWarning: Boolean? = null,
    @SerializedName("id") val id: String? = null,
    @SerializedName("request_number") val requestNumber: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("message") val message: String,
    @SerializedName("idempotent") val idempotent: Boolean? = null
)

data class ApproveMechanicRequestDto(
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("items") val items: List<ApproveItemDto>? = null
)

data class ApproveItemDto(
    @SerializedName("item_id") val itemId: String,
    @SerializedName("qty") val qty: Double
)

data class RequestRevisionDto(
    @SerializedName("notes") val notes: String
)

data class RejectMechanicRequestDto(
    @SerializedName("reason") val reason: String
)

data class CancelMechanicRequestDto(
    @SerializedName("reason") val reason: String? = null
)

data class FulfillMechanicRequestDto(
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("items") val items: List<ApproveItemDto>? = null
)

// ============================================================================
// Sprint 4: Replenishment Approval & Dispatch DTOs
// ============================================================================

data class ReplenishmentRequestDto(
    @SerializedName("id") val id: String,
    @SerializedName("request_number") val requestNumber: String,
    @SerializedName("container_warehouse_id") val containerWarehouseId: String,
    @SerializedName("main_warehouse_id") val mainWarehouseId: String,
    @SerializedName("status") val status: String,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("admin_notes") val adminNotes: String? = null,
    @SerializedName("supervisor_notes") val supervisorNotes: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class VerifyReplenishmentRequestDto(
    @SerializedName("admin_notes") val adminNotes: String? = null,
    @SerializedName("items") val items: List<VerifyReplenishmentItemDto> = emptyList()
)

data class VerifyReplenishmentItemDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("verified_qty") val verifiedQty: Double,
    @SerializedName("notes") val notes: String? = null
)

data class ApproveReplenishmentRequestDto(
    @SerializedName("supervisor_notes") val supervisorNotes: String? = null
)

data class RejectReplenishmentRequestDto(
    @SerializedName("reason") val reason: String
)

// ============================================================================
// Sprint 4: Used Part Return Tracking (BR-004 Core Return) DTOs
// ============================================================================

data class UsedPartReturnDto(
    @SerializedName("id") val id: String,
    @SerializedName("return_number") val returnNumber: String,
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("part_name") val partName: String? = null,
    @SerializedName("qty") val qty: Double,
    @SerializedName("unit_of_measure") val unitOfMeasure: String = "PCS",
    @SerializedName("unit_number") val unitNumber: String,
    @SerializedName("mechanic_name") val mechanicName: String,
    @SerializedName("warehouse_id") val warehouseId: String,
    @SerializedName("status") val status: String,
    @SerializedName("current_holder_type") val currentHolderType: String = "MECHANIC",
    @SerializedName("current_holder_name") val currentHolderName: String = "",
    @SerializedName("container_notes") val containerNotes: String? = null,
    @SerializedName("container_received_at") val containerReceivedAt: String? = null,
    @SerializedName("main_warehouse_id") val mainWarehouseId: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class ReceiveContainerReturnRequestDto(
    @SerializedName("container_notes") val containerNotes: String? = null,
    @SerializedName("container_photo_url") val containerPhotoUrl: String? = null
)

// ============================================================================
// Master Data Equipment & Employee (Quick-Add POS & Mechanic)
// ============================================================================

data class CreateEquipmentDto(
    @SerializedName("unit_number") val unitNumber: String,
    @SerializedName("name") val name: String,
    @SerializedName("equipment_type_id") val equipmentTypeId: String? = "HEAVY_EQUIPMENT",
    @SerializedName("serial_number") val serialNumber: String? = null,
    @SerializedName("current_hm_km") val currentHmKm: Double? = 0.0
)

data class EquipmentDto(
    @SerializedName("id") val id: String,
    @SerializedName("unit_number") val unitNumber: String,
    @SerializedName("name") val name: String,
    @SerializedName("equipment_type_id") val equipmentTypeId: String? = null,
    @SerializedName("serial_number") val serialNumber: String? = null,
    @SerializedName("current_hm_km") val currentHmKm: Double? = 0.0
)

data class CreateEmployeeDto(
    @SerializedName("name") val name: String,
    @SerializedName("position") val position: String? = "Mekanik",
    @SerializedName("is_mechanic") val isMechanic: Boolean? = true
)

data class EmployeeDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("position") val position: String? = null,
    @SerializedName("is_mechanic") val isMechanic: Boolean = true
)

