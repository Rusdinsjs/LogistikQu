package com.sjs.logistikqu.presentation.screens.issue

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.domain.entities.IssueTransaction
import com.sjs.logistikqu.domain.usecase.IssuePartUseCase
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class SparePartIssueUiState(
    val equipmentNumber: String = "",
    val hmKm: String = "",
    val mechanicName: String = "",
    val sparePartBarcode: String = "",
    val quantity: String = "1",
    val workOrderNumber: String = "WO-2026-",
    val maintenanceType: String = "Corrective Breakdown",
    val siteId: String = "SITE-VALE-C",
    val activeWarehouseId: String = "WH-CONT-HE",
    val capturedPhotoPath: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val activeScanningField: ScanningField? = null,
    val isSubmitting: Boolean = false,
    val issueSuccessNumber: String? = null,
    val errorMessage: String? = null
)

enum class ScanningField {
    EQUIPMENT,
    MECHANIC,
    PART
}

@HiltViewModel
class SparePartIssueViewModel @Inject constructor(
    private val issuePartUseCase: IssuePartUseCase,
    private val processBarcodeUseCase: ProcessBarcodeUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(SparePartIssueUiState())
    val uiState: StateFlow<SparePartIssueUiState> = _uiState.asStateFlow()

    fun onScanBarcode(raw: String) {
        val parsed = processBarcodeUseCase(raw).extractedCode
        when (_uiState.value.activeScanningField) {
            ScanningField.EQUIPMENT -> _uiState.update { it.copy(equipmentNumber = parsed, activeScanningField = null) }
            ScanningField.MECHANIC -> _uiState.update { it.copy(mechanicName = parsed, activeScanningField = null) }
            ScanningField.PART -> _uiState.update { it.copy(sparePartBarcode = parsed, activeScanningField = null) }
            null -> Unit
        }
    }

    fun setScanningField(field: ScanningField?) {
        _uiState.update { it.copy(activeScanningField = field) }
    }

    fun onEquipmentChanged(value: String) = _uiState.update { it.copy(equipmentNumber = value) }
    fun onHmKmChanged(value: String) = _uiState.update { it.copy(hmKm = value) }
    fun onMechanicChanged(value: String) = _uiState.update { it.copy(mechanicName = value) }
    fun onPartBarcodeChanged(value: String) = _uiState.update { it.copy(sparePartBarcode = value) }
    fun onQuantityChanged(value: String) = _uiState.update { it.copy(quantity = value) }
    fun onWorkOrderChanged(value: String) = _uiState.update { it.copy(workOrderNumber = value) }
    fun onPhotoCaptured(path: String) = _uiState.update { it.copy(capturedPhotoPath = path) }
    fun onLocationCaptured(lat: Double, lng: Double) = _uiState.update { it.copy(latitude = lat, longitude = lng) }

    fun submitIssue() {
        val state = _uiState.value
        val qtyDouble = state.quantity.toDoubleOrNull()
        if (qtyDouble == null || qtyDouble <= 0) {
            _uiState.update { it.copy(errorMessage = "Kuantitas pengeluaran harus lebih besar dari 0") }
            return
        }

        val hmKmDouble = state.hmKm.toDoubleOrNull()
        if (hmKmDouble == null || hmKmDouble <= 0) {
            _uiState.update { it.copy(errorMessage = "Hour Meter (HM/KM) wajib valid") }
            return
        }

        val transaction = IssueTransaction(
            localId = UUID.randomUUID().toString(),
            warehouseId = state.activeWarehouseId,
            siteId = state.siteId,
            unitNumber = state.equipmentNumber,
            currentHmKm = hmKmDouble,
            mechanicName = state.mechanicName,
            receiverName = state.mechanicName,
            workOrderNumber = state.workOrderNumber,
            maintenanceType = state.maintenanceType,
            priority = "HIGH",
            sparePartId = state.sparePartBarcode,
            qty = qtyDouble,
            evidencePhotoPath = state.capturedPhotoPath,
            latitude = state.latitude,
            longitude = state.longitude,
            timestamp = System.currentTimeMillis()
        )

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val result = issuePartUseCase(transaction)
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        issueSuccessNumber = result.getOrNull(),
                        equipmentNumber = "",
                        sparePartBarcode = "",
                        capturedPhotoPath = null
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = result.exceptionOrNull()?.localizedMessage ?: "Gagal mengeluarkan part"
                    )
                }
            }
        }
    }
}
