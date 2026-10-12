package com.sjs.logistikqu.presentation.screens.mechanic

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.*
import com.sjs.logistikqu.data.database.dao.SyncQueueDao
import com.sjs.logistikqu.data.database.entities.SyncQueueEntity
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import com.sjs.logistikqu.data.network.NetworkConnectivityManager
import com.google.gson.Gson
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class MechanicRequestUiState(
    val requests: List<MechanicRequestDto> = emptyList(),
    val summary: MechanicRequestSummaryDto? = null,
    val isLoading: Boolean = false,
    val activeWarehouseId: String = "WH-CONT-HE",
    val statusFilter: String? = null,
    val typeFilter: String? = null,
    val isCreateDialogOpen: Boolean = false,
    val selectedDetail: MechanicRequestDetailDto? = null,
    val isDetailDialogOpen: Boolean = false,
    val duplicateWarning: String? = null,
    // Form fields
    val formType: String = "REPLACEMENT",
    val formUnitNumber: String = "",
    val formHmKm: String = "",
    val formDamageCategory: String = "WEAR",
    val formDamageDescription: String = "",
    val formDamagePhotoBase64: String? = null,
    val formSparePartId: String = "",
    val formQuantity: String = "1",
    val formReturnReason: String = "UNUSED",
    val formNotes: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val userRole: String = "MECHANIC",
    val userPermissions: List<String> = emptyList(),
    val showAddEquipmentDialog: Boolean = false,
    val isSavingEquipment: Boolean = false
)

@HiltViewModel
class MechanicRequestViewModel @Inject constructor(
    private val apiService: LogistikQuApiService,
    private val userPreferences: UserPreferencesManager,
    private val syncQueueDao: SyncQueueDao,
    private val networkConnectivityManager: NetworkConnectivityManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(MechanicRequestUiState())
    val uiState: StateFlow<MechanicRequestUiState> = _uiState.asStateFlow()

    private val gson = Gson()

    init {
        viewModelScope.launch {
            val wh = userPreferences.warehouseIdFlow.first()
            val role = userPreferences.roleFlow.first() ?: "MECHANIC"
            val perms = userPreferences.permissionsFlow.first()
            _uiState.update {
                it.copy(
                    activeWarehouseId = wh,
                    userRole = role,
                    userPermissions = perms
                )
            }
            loadRequests()
        }
    }

    fun loadRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val wh = _uiState.value.activeWarehouseId
            val status = _uiState.value.statusFilter
            val isOnline = networkConnectivityManager.isCurrentlyConnected()

            if (isOnline) {
                try {
                    val requestsResp = apiService.getMechanicRequests(
                        warehouseId = wh,
                        status = status
                    )
                    val summaryResp = apiService.getMechanicRequestSummary(warehouseId = wh)

                    if (requestsResp.isSuccessful) {
                        _uiState.update {
                            it.copy(
                                requests = requestsResp.body() ?: emptyList(),
                                summary = summaryResp.body(),
                                isLoading = false
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                errorMessage = "Gagal memuat data permohonan (${requestsResp.code()})"
                            )
                        }
                    }
                } catch (e: Exception) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = e.message ?: "Terjadi kesalahan jaringan"
                        )
                    }
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Mode Offline: Menampilkan data lokal"
                    )
                }
            }
        }
    }

    fun openDetail(requestId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val resp = apiService.getMechanicRequestDetail(requestId)
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            selectedDetail = resp.body(),
                            isDetailDialogOpen = true,
                            isLoading = false
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Gagal memuat detail permohonan"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message ?: "Koneksi gagal"
                    )
                }
            }
        }
    }

    fun closeDetail() {
        _uiState.update { it.copy(isDetailDialogOpen = false, selectedDetail = null) }
    }

    fun openCreateDialog() {
        _uiState.update {
            it.copy(
                isCreateDialogOpen = true,
                formType = "REPLACEMENT",
                formUnitNumber = "",
                formHmKm = "",
                formDamageCategory = "WEAR",
                formDamageDescription = "",
                formDamagePhotoBase64 = null,
                formSparePartId = "",
                formQuantity = "1",
                formReturnReason = "UNUSED",
                formNotes = "",
                duplicateWarning = null,
                errorMessage = null
            )
        }
    }

    fun closeCreateDialog() {
        _uiState.update { it.copy(isCreateDialogOpen = false, duplicateWarning = null) }
    }

    fun setFormType(type: String) {
        _uiState.update { it.copy(formType = type) }
    }

    fun updateFormField(
        unit: String? = null,
        hmKm: String? = null,
        damageCategory: String? = null,
        damageDesc: String? = null,
        partId: String? = null,
        qty: String? = null,
        returnReason: String? = null,
        notes: String? = null,
        photoBase64: String? = null
    ) {
        _uiState.update { current ->
            current.copy(
                formUnitNumber = unit ?: current.formUnitNumber,
                formHmKm = hmKm ?: current.formHmKm,
                formDamageCategory = damageCategory ?: current.formDamageCategory,
                formDamageDescription = damageDesc ?: current.formDamageDescription,
                formSparePartId = partId ?: current.formSparePartId,
                formQuantity = qty ?: current.formQuantity,
                formReturnReason = returnReason ?: current.formReturnReason,
                formNotes = notes ?: current.formNotes,
                formDamagePhotoBase64 = photoBase64 ?: current.formDamagePhotoBase64
            )
        }
    }

    fun submitRequest(force: Boolean = false) {
        val state = _uiState.value
        val clientUuid = UUID.randomUUID().toString()

        val itemDto = CreateMechanicRequestItemDto(
            sparePartId = state.formSparePartId.ifBlank { "FLT-001" },
            qty = state.formQuantity.toDoubleOrNull() ?: 1.0,
            itemCondition = if (state.formType == "RETURN") "NEW" else null
        )

        val reqDto = CreateMechanicRequestDto(
            requestType = state.formType,
            warehouseId = state.activeWarehouseId,
            unitNumber = if (state.formType == "REPLACEMENT") state.formUnitNumber.ifBlank { "DT-001" } else null,
            hmKm = state.formHmKm.toDoubleOrNull() ?: 0.0,
            damageCategory = if (state.formType == "REPLACEMENT") state.formDamageCategory else null,
            damageDescription = if (state.formType == "REPLACEMENT") state.formDamageDescription.ifBlank { "Pemeriksaan rutin" } else null,
            damagePhotoUrl = state.formDamagePhotoBase64 ?: "data:image/jpeg;base64,placeholder",
            returnReason = if (state.formType == "RETURN") state.formReturnReason else null,
            notes = state.formNotes.ifBlank { null },
            clientUuid = clientUuid,
            items = listOf(itemDto)
        )

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val isOnline = networkConnectivityManager.isCurrentlyConnected()

            if (isOnline) {
                try {
                    val resp = apiService.createMechanicRequest(force = force, request = reqDto)
                    if (resp.isSuccessful) {
                        val body = resp.body()
                        if (body?.duplicateWarning == true) {
                            _uiState.update {
                                it.copy(
                                    isSubmitting = false,
                                    duplicateWarning = body.message
                                )
                            }
                        } else {
                            _uiState.update {
                                it.copy(
                                    isSubmitting = false,
                                    isCreateDialogOpen = false,
                                    successMessage = body?.message ?: "Permohonan berhasil diajukan"
                                )
                            }
                            loadRequests()
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                errorMessage = "Gagal mengajukan permohonan (${resp.code()})"
                            )
                        }
                    }
                } catch (e: Exception) {
                    // Queue for offline sync if exception
                    queueOfflineRequest(clientUuid, reqDto)
                }
            } else {
                queueOfflineRequest(clientUuid, reqDto)
            }
        }
    }

    private suspend fun queueOfflineRequest(clientUuid: String, reqDto: CreateMechanicRequestDto) {
        val syncEntity = SyncQueueEntity(
            id = clientUuid,
            transaction_type = "MECHANIC_REQUEST",
            payload = gson.toJson(reqDto),
            status = "PENDING"
        )
        syncQueueDao.insert(syncEntity)
        _uiState.update {
            it.copy(
                isSubmitting = false,
                isCreateDialogOpen = false,
                successMessage = "Mode Offline: Permohonan disimpan dalam antrian sinkronisasi"
            )
        }
    }

    fun approveRequest(requestId: String, notes: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true) }
            try {
                val resp = apiService.approveMechanicRequest(
                    requestId,
                    ApproveMechanicRequestDto(notes = notes)
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isDetailDialogOpen = false,
                            successMessage = "Permohonan berhasil disetujui"
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(isSubmitting = false, errorMessage = "Gagal approve (${resp.code()})")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSubmitting = false, errorMessage = e.message ?: "Koneksi gagal")
                }
            }
        }
    }

    fun fulfillRequest(requestId: String, notes: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true) }
            try {
                val resp = apiService.fulfillMechanicRequest(
                    requestId,
                    FulfillMechanicRequestDto(notes = notes)
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isDetailDialogOpen = false,
                            successMessage = "Serah terima barang berhasil diselesaikan"
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(isSubmitting = false, errorMessage = "Gagal fulfill (${resp.code()})")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSubmitting = false, errorMessage = e.message ?: "Koneksi gagal")
                }
            }
        }
    }

    fun cancelRequest(requestId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true) }
            try {
                val resp = apiService.cancelMechanicRequest(requestId, CancelMechanicRequestDto())
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isDetailDialogOpen = false,
                            successMessage = "Permohonan dibatalkan"
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(isSubmitting = false, errorMessage = "Gagal batalkan (${resp.code()})")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSubmitting = false, errorMessage = e.message ?: "Koneksi gagal")
                }
            }
        }
    }

    fun setStatusFilter(status: String?) {
        _uiState.update { it.copy(statusFilter = status) }
        loadRequests()
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }

    fun openAddEquipmentDialog() = _uiState.update { it.copy(showAddEquipmentDialog = true, errorMessage = null) }
    fun closeAddEquipmentDialog() = _uiState.update { it.copy(showAddEquipmentDialog = false) }

    fun quickAddEquipment(unitNumber: String, name: String, type: String, hmKm: Double?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingEquipment = true, errorMessage = null) }
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
                            formUnitNumber = eq.unitNumber,
                            formHmKm = hmKm?.toString() ?: it.formHmKm,
                            showAddEquipmentDialog = false,
                            isSavingEquipment = false,
                            successMessage = "Unit ${eq.unitNumber} berhasil didaftarkan!"
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            formUnitNumber = unitNumber.trim().uppercase(),
                            formHmKm = hmKm?.toString() ?: it.formHmKm,
                            showAddEquipmentDialog = false,
                            isSavingEquipment = false,
                            successMessage = "Unit ${unitNumber.trim().uppercase()} dicatat di permohonan"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        formUnitNumber = unitNumber.trim().uppercase(),
                        formHmKm = hmKm?.toString() ?: it.formHmKm,
                        showAddEquipmentDialog = false,
                        isSavingEquipment = false,
                        successMessage = "Unit ${unitNumber.trim().uppercase()} dicatat lokal (offline)"
                    )
                }
            }
        }
    }
}
