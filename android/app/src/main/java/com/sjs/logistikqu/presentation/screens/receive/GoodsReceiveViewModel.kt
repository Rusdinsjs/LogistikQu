package com.sjs.logistikqu.presentation.screens.receive

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import com.sjs.logistikqu.domain.entities.GoodsReceipt
import com.sjs.logistikqu.domain.entities.WarehouseBin
import com.sjs.logistikqu.domain.repository.InventoryRepository
import com.sjs.logistikqu.domain.usecase.GetWarehouseBinsUseCase
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import com.sjs.logistikqu.domain.usecase.ReceiveGoodsUseCase
import com.sjs.logistikqu.domain.usecase.RelocateStockBinUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class GoodsReceiveUiState(
    val warehouseId: String = "WH-CONT-HE",
    val dropDocumentNumber: String = "",
    val scannedItemCode: String = "",
    val verifiedQuantity: String = "10",
    val notes: String = "Barang diterima dalam kondisi baik di kontainer",
    val proofPhotoPath: String? = null,
    val availableBins: List<WarehouseBin> = emptyList(),
    val suggestedBinCode: String = "BIN-A1-01",
    val targetBinCode: String = "BIN-A1-01",
    val isScanningDoc: Boolean = false,
    val isScanningItem: Boolean = false,
    val isScanningBin: Boolean = false,
    val isSubmitting: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class GoodsReceiveViewModel @Inject constructor(
    private val receiveGoodsUseCase: ReceiveGoodsUseCase,
    private val processBarcodeUseCase: ProcessBarcodeUseCase,
    private val getWarehouseBinsUseCase: GetWarehouseBinsUseCase,
    private val relocateStockBinUseCase: RelocateStockBinUseCase,
    private val inventoryRepository: InventoryRepository,
    private val preferencesManager: UserPreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(GoodsReceiveUiState())
    val uiState: StateFlow<GoodsReceiveUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val whId = preferencesManager.warehouseIdFlow.first().ifBlank { "WH-CONT-HE" }
            _uiState.update { it.copy(warehouseId = whId) }
            loadBins(whId)
        }
    }

    fun loadBins(warehouseId: String = _uiState.value.warehouseId) {
        viewModelScope.launch {
            val res = getWarehouseBinsUseCase(warehouseId)
            if (res.isSuccess) {
                val bins = res.getOrDefault(emptyList())
                _uiState.update { current ->
                    val defaultBin = bins.firstOrNull()?.binCode ?: "BIN-A1-01"
                    current.copy(
                        availableBins = bins,
                        suggestedBinCode = if (current.suggestedBinCode.isBlank()) defaultBin else current.suggestedBinCode,
                        targetBinCode = if (current.targetBinCode.isBlank()) defaultBin else current.targetBinCode
                    )
                }
            }
        }
    }

    fun onScanBarcode(raw: String) {
        val parsed = processBarcodeUseCase(raw).extractedCode
        when {
            _uiState.value.isScanningDoc -> {
                _uiState.update { it.copy(dropDocumentNumber = parsed, isScanningDoc = false) }
            }
            _uiState.value.isScanningItem -> {
                _uiState.update { it.copy(scannedItemCode = parsed, isScanningItem = false) }
                checkAndSuggestBinForPart(parsed)
            }
            _uiState.value.isScanningBin -> {
                _uiState.update { it.copy(targetBinCode = parsed, isScanningBin = false) }
            }
        }
    }

    private fun checkAndSuggestBinForPart(sparePartId: String) {
        viewModelScope.launch {
            val currentStock = inventoryRepository.getStockByPartAndBin(_uiState.value.warehouseId, sparePartId, null)
            val existingBin = currentStock?.binCode
            if (!existingBin.isNullOrBlank()) {
                _uiState.update { it.copy(suggestedBinCode = existingBin, targetBinCode = existingBin) }
            } else {
                val bins = _uiState.value.availableBins
                val recommended = bins.firstOrNull()?.binCode ?: "BIN-A1-01"
                _uiState.update { it.copy(suggestedBinCode = recommended, targetBinCode = recommended) }
            }
        }
    }

    fun setScanningDoc(scanning: Boolean) = _uiState.update { it.copy(isScanningDoc = scanning) }
    fun setScanningItem(scanning: Boolean) = _uiState.update { it.copy(isScanningItem = scanning) }
    fun setScanningBin(scanning: Boolean) = _uiState.update { it.copy(isScanningBin = scanning) }

    fun onDocNumberChanged(num: String) = _uiState.update { it.copy(dropDocumentNumber = num) }
    fun onItemCodeChanged(code: String) {
        _uiState.update { it.copy(scannedItemCode = code) }
        if (code.length >= 4) {
            checkAndSuggestBinForPart(code)
        }
    }

    fun onQuantityChanged(qty: String) = _uiState.update { it.copy(verifiedQuantity = qty) }
    fun onTargetBinChanged(binCode: String) = _uiState.update { it.copy(targetBinCode = binCode) }
    fun onNotesChanged(notes: String) = _uiState.update { it.copy(notes = notes) }
    fun onProofPhotoCaptured(path: String) = _uiState.update { it.copy(proofPhotoPath = path) }

    fun submitReceive() {
        val state = _uiState.value
        if (state.dropDocumentNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Nomor Surat Jalan Drop STO wajib diisi") }
            return
        }
        if (state.scannedItemCode.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Kode Suku Cadang wajib diverifikasi") }
            return
        }

        val qty = state.verifiedQuantity.toDoubleOrNull() ?: 1.0
        val targetBin = state.targetBinCode.ifBlank { state.suggestedBinCode }.ifBlank { "BIN-A1-01" }

        val receipt = GoodsReceipt(
            localId = UUID.randomUUID().toString(),
            replenishmentRequestId = state.dropDocumentNumber,
            dropNumber = state.dropDocumentNumber,
            containerWarehouseId = state.warehouseId,
            receivedBy = "admin_cont",
            notes = state.notes,
            proofPhotoPath = state.proofPhotoPath,
            timestamp = System.currentTimeMillis(),
            sparePartId = state.scannedItemCode,
            receivedQty = qty,
            targetBinCode = targetBin
        )

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val res = receiveGoodsUseCase(receipt)
            if (res.isSuccess) {
                // Ensure bin relocation is synchronized
                relocateStockBinUseCase(state.warehouseId, state.scannedItemCode, targetBin)

                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        successMessage = "Surat Jalan ${state.dropDocumentNumber} berhasil diterima! Stok fisik ${state.scannedItemCode} (+${qty.toInt()}) telah disusun di Rak ${targetBin}.",
                        dropDocumentNumber = "",
                        scannedItemCode = "",
                        verifiedQuantity = "10"
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = res.exceptionOrNull()?.localizedMessage ?: "Gagal menerima barang"
                    )
                }
            }
        }
    }

    fun clearSuccessMessage() {
        _uiState.update { it.copy(successMessage = null) }
    }
}
