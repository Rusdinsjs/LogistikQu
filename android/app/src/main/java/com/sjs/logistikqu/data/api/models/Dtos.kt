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
    @SerializedName("warehouses") val warehouses: List<UserWarehouseDto>? = null
) {
    val effectiveRole: String get() = role ?: roleId ?: roleName ?: "SUPER_ADMIN"
    val effectiveWarehouseId: String? get() = warehouseId ?: warehouses?.firstOrNull()?.id ?: "WH-CONT-HE"
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
    @SerializedName("longitude") val longitude: Double?
)

data class IssueItemDto(
    @SerializedName("spare_part_id") val sparePartId: String,
    @SerializedName("qty") val qty: Double
)
