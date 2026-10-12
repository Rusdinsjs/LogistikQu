package com.sjs.logistikqu.domain.repository

import com.sjs.logistikqu.domain.entities.*
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    suspend fun login(username: String, password: String): Result<User>
    suspend fun getLoggedInUser(): Flow<User?>
    suspend fun logout(): Result<Unit>
    suspend fun refreshToken(): Result<String>
    suspend fun isBiometricEnabled(): Boolean
    suspend fun setBiometricEnabled(enabled: Boolean)
}

interface InventoryRepository {
    fun getLocalStockFlow(warehouseId: String, query: String): Flow<List<InventoryStock>>
    suspend fun getStockByPartAndBin(warehouseId: String, sparePartId: String, binCode: String?): InventoryStock?
    suspend fun refreshStockFromServer(warehouseId: String): Result<Unit>
    suspend fun submitStockAuditCount(warehouseId: String, sparePartId: String, binCode: String, verifiedQty: Double): Result<Unit>
}

interface IssueRepository {
    suspend fun submitIssue(issue: IssueTransaction): Result<String>
    fun getPendingIssuesFlow(): Flow<List<IssueTransaction>>
}

interface ReceiveRepository {
    suspend fun submitReceipt(receipt: GoodsReceipt): Result<String>
    suspend fun getPendingDrops(warehouseId: String): Result<List<GoodsReceipt>>
}

interface TransferRepository {
    suspend fun submitTransfer(transfer: WarehouseTransfer): Result<String>
}

interface SyncRepository {
    fun getPendingQueueFlow(): Flow<List<SyncQueueItem>>
    fun getAllQueueFlow(): Flow<List<SyncQueueItem>>
    suspend fun enqueueOperation(type: TransactionType, payloadJson: String, txId: String? = null): String
    suspend fun processPendingQueue(): Result<SyncProcessResult>
    suspend fun getQueueCount(): Int
    suspend fun resolveConflict(conflictId: String, resolution: String, notes: String?): Result<Unit>
    suspend fun triggerManualSync(): Result<SyncProcessResult>
}
