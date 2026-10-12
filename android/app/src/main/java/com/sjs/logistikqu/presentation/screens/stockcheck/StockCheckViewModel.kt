package com.sjs.logistikqu.presentation.screens.stockcheck

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.domain.entities.InventoryStock
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import com.sjs.logistikqu.domain.usecase.StockCheckUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StockCheckUiState(
    val scannedLocationBin: String = "",
    val scannedPartNumber: String = "",
    val activeWarehouseId: String = "WH-CONT-HE",
    val foundStockItem: InventoryStock? = null,
    val verifiedCountInput: String = "",
    val isScanningLocation: Boolean = false,
    val isScanningPart: Boolean = false,
    val isSubmitting: Boolean = false,
    val submissionMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class StockCheckViewModel @Inject constructor(
    private val stockCheckUseCase: StockCheckUseCase,
    private val processBarcodeUseCase: ProcessBarcodeUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(StockCheckUiState())
    val uiState: StateFlow<StockCheckUiState> = _uiState.asStateFlow()

    fun onLocationScanned(rawBarcode: String) {
        val result = processBarcodeUseCase(rawBarcode)
        _uiState.update {
            it.copy(
                scannedLocationBin = result.extractedCode,
                isScanningLocation = false,
                errorMessage = null
            )
        }
    }

    fun onPartScanned(rawBarcode: String) {
        val result = processBarcodeUseCase(rawBarcode)
        val partCode = result.extractedCode
        _uiState.update { it.copy(scannedPartNumber = partCode, isScanningPart = false) }

        // Find part in local Room inventory
        viewModelScope.launch {
            stockCheckUseCase.getStockList(_uiState.value.activeWarehouseId, partCode).collect { list ->
                val matched = list.firstOrNull()
                _uiState.update {
                    it.copy(
                        foundStockItem = matched,
                        verifiedCountInput = matched?.qtyOnHand?.toString() ?: "",
                        errorMessage = if (matched == null) "Suku cadang $partCode tidak ditemukan di database lokal" else null
                    )
                }
            }
        }
    }

    fun setScanningLocation(scanning: Boolean) {
        _uiState.update { it.copy(isScanningLocation = scanning) }
    }

    fun setScanningPart(scanning: Boolean) {
        _uiState.update { it.copy(isScanningPart = scanning) }
    }

    fun onCountInputChanged(input: String) {
        _uiState.update { it.copy(verifiedCountInput = input) }
    }

    fun submitCount() {
        val item = _uiState.value.foundStockItem ?: return
        val countDouble = _uiState.value.verifiedCountInput.toDoubleOrNull()
        if (countDouble == null || countDouble < 0) {
            _uiState.update { it.copy(errorMessage = "Masukkan angka kuantitas fisik yang valid") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val res = stockCheckUseCase.verifyAndSubmitCount(
                warehouseId = item.warehouseId,
                sparePartId = item.sparePartId,
                binCode = _uiState.value.scannedLocationBin.ifBlank { item.binCode ?: "RACK-01" },
                verifiedQty = countDouble
            )

            if (res.isSuccess) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        submissionMessage = "Hasil hitung stok $countDouble ${item.uom} berhasil disimpan & diantrekan ke server!",
                        foundStockItem = item.copy(qtyOnHand = countDouble)
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = res.exceptionOrNull()?.localizedMessage ?: "Gagal menyimpan hasil hitung"
                    )
                }
            }
        }
    }
}
