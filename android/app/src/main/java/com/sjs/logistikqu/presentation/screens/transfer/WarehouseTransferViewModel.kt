package com.sjs.logistikqu.presentation.screens.transfer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.domain.entities.WarehouseTransfer
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import com.sjs.logistikqu.domain.usecase.TransferWarehouseUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class WarehouseTransferUiState(
    val sourceWarehouseId: String = "WH-CONT-HE",
    val destinationWarehouseId: String = "WH-CONT-DT",
    val scannedPartId: String = "",
    val quantity: String = "5",
    val notes: String = "Mutasi penyeimbangan buffer site Pit Petea",
    val isScanningPart: Boolean = false,
    val isSubmitting: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class WarehouseTransferViewModel @Inject constructor(
    private val transferWarehouseUseCase: TransferWarehouseUseCase,
    private val processBarcodeUseCase: ProcessBarcodeUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(WarehouseTransferUiState())
    val uiState: StateFlow<WarehouseTransferUiState> = _uiState.asStateFlow()

    fun onScanBarcode(raw: String) {
        val parsed = processBarcodeUseCase(raw).extractedCode
        _uiState.update { it.copy(scannedPartId = parsed, isScanningPart = false) }
    }

    fun setScanningPart(scanning: Boolean) = _uiState.update { it.copy(isScanningPart = scanning) }
    fun onSourceChanged(wh: String) = _uiState.update { it.copy(sourceWarehouseId = wh) }
    fun onDestinationChanged(wh: String) = _uiState.update { it.copy(destinationWarehouseId = wh) }
    fun onPartChanged(part: String) = _uiState.update { it.copy(scannedPartId = part) }
    fun onQtyChanged(qty: String) = _uiState.update { it.copy(quantity = qty) }
    fun onNotesChanged(notes: String) = _uiState.update { it.copy(notes = notes) }

    fun submitTransfer() {
        val state = _uiState.value
        val qtyDouble = state.quantity.toDoubleOrNull()
        if (qtyDouble == null || qtyDouble <= 0) {
            _uiState.update { it.copy(errorMessage = "Kuantitas transfer harus lebih besar dari 0") }
            return
        }

        val transfer = WarehouseTransfer(
            localId = UUID.randomUUID().toString(),
            sourceWarehouseId = state.sourceWarehouseId,
            destinationWarehouseId = state.destinationWarehouseId,
            sparePartId = state.scannedPartId,
            qty = qtyDouble,
            notes = state.notes,
            timestamp = System.currentTimeMillis()
        )

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val res = transferWarehouseUseCase(transfer)
            if (res.isSuccess) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        successMessage = "Transfer ${state.scannedPartId} sebanyak $qtyDouble PCS berhasil diantrekan!",
                        scannedPartId = ""
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = res.exceptionOrNull()?.localizedMessage ?: "Gagal transfer stok"
                    )
                }
            }
        }
    }
}
