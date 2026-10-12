package com.sjs.logistikqu.presentation.screens.issue

import android.content.Context
import androidx.compose.ui.geometry.Offset
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import com.sjs.logistikqu.domain.entities.IssueTransaction
import com.sjs.logistikqu.domain.repository.InventoryRepository
import com.sjs.logistikqu.domain.usecase.IssuePartUseCase
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.CreateEmployeeDto
import com.sjs.logistikqu.data.api.models.CreateEquipmentDto
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class SparePartIssueUiState(
    val equipmentNumber: String = "",
    val hmKm: String = "",
    val mechanicName: String = "",
    val sparePartBarcode: String = "",
    val partName: String = "",
    val binLocation: String = "BIN-A1-01",
    val requiresCoreReturn: Boolean = false,
    val quantity: String = "1",
    val workOrderNumber: String = "WO-2026-",
    val maintenanceType: String = "Corrective Breakdown",
    val siteId: String = "SITE-VALE-C",
    val activeWarehouseId: String = "WH-CONT-HE",
    val capturedPhotoPath: String? = null,
    val isSignatureCaptured: Boolean = false,
    val isSignaturePadOpen: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val activeScanningField: ScanningField? = null,
    val isSubmitting: Boolean = false,
    val issueSuccessNumber: String? = null,
    val showReceiptDialog: Boolean = false,
    val lastReceiptData: ThermalReceiptData? = null,
    val errorMessage: String? = null,
    val showAddEquipmentDialog: Boolean = false,
    val showAddMechanicDialog: Boolean = false,
    val isSavingMaster: Boolean = false,
    val masterSuccessMessage: String? = null
)

enum class ScanningField {
    EQUIPMENT,
    MECHANIC,
    PART
}

@HiltViewModel
class SparePartIssueViewModel @Inject constructor(
    private val issuePartUseCase: IssuePartUseCase,
    private val processBarcodeUseCase: ProcessBarcodeUseCase,
    private val inventoryRepository: InventoryRepository,
    private val preferencesManager: UserPreferencesManager,
    private val apiService: LogistikQuApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(SparePartIssueUiState())
    val uiState: StateFlow<SparePartIssueUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val wh = preferencesManager.warehouseIdFlow.first().ifBlank { "WH-CONT-HE" }
            _uiState.update { it.copy(activeWarehouseId = wh) }
        }
    }

    fun onScanBarcode(raw: String) {
        val parsed = processBarcodeUseCase(raw).extractedCode
        when (_uiState.value.activeScanningField) {
            ScanningField.EQUIPMENT -> _uiState.update { it.copy(equipmentNumber = parsed, activeScanningField = null) }
            ScanningField.MECHANIC -> _uiState.update { it.copy(mechanicName = parsed, activeScanningField = null) }
            ScanningField.PART -> {
                _uiState.update { it.copy(sparePartBarcode = parsed, activeScanningField = null) }
                checkPartDetails(parsed)
            }
            null -> Unit
        }
    }

    private fun checkPartDetails(partCode: String) {
        val clean = partCode.trim().uppercase()
        val isCore = clean.contains("FLT") || clean.contains("FILTER") ||
                     clean.contains("HOS") || clean.contains("HOSE") ||
                     clean.contains("CYL") || clean.contains("CYLINDER") ||
                     clean.contains("ALT") || clean.contains("TURBO") ||
                     clean.contains("STARTER") || clean.contains("PUMP")

        viewModelScope.launch {
            val stock = inventoryRepository.getStockByPartAndBin(_uiState.value.activeWarehouseId, partCode, null)
            _uiState.update {
                it.copy(
                    partName = stock?.partName ?: if (isCore) "Komponen Assembly Unit" else "Suku Cadang Standar",
                    binLocation = stock?.binCode ?: "BIN-A1-01",
                    requiresCoreReturn = isCore
                )
            }
        }
    }

    fun setScanningField(field: ScanningField?) {
        _uiState.update { it.copy(activeScanningField = field) }
    }

    fun onEquipmentChanged(value: String) = _uiState.update { it.copy(equipmentNumber = value) }
    fun onHmKmChanged(value: String) = _uiState.update { it.copy(hmKm = value) }
    fun onMechanicChanged(value: String) = _uiState.update { it.copy(mechanicName = value) }
    fun onPartBarcodeChanged(value: String) {
        _uiState.update { it.copy(sparePartBarcode = value) }
        if (value.length >= 3) {
            checkPartDetails(value)
        }
    }
    fun onQuantityChanged(value: String) = _uiState.update { it.copy(quantity = value) }
    fun onWorkOrderChanged(value: String) = _uiState.update { it.copy(workOrderNumber = value) }
    fun onPhotoCaptured(path: String) = _uiState.update { it.copy(capturedPhotoPath = path) }
    fun onLocationCaptured(lat: Double, lng: Double) = _uiState.update { it.copy(latitude = lat, longitude = lng) }

    fun openSignaturePad() = _uiState.update { it.copy(isSignaturePadOpen = true) }
    fun dismissSignaturePad() = _uiState.update { it.copy(isSignaturePadOpen = false) }

    fun onSignatureConfirmed(strokes: List<List<Offset>>) {
        if (strokes.isNotEmpty()) {
            _uiState.update { it.copy(isSignatureCaptured = true, isSignaturePadOpen = false, errorMessage = null) }
        }
    }

    fun dismissReceiptDialog() = _uiState.update { it.copy(showReceiptDialog = false) }

    fun printOrShareReceipt(context: Context) {
        val data = _uiState.value.lastReceiptData
        if (data != null) {
            ThermalReceiptHelper.shareReceipt(context, data)
        }
    }

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

        if (state.equipmentNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Nomor unit alat wajib diisi") }
            return
        }

        if (state.mechanicName.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Nama mekanik wajib diisi / discan") }
            return
        }

        if (state.sparePartBarcode.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Nomor part wajib discan / dimasukkan") }
            return
        }

        // Traceability Point #3: Digital Signature verification
        if (!state.isSignatureCaptured) {
            _uiState.update { it.copy(errorMessage = "Mekanik wajib membubuhkan tanda tangan digital sebelum part dikeluarkan!") }
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
            timestamp = System.currentTimeMillis(),
            signatureType = "DIGITAL",
            mechanicSignatureUrl = "DIGITAL_CAPTURED_TOUCHSCREEN",
            receiptPrinted = true
        )

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val result = issuePartUseCase(transaction)
            if (result.isSuccess) {
                val issueNo = result.getOrNull() ?: "ISS-${UUID.randomUUID().toString().take(8).uppercase()}"

                val receiptData = ThermalReceiptData(
                    issueNumber = issueNo,
                    warehouseId = state.activeWarehouseId,
                    timestamp = transaction.timestamp,
                    unitNumber = state.equipmentNumber,
                    hmKm = hmKmDouble,
                    workOrderNumber = state.workOrderNumber,
                    mechanicName = state.mechanicName,
                    receiverName = state.mechanicName,
                    partNumber = state.sparePartBarcode,
                    partName = state.partName.ifBlank { "Filter / Suku Cadang Alat" },
                    quantity = qtyDouble,
                    binLocation = state.binLocation,
                    isDigitallySigned = true,
                    requiresCoreReturn = state.requiresCoreReturn
                )

                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        issueSuccessNumber = issueNo,
                        lastReceiptData = receiptData,
                        showReceiptDialog = true,
                        isSignatureCaptured = false
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

    fun startNewTransaction() {
        _uiState.update {
            it.copy(
                equipmentNumber = "",
                sparePartBarcode = "",
                partName = "",
                quantity = "1",
                capturedPhotoPath = null,
                isSignatureCaptured = false,
                issueSuccessNumber = null,
                showReceiptDialog = false,
                lastReceiptData = null,
                errorMessage = null
            )
        }
    }

    fun openAddEquipmentDialog() = _uiState.update { it.copy(showAddEquipmentDialog = true, errorMessage = null) }
    fun closeAddEquipmentDialog() = _uiState.update { it.copy(showAddEquipmentDialog = false) }

    fun openAddMechanicDialog() = _uiState.update { it.copy(showAddMechanicDialog = true, errorMessage = null) }
    fun closeAddMechanicDialog() = _uiState.update { it.copy(showAddMechanicDialog = false) }

    fun quickAddEquipment(unitNumber: String, name: String, type: String, hmKm: Double?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingMaster = true, errorMessage = null) }
            try {
                val res = apiService.createEquipment(
                    CreateEquipmentDto(
                        unitNumber = unitNumber.trim().uppercase(),
                        name = name.trim(),
                        equipmentTypeId = type,
                        currentHmKm = hmKm ?: 0.0
                    )
                )
                if (res.isSuccessful && res.body() != null) {
                    val eq = res.body()!!
                    _uiState.update {
                        it.copy(
                            equipmentNumber = eq.unitNumber,
                            hmKm = hmKm?.toString() ?: it.hmKm,
                            showAddEquipmentDialog = false,
                            isSavingMaster = false,
                            masterSuccessMessage = "Unit ${eq.unitNumber} berhasil didaftarkan!"
                        )
                    }
                } else {
                    // Fallback to local entry
                    _uiState.update {
                        it.copy(
                            equipmentNumber = unitNumber.trim().uppercase(),
                            hmKm = hmKm?.toString() ?: it.hmKm,
                            showAddEquipmentDialog = false,
                            isSavingMaster = false,
                            masterSuccessMessage = "Unit ${unitNumber.trim().uppercase()} dicatat di form POS"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        equipmentNumber = unitNumber.trim().uppercase(),
                        hmKm = hmKm?.toString() ?: it.hmKm,
                        showAddEquipmentDialog = false,
                        isSavingMaster = false,
                        masterSuccessMessage = "Unit ${unitNumber.trim().uppercase()} dicatat lokal (offline)"
                    )
                }
            }
        }
    }

    fun quickAddMechanic(name: String, position: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingMaster = true, errorMessage = null) }
            try {
                val res = apiService.createEmployee(
                    CreateEmployeeDto(
                        name = name.trim(),
                        position = position.ifBlank { "Mekanik" },
                        isMechanic = true
                    )
                )
                if (res.isSuccessful && res.body() != null) {
                    val emp = res.body()!!
                    _uiState.update {
                        it.copy(
                            mechanicName = emp.name,
                            showAddMechanicDialog = false,
                            isSavingMaster = false,
                            masterSuccessMessage = "Mekanik ${emp.name} berhasil didaftarkan!"
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            mechanicName = name.trim(),
                            showAddMechanicDialog = false,
                            isSavingMaster = false,
                            masterSuccessMessage = "Mekanik ${name.trim()} dicatat di form POS"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        mechanicName = name.trim(),
                        showAddMechanicDialog = false,
                        isSavingMaster = false,
                        masterSuccessMessage = "Mekanik ${name.trim()} dicatat lokal (offline)"
                    )
                }
            }
        }
    }
}
