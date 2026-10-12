package com.sjs.logistikqu.data.repository

import com.google.gson.Gson
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.*
import com.sjs.logistikqu.data.database.dao.InventoryCacheDao
import com.sjs.logistikqu.data.database.dao.LocalTransactionDao
import com.sjs.logistikqu.data.database.dao.PhotoUploadQueueDao
import com.sjs.logistikqu.data.database.dao.SyncQueueDao
import com.sjs.logistikqu.data.database.entities.LocalTransactionEntity
import com.sjs.logistikqu.data.database.entities.PhotoUploadQueueEntity
import com.sjs.logistikqu.data.database.entities.SyncQueueEntity
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import com.sjs.logistikqu.data.mapper.toCacheEntity
import com.sjs.logistikqu.data.mapper.toDomain
import com.sjs.logistikqu.data.sync.SyncQueueProcessor
import com.sjs.logistikqu.domain.entities.*
import com.sjs.logistikqu.domain.repository.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val apiService: LogistikQuApiService,
    private val preferencesManager: UserPreferencesManager
) : AuthRepository {

    override suspend fun login(username: String, password: String): Result<User> {
        return try {
            val response = apiService.login(LoginRequestDto(username, password))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                preferencesManager.saveAuthData(
                    token = body.token,
                    refreshToken = body.refreshToken,
                    userId = body.user.id,
                    username = body.user.username,
                    fullName = body.user.fullName,
                    role = body.user.effectiveRole,
                    warehouseId = body.user.effectiveWarehouseId
                )
                Result.success(
                    User(
                        id = body.user.id,
                        username = body.user.username,
                        fullName = body.user.fullName,
                        role = body.user.effectiveRole,
                        warehouseId = body.user.effectiveWarehouseId,
                        token = body.token,
                        refreshToken = body.refreshToken
                    )
                )
            } else {
                Result.failure(Exception("Kredensial login tidak valid (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Gagal menghubungi server: ${e.localizedMessage}"))
        }
    }

    override suspend fun getLoggedInUser(): Flow<User?> {
        val flow1 = combine(
            preferencesManager.authTokenFlow,
            preferencesManager.refreshTokenFlow,
            preferencesManager.usernameFlow
        ) { t, r, u -> Triple(t, r, u) }
        val flow2 = combine(
            preferencesManager.fullNameFlow,
            preferencesManager.roleFlow,
            preferencesManager.warehouseIdFlow
        ) { f, ro, w -> Triple(f, ro, w) }

        return combine(flow1, flow2) { a, b ->
            val token = a.first
            val refresh = a.second
            val username = a.third
            val fullName = b.first
            val role = b.second
            val whId = b.third

            if (!token.isNullOrEmpty() && !username.isNullOrEmpty() && !role.isNullOrEmpty()) {
                User(
                    id = "",
                    username = username,
                    fullName = fullName ?: username,
                    role = role,
                    warehouseId = whId,
                    token = token,
                    refreshToken = refresh ?: ""
                )
            } else {
                null
            }
        }
    }

    override suspend fun logout(): Result<Unit> {
        preferencesManager.clearAuth()
        return Result.success(Unit)
    }

    override suspend fun refreshToken(): Result<String> {
        return try {
            val currentRefresh = preferencesManager.refreshTokenFlow.first()
                ?: return Result.failure(Exception("No refresh token"))
            val response = apiService.refreshToken(RefreshTokenRequestDto(currentRefresh))
            if (response.isSuccessful && response.body() != null) {
                val newTokens = response.body()!!
                preferencesManager.updateTokens(newTokens.token, newTokens.refreshToken)
                Result.success(newTokens.token)
            } else {
                Result.failure(Exception("Refresh token expired"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun isBiometricEnabled(): Boolean = preferencesManager.isBiometricEnabledFlow.first()

    override suspend fun setBiometricEnabled(enabled: Boolean) = preferencesManager.setBiometricEnabled(enabled)
}

@Singleton
class InventoryRepositoryImpl @Inject constructor(
    private val apiService: LogistikQuApiService,
    private val inventoryCacheDao: InventoryCacheDao,
    private val syncQueueDao: SyncQueueDao,
    private val localTransactionDao: LocalTransactionDao
) : InventoryRepository {

    override fun getLocalStockFlow(warehouseId: String, query: String): Flow<List<InventoryStock>> {
        return inventoryCacheDao.getInventoryFlow(warehouseId, query).map { list -> list.map { it.toDomain() } }
    }

    override suspend fun getStockByPartAndBin(warehouseId: String, sparePartId: String, binCode: String?): InventoryStock? {
        return inventoryCacheDao.findByPartNumber(warehouseId, sparePartId)?.toDomain()
    }

    override suspend fun refreshStockFromServer(warehouseId: String): Result<Unit> {
        return try {
            val response = apiService.getInventoryStock(warehouseId)
            if (response.isSuccessful && response.body() != null) {
                val entities = response.body()!!.map { it.toCacheEntity() }
                inventoryCacheDao.insertAll(entities)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Gagal mengambil data stok dari server"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun submitStockAuditCount(
        warehouseId: String,
        sparePartId: String,
        binCode: String,
        verifiedQty: Double
    ): Result<Unit> {
        // 1. Update local inventory cache immediately
        inventoryCacheDao.updateStockCountLocal(warehouseId, sparePartId, verifiedQty)

        // 2. Queue for background server sync
        val queueId = UUID.randomUUID().toString()
        val payloadMap = mapOf(
            "warehouse_id" to warehouseId,
            "part_number" to sparePartId,
            "spare_part_id" to sparePartId,
            "bin_code" to binCode,
            "counted_qty" to verifiedQty,
            "timestamp" to System.currentTimeMillis()
        )
        val payloadJson = Gson().toJson(payloadMap)

        val queueItem = SyncQueueEntity(
            id = queueId,
            transaction_type = "ADJUSTMENT",
            payload = payloadJson,
            status = "PENDING"
        )
        syncQueueDao.insert(queueItem)

        // 3. Record in local transactions
        localTransactionDao.insert(
            LocalTransactionEntity(
                id = UUID.randomUUID().toString(),
                transaction_id = queueId,
                type = "ADJUSTMENT",
                data = payloadJson,
                sync_status = "PENDING"
            )
        )

        return Result.success(Unit)
    }
}

@Singleton
class IssueRepositoryImpl @Inject constructor(
    private val apiService: LogistikQuApiService,
    private val inventoryCacheDao: InventoryCacheDao,
    private val syncQueueDao: SyncQueueDao,
    private val localTransactionDao: LocalTransactionDao,
    private val photoUploadQueueDao: PhotoUploadQueueDao
) : IssueRepository {

    override suspend fun submitIssue(issue: IssueTransaction): Result<String> {
        // 1. Local-First: Immediately deduct local inventory cache
        inventoryCacheDao.deductStockLocal(issue.warehouseId, issue.sparePartId, issue.qty)

        // 2. Prepare payload
        val requestDto = IssueRequestDto(
            warehouseId = issue.warehouseId,
            siteId = issue.siteId,
            receiverName = issue.receiverName,
            unitNumber = issue.unitNumber,
            hmKm = issue.currentHmKm,
            mechanicName = issue.mechanicName,
            workOrderNumber = issue.workOrderNumber,
            maintenanceType = issue.maintenanceType,
            priority = issue.priority,
            items = listOf(IssueItemDto(issue.sparePartId, issue.qty)),
            latitude = issue.latitude,
            longitude = issue.longitude
        )
        val payloadJson = Gson().toJson(requestDto)
        val queueId = UUID.randomUUID().toString()

        // 3. Queue in Room sync_queue
        val queueEntity = SyncQueueEntity(
            id = queueId,
            transaction_type = "ISSUE",
            payload = payloadJson,
            status = "PENDING"
        )
        syncQueueDao.insert(queueEntity)

        // 4. Record immutable local transaction history
        localTransactionDao.insert(
            LocalTransactionEntity(
                id = UUID.randomUUID().toString(),
                transaction_id = queueId,
                type = "ISSUE",
                data = payloadJson,
                sync_status = "PENDING"
            )
        )

        // 5. If photo evidence attached, queue photo
        if (!issue.evidencePhotoPath.isNullOrEmpty()) {
            photoUploadQueueDao.insert(
                PhotoUploadQueueEntity(
                    id = UUID.randomUUID().toString(),
                    transaction_id = queueId,
                    file_path = issue.evidencePhotoPath,
                    status = "PENDING"
                )
            )
        }

        // 6. Return offline reference number immediately without waiting for server
        return Result.success("OFFLINE-${queueId.take(8).uppercase()}")
    }

    override fun getPendingIssuesFlow(): Flow<List<IssueTransaction>> {
        return syncQueueDao.getPendingOrFailedFlow().map { list ->
            list.filter { it.transaction_type == "ISSUE" }.mapNotNull {
                try {
                    val dto = Gson().fromJson(it.payload, IssueRequestDto::class.java)
                    IssueTransaction(
                        localId = it.id,
                        warehouseId = dto.warehouseId,
                        siteId = dto.siteId ?: "",
                        unitNumber = dto.unitNumber ?: "",
                        currentHmKm = dto.hmKm ?: 0.0,
                        mechanicName = dto.mechanicName ?: "",
                        receiverName = dto.receiverName ?: "",
                        workOrderNumber = dto.workOrderNumber ?: "",
                        maintenanceType = dto.maintenanceType ?: "CORRECTIVE",
                        priority = dto.priority ?: "NORMAL",
                        sparePartId = dto.items.firstOrNull()?.sparePartId ?: "",
                        qty = dto.items.firstOrNull()?.qty ?: 0.0,
                        evidencePhotoPath = null,
                        latitude = dto.latitude,
                        longitude = dto.longitude,
                        timestamp = it.created_at
                    )
                } catch (e: Exception) {
                    null
                }
            }
        }
    }
}

@Singleton
class ReceiveRepositoryImpl @Inject constructor(
    private val inventoryCacheDao: InventoryCacheDao,
    private val syncQueueDao: SyncQueueDao,
    private val localTransactionDao: LocalTransactionDao
) : ReceiveRepository {

    override suspend fun submitReceipt(receipt: GoodsReceipt): Result<String> {
        val payloadJson = Gson().toJson(receipt)
        val queueId = UUID.randomUUID().toString()

        // 1. Local Queue
        syncQueueDao.insert(
            SyncQueueEntity(
                id = queueId,
                transaction_type = "RECEIVE",
                payload = payloadJson,
                status = "PENDING"
            )
        )

        // 2. Local History
        localTransactionDao.insert(
            LocalTransactionEntity(
                id = UUID.randomUUID().toString(),
                transaction_id = queueId,
                type = "RECEIVE",
                data = payloadJson,
                sync_status = "PENDING"
            )
        )

        return Result.success("REC-${queueId.take(8).uppercase()}")
    }

    override suspend fun getPendingDrops(warehouseId: String): Result<List<GoodsReceipt>> {
        return Result.success(emptyList())
    }
}

@Singleton
class TransferRepositoryImpl @Inject constructor(
    private val inventoryCacheDao: InventoryCacheDao,
    private val syncQueueDao: SyncQueueDao,
    private val localTransactionDao: LocalTransactionDao
) : TransferRepository {

    override suspend fun submitTransfer(transfer: WarehouseTransfer): Result<String> {
        val queueId = UUID.randomUUID().toString()
        val payloadJson = Gson().toJson(transfer)

        // 1. Deduct local stock from source warehouse
        inventoryCacheDao.deductStockLocal(transfer.sourceWarehouseId, transfer.sparePartId, transfer.qty)

        // 2. Queue in sync_queue
        syncQueueDao.insert(
            SyncQueueEntity(
                id = queueId,
                transaction_type = "TRANSFER",
                payload = payloadJson,
                status = "PENDING"
            )
        )

        // 3. Local History
        localTransactionDao.insert(
            LocalTransactionEntity(
                id = UUID.randomUUID().toString(),
                transaction_id = queueId,
                type = "TRANSFER",
                data = payloadJson,
                sync_status = "PENDING"
            )
        )

        return Result.success("TRF-${queueId.take(8).uppercase()}")
    }
}

@Singleton
class SyncRepositoryImpl @Inject constructor(
    private val syncQueueProcessor: SyncQueueProcessor,
    private val syncQueueDao: SyncQueueDao,
    private val localTransactionDao: LocalTransactionDao,
    private val apiService: LogistikQuApiService,
    private val preferencesManager: UserPreferencesManager
) : SyncRepository {

    override fun getPendingQueueFlow(): Flow<List<SyncQueueItem>> {
        return syncQueueDao.getPendingOrFailedFlow().map { list -> list.map { it.toDomain() } }
    }

    override fun getAllQueueFlow(): Flow<List<SyncQueueItem>> {
        return syncQueueDao.getAllQueueFlow().map { list -> list.map { it.toDomain() } }
    }

    override suspend fun enqueueOperation(type: TransactionType, payloadJson: String, txId: String?): String {
        val id = txId ?: UUID.randomUUID().toString()
        syncQueueDao.insert(
            SyncQueueEntity(
                id = id,
                transaction_type = type.name,
                payload = payloadJson,
                status = "PENDING"
            )
        )
        localTransactionDao.insert(
            LocalTransactionEntity(
                id = UUID.randomUUID().toString(),
                transaction_id = id,
                type = type.name,
                data = payloadJson,
                sync_status = "PENDING"
            )
        )
        return id
    }

    override suspend fun processPendingQueue(): Result<SyncProcessResult> {
        return syncQueueProcessor.processSync()
    }

    override suspend fun getQueueCount(): Int = syncQueueDao.getPendingCount()

    override suspend fun resolveConflict(conflictId: String, resolution: String, notes: String?): Result<Unit> {
        return try {
            val response = apiService.resolveConflict(
                ConflictResolutionRequestDto(
                    conflictId = conflictId,
                    resolution = resolution,
                    notes = notes
                )
            )
            if (response.isSuccessful) {
                // If resolved, trigger sync to update local state
                syncQueueProcessor.processSync()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Gagal menyelesaikan konflik (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun triggerManualSync(): Result<SyncProcessResult> {
        return syncQueueProcessor.processSync()
    }
}
