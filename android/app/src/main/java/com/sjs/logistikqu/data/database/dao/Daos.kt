package com.sjs.logistikqu.data.database.dao

import androidx.room.*
import com.sjs.logistikqu.data.database.entities.*
import kotlinx.coroutines.flow.Flow

@Dao
interface InventoryCacheDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<InventoryCacheEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(item: InventoryCacheEntity)

    @Query("""
        SELECT * FROM inventory_cache 
        WHERE warehouse_id = :warehouseId 
        AND (:query = '' OR part_number LIKE '%' || :query || '%' OR part_name LIKE '%' || :query || '%' OR location_id LIKE '%' || :query || '%')
        ORDER BY part_name ASC
    """)
    fun getInventoryFlow(warehouseId: String, query: String = ""): Flow<List<InventoryCacheEntity>>

    @Query("SELECT * FROM inventory_cache WHERE warehouse_id = :warehouseId AND part_number = :partNumber LIMIT 1")
    suspend fun findByPartNumber(warehouseId: String, partNumber: String): InventoryCacheEntity?

    @Query("""
        UPDATE inventory_cache 
        SET quantity = quantity - :qty, updated_at = :timestamp, sync_status = 'PENDING_SYNC' 
        WHERE warehouse_id = :warehouseId AND part_number = :partNumber
    """)
    suspend fun deductStockLocal(warehouseId: String, partNumber: String, qty: Double, timestamp: Long = System.currentTimeMillis())

    @Query("""
        UPDATE inventory_cache 
        SET quantity = quantity + :qty, updated_at = :timestamp, sync_status = 'PENDING_SYNC' 
        WHERE warehouse_id = :warehouseId AND part_number = :partNumber
    """)
    suspend fun incrementStockLocal(warehouseId: String, partNumber: String, qty: Double, timestamp: Long = System.currentTimeMillis())

    @Query("""
        UPDATE inventory_cache 
        SET quantity = :newQty, updated_at = :timestamp, sync_status = 'LOCAL_UPDATED' 
        WHERE warehouse_id = :warehouseId AND part_number = :partNumber
    """)
    suspend fun updateStockCountLocal(warehouseId: String, partNumber: String, newQty: Double, timestamp: Long = System.currentTimeMillis())
}

@Dao
interface SyncQueueDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: SyncQueueEntity)

    @Query("SELECT * FROM sync_queue ORDER BY created_at DESC")
    fun getAllQueueFlow(): Flow<List<SyncQueueEntity>>

    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' OR status = 'FAILED' ORDER BY created_at ASC")
    fun getPendingOrFailedFlow(): Flow<List<SyncQueueEntity>>

    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' OR status = 'FAILED' ORDER BY created_at ASC LIMIT :batchSize")
    suspend fun getPendingBatch(batchSize: Int = 50): List<SyncQueueEntity>

    @Query("UPDATE sync_queue SET status = :status, updated_at = :timestamp, last_error = :error WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, error: String? = null, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE sync_queue SET status = 'SUCCESS', updated_at = :timestamp WHERE id = :id")
    suspend fun markSuccess(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("""
        UPDATE sync_queue 
        SET retry_count = retry_count + 1, last_error = :error, status = 'FAILED', updated_at = :timestamp 
        WHERE id = :id
    """)
    suspend fun recordRetryFailure(id: String, error: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE sync_queue SET status = 'CONFLICT', last_error = :reason, updated_at = :timestamp WHERE id = :id")
    suspend fun markConflict(id: String, reason: String, timestamp: Long = System.currentTimeMillis())

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING'")
    suspend fun getPendingCount(): Int

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'SUCCESS'")
    suspend fun getSuccessCount(): Int

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'FAILED'")
    suspend fun getFailedCount(): Int

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'CONFLICT'")
    suspend fun getConflictCount(): Int

    @Query("DELETE FROM sync_queue WHERE status = 'SUCCESS' AND updated_at < :olderThanTimestamp")
    suspend fun purgeOldSuccess(olderThanTimestamp: Long)
}

@Dao
interface LocalTransactionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(tx: LocalTransactionEntity)

    @Query("SELECT * FROM local_transactions ORDER BY created_at DESC LIMIT :limit")
    fun getHistoryFlow(limit: Int = 100): Flow<List<LocalTransactionEntity>>

    @Query("UPDATE local_transactions SET sync_status = :status WHERE transaction_id = :txId")
    suspend fun updateSyncStatus(txId: String, status: String)
}

@Dao
interface PhotoUploadQueueDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(photo: PhotoUploadQueueEntity)

    @Query("SELECT * FROM photo_upload_queue WHERE status = 'PENDING' ORDER BY created_at ASC")
    suspend fun getPendingPhotos(): List<PhotoUploadQueueEntity>

    @Query("UPDATE photo_upload_queue SET status = 'UPLOADED' WHERE id = :id")
    suspend fun markUploaded(id: String)

    @Query("UPDATE photo_upload_queue SET status = 'FAILED' WHERE id = :id")
    suspend fun markFailed(id: String)
}
