package com.sjs.logistikqu.presentation.screens.receive

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.domain.entities.GoodsReceipt
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import com.sjs.logistikqu.domain.usecase.ReceiveGoodsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class GoodsReceiveUiState(
    val dropDocumentNumber: String = "",
    val scannedItemCode: String = "",
    val verifiedQuantity: String = "20",
    val notes: String = "Barang diterima dalam kondisi baik di kontainer",
    val proofPhotoPath: String? = null,
    val isScanningDoc: Boolean = false,
    val isScanningItem: Boolean = false,
    val isSubmitting: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class GoodsReceiveViewModel @Inject constructor(
    private val receiveGoodsUseCase: ReceiveGoodsUseCase,
    private val processBarcodeUseCase: ProcessBarcodeUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(GoodsReceiveUiState())
    val uiState: StateFlow<GoodsReceiveUiState> = _uiState.asStateFlow()

    fun onScanBarcode(raw: String) {
        val parsed = processBarcodeUseCase(raw).extractedCode
        if (_uiState.value.isScanningDoc) {
            _uiState.update { it.copy(dropDocumentNumber = parsed, isScanningDoc = false) }
        } else if (_uiState.value.isScanningItem) {
            _uiState.update { it.copy(scannedItemCode = parsed, isScanningItem = false) }
        }
    }

    fun setScanningDoc(scanning: Boolean) = _uiState.update { it.copy(isScanningDoc = scanning) }
    fun setScanningItem(scanning: Boolean) = _uiState.update { it.copy(isScanningItem = scanning) }
    fun onDocNumberChanged(num: String) = _uiState.update { it.copy(dropDocumentNumber = num) }
    fun onItemCodeChanged(code: String) = _uiState.update { it.copy(scannedItemCode = code) }
    fun onQuantityChanged(qty: String) = _uiState.update { it.copy(verifiedQuantity = qty) }
    fun onNotesChanged(notes: String) = _uiState.update { it.copy(notes = notes) }
    fun onProofPhotoCaptured(path: String) = _uiState.update { it.copy(proofPhotoPath = path) }

    fun submitReceive() {
        val state = _uiState.value
        if (state.dropDocumentNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Nomor Surat Jalan Drop STO wajib diisi") }
            return
        }

        val receipt = GoodsReceipt(
            localId = UUID.randomUUID().toString(),
            replenishmentRequestId = state.dropDocumentNumber,
            dropNumber = state.dropDocumentNumber,
            containerWarehouseId = "WH-CONT-HE",
            receivedBy = "admin_cont_he",
            notes = state.notes,
            proofPhotoPath = state.proofPhotoPath,
            timestamp = System.currentTimeMillis()
        )

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val res = receiveGoodsUseCase(receipt)
            if (res.isSuccess) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        successMessage = "Surat Jalan ${state.dropDocumentNumber} berhasil diterima! Saldo kontainer otomatis bertambah.",
                        dropDocumentNumber = "",
                        scannedItemCode = ""
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
}
