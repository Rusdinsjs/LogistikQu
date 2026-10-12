package com.sjs.logistikqu.domain.usecase

import com.sjs.logistikqu.domain.entities.*
import com.sjs.logistikqu.domain.repository.*
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class LoginUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(username: String, password: String): Result<User> {
        if (username.isBlank() || password.isBlank()) {
            return Result.failure(IllegalArgumentException("Username dan password tidak boleh kosong"))
        }
        return authRepository.login(username.trim(), password)
    }
}

class ProcessBarcodeUseCase @Inject constructor() {
    operator fun invoke(rawValue: String): BarcodeScanResult {
        val cleanValue = rawValue.trim().uppercase()
        return when {
            cleanValue.startsWith("PART-") || cleanValue.startsWith("FLT-") || cleanValue.startsWith("HOS-") ||
            cleanValue.startsWith("ENG-") || cleanValue.startsWith("BRK-") || cleanValue.startsWith("LUB-") -> {
                BarcodeScanResult(rawValue, BarcodeType.PART, cleanValue)
            }
            cleanValue.startsWith("DT-") || cleanValue.startsWith("EX-") || cleanValue.startsWith("DZ-") ||
            cleanValue.startsWith("GR-") || cleanValue.startsWith("EQUIP-") -> {
                BarcodeScanResult(rawValue, BarcodeType.EQUIPMENT, cleanValue)
            }
            cleanValue.startsWith("WH-") || cleanValue.startsWith("RACK-") || cleanValue.startsWith("BIN-") ||
            cleanValue.startsWith("BAY-") -> {
                BarcodeScanResult(rawValue, BarcodeType.LOCATION_BIN, cleanValue)
            }
            cleanValue.startsWith("DROP-") || cleanValue.startsWith("REQ-") || cleanValue.startsWith("STO-") -> {
                BarcodeScanResult(rawValue, BarcodeType.SHIPMENT_DOC, cleanValue)
            }
            else -> {
                BarcodeScanResult(rawValue, BarcodeType.UNKNOWN, cleanValue)
            }
        }
    }
}

class StockCheckUseCase @Inject constructor(
    private val inventoryRepository: InventoryRepository
) {
    fun getStockList(warehouseId: String, query: String): Flow<List<InventoryStock>> {
        return inventoryRepository.getLocalStockFlow(warehouseId, query)
    }

    suspend fun verifyAndSubmitCount(
        warehouseId: String,
        sparePartId: String,
        binCode: String,
        verifiedQty: Double
    ): Result<Unit> {
        if (verifiedQty < 0) {
            return Result.failure(IllegalArgumentException("Kuantitas fisik tidak boleh bernilai negatif"))
        }
        return inventoryRepository.submitStockAuditCount(warehouseId, sparePartId, binCode, verifiedQty)
    }
}

class IssuePartUseCase @Inject constructor(
    private val issueRepository: IssueRepository
) {
    suspend operator fun invoke(issue: IssueTransaction): Result<String> {
        // Traceability Validation BR-001 s/d BR-004
        if (issue.unitNumber.isBlank()) {
            return Result.failure(IllegalArgumentException("Nomor unit alat tambang wajib diisi / discan"))
        }
        if (issue.currentHmKm <= 0.0) {
            return Result.failure(IllegalArgumentException("Hour Meter (HM) / KM unit wajib valid"))
        }
        if (issue.mechanicName.isBlank()) {
            return Result.failure(IllegalArgumentException("Nama mekanik penerima wajib diisi"))
        }
        if (issue.workOrderNumber.isBlank()) {
            return Result.failure(IllegalArgumentException("Nomor Work Order (WO) wajib diisi"))
        }
        if (issue.qty <= 0.0) {
            return Result.failure(IllegalArgumentException("Kuantitas pengeluaran suku cadang harus > 0"))
        }

        return issueRepository.submitIssue(issue)
    }
}

class ReceiveGoodsUseCase @Inject constructor(
    private val receiveRepository: ReceiveRepository
) {
    suspend operator fun invoke(receipt: GoodsReceipt): Result<String> {
        if (receipt.dropNumber.isBlank() && receipt.replenishmentRequestId.isBlank()) {
            return Result.failure(IllegalArgumentException("Nomor Surat Jalan Drop STO wajib discan"))
        }
        return receiveRepository.submitReceipt(receipt)
    }
}

class TransferWarehouseUseCase @Inject constructor(
    private val transferRepository: TransferRepository
) {
    suspend operator fun invoke(transfer: WarehouseTransfer): Result<String> {
        if (transfer.sourceWarehouseId == transfer.destinationWarehouseId) {
            return Result.failure(IllegalArgumentException("Gudang asal dan tujuan tidak boleh sama"))
        }
        if (transfer.qty <= 0.0) {
            return Result.failure(IllegalArgumentException("Kuantitas transfer barang harus > 0"))
        }
        return transferRepository.submitTransfer(transfer)
    }
}

class SyncQueueUseCase @Inject constructor(
    private val syncRepository: SyncRepository
) {
    fun getPendingQueue(): Flow<List<SyncQueueItem>> = syncRepository.getPendingQueueFlow()

    fun getAllQueue(): Flow<List<SyncQueueItem>> = syncRepository.getAllQueueFlow()

    suspend fun triggerSync(): Result<SyncProcessResult> = syncRepository.processPendingQueue()

    suspend fun resolveConflict(conflictId: String, resolution: String, notes: String? = null): Result<Unit> =
        syncRepository.resolveConflict(conflictId, resolution, notes)
}
