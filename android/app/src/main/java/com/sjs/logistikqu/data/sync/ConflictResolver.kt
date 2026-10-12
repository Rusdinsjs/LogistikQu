package com.sjs.logistikqu.data.sync

import com.sjs.logistikqu.data.database.dao.InventoryCacheDao
import com.sjs.logistikqu.data.database.dao.LocalTransactionDao
import com.sjs.logistikqu.data.database.dao.SyncQueueDao
import javax.inject.Inject
import javax.inject.Singleton

data class ConflictDetails(
    val transactionId: String,
    val reason: String,
    val serverStock: Double,
    val clientStock: Double
)

@Singleton
class ConflictResolver @Inject constructor(
    private val inventoryCacheDao: InventoryCacheDao,
    private val syncQueueDao: SyncQueueDao,
    private val localTransactionDao: LocalTransactionDao
) {
    /**
     * Resolves conflict according to LogistikQu Core Principles:
     * 1. Inventory: Server Authority -> Overwrite local cached quantity with authoritative server stock.
     * 2. Transaction: Immutable -> Mark transaction as CONFLICT in queue without deleting audit trail.
     * 3. Flag for supervisor review/adjustment.
     */
    suspend fun resolveStockConflict(
        warehouseId: String,
        partNumber: String,
        conflict: ConflictDetails
    ) {
        // 1. Enforce Server Authority on local inventory cache
        inventoryCacheDao.updateStockCountLocal(
            warehouseId = warehouseId,
            partNumber = partNumber,
            newQty = conflict.serverStock,
            timestamp = System.currentTimeMillis()
        )

        // 2. Mark sync queue transaction with CONFLICT status
        syncQueueDao.markConflict(
            id = conflict.transactionId,
            reason = conflict.reason,
            timestamp = System.currentTimeMillis()
        )

        // 3. Mark local transaction history
        localTransactionDao.updateSyncStatus(
            txId = conflict.transactionId,
            status = "CONFLICT_PENDING"
        )
    }
}
