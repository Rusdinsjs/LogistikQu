package com.sjs.logistikqu.data.database.entities

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * 1. Local Inventory Cache: Cached snapshot of inventory balance from server
 */
@Entity(
    tableName = "inventory_cache",
    indices = [
        Index(value = ["warehouse_id", "part_number"], unique = true),
        Index(value = ["location_id"]),
        Index(value = ["part_name"])
    ]
)
data class InventoryCacheEntity(
    @PrimaryKey
    val id: String,
    val part_number: String,
    val part_name: String,
    val warehouse_id: String,
    val location_id: String?, // Bin or Rack ID
    val quantity: Double,
    val minimum_stock: Double,
    val updated_at: Long = System.currentTimeMillis(),
    val sync_status: String = "SYNCED" // SYNCED, PENDING_SYNC, LOCAL_UPDATED
)

/**
 * 2. Transaction Queue: Persistent offline queue for outbound mutations
 */
@Entity(
    tableName = "sync_queue",
    indices = [
        Index(value = ["status", "created_at"]),
        Index(value = ["transaction_type"]),
        Index(value = ["retry_count"])
    ]
)
data class SyncQueueEntity(
    @PrimaryKey
    val id: String, // UUID
    val transaction_type: String, // ISSUE, RECEIVE, TRANSFER, ADJUSTMENT, RETURN
    val payload: String, // JSON payload
    val status: String, // PENDING, PROCESSING, SUCCESS, FAILED, CONFLICT
    val retry_count: Int = 0,
    val created_at: Long = System.currentTimeMillis(),
    val updated_at: Long = System.currentTimeMillis(),
    val last_error: String? = null
)

/**
 * 3. Local Transaction History: Immutable audit trail of actions taken on this device
 */
@Entity(
    tableName = "local_transactions",
    indices = [
        Index(value = ["transaction_id"], unique = true),
        Index(value = ["type", "created_at"])
    ]
)
data class LocalTransactionEntity(
    @PrimaryKey
    val id: String,
    val transaction_id: String, // Client UUID matching sync_queue id
    val type: String, // ISSUE, RECEIVE, TRANSFER, ADJUSTMENT, RETURN
    val data: String, // Serialized details JSON
    val created_at: Long = System.currentTimeMillis(),
    val sync_status: String = "PENDING" // PENDING, SYNCED, CONFLICT
)

/**
 * 4. Photo Upload Queue: Local images waiting to be synced when connected
 */
@Entity(
    tableName = "photo_upload_queue",
    indices = [
        Index(value = ["transaction_id"]),
        Index(value = ["status"])
    ]
)
data class PhotoUploadQueueEntity(
    @PrimaryKey
    val id: String,
    val transaction_id: String,
    val file_path: String,
    val status: String = "PENDING", // PENDING, UPLOADED, FAILED
    val created_at: Long = System.currentTimeMillis()
)
