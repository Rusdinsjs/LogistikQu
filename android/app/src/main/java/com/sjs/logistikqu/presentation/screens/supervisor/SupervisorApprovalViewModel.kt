package com.sjs.logistikqu.presentation.screens.supervisor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.ApproveReplenishmentRequestDto
import com.sjs.logistikqu.data.api.models.RejectReplenishmentRequestDto
import com.sjs.logistikqu.data.api.models.ReplenishmentRequestDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SupervisorApprovalUiState(
    val requests: List<ReplenishmentRequestDto> = emptyList(),
    val isLoading: Boolean = false,
    val selectedFilter: String = "VERIFIED",
    val isProcessingAction: Boolean = false,
    val actionSuccessMessage: String? = null,
    val errorMessage: String? = null,
    val approveDialogRequest: ReplenishmentRequestDto? = null,
    val supervisorNotes: String = "",
    val rejectDialogRequest: ReplenishmentRequestDto? = null,
    val rejectReason: String = ""
) {
    val pendingCount: Int get() = requests.count { it.status == "VERIFIED" || it.status == "REQUESTED" }
}

@HiltViewModel
class SupervisorApprovalViewModel @Inject constructor(
    private val apiService: LogistikQuApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(SupervisorApprovalUiState())
    val uiState: StateFlow<SupervisorApprovalUiState> = _uiState.asStateFlow()

    init {
        loadRequests()
    }

    fun loadRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val status = if (_uiState.value.selectedFilter == "ALL") null else _uiState.value.selectedFilter
            try {
                val resp = apiService.getReplenishmentRequests(warehouseId = null, status = status)
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            requests = resp.body() ?: emptyList(),
                            isLoading = false
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Gagal memuat daftar permohonan (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Koneksi terputus ke server pusat"
                    )
                }
            }
        }
    }

    fun onFilterSelected(filter: String) {
        _uiState.update { it.copy(selectedFilter = filter) }
        loadRequests()
    }

    fun openApproveDialog(req: ReplenishmentRequestDto) {
        _uiState.update { it.copy(approveDialogRequest = req, supervisorNotes = "", errorMessage = null) }
    }

    fun openRejectDialog(req: ReplenishmentRequestDto) {
        _uiState.update { it.copy(rejectDialogRequest = req, rejectReason = "", errorMessage = null) }
    }

    fun dismissDialogs() {
        _uiState.update { it.copy(approveDialogRequest = null, rejectDialogRequest = null) }
    }

    fun onSupervisorNotesChanged(notes: String) {
        _uiState.update { it.copy(supervisorNotes = notes) }
    }

    fun onRejectReasonChanged(reason: String) {
        _uiState.update { it.copy(rejectReason = reason) }
    }

    fun confirmApprove() {
        val req = _uiState.value.approveDialogRequest ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingAction = true, errorMessage = null) }
            try {
                val resp = apiService.approveReplenishmentRequest(
                    id = req.id,
                    request = ApproveReplenishmentRequestDto(supervisorNotes = _uiState.value.supervisorNotes.ifBlank { null })
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            approveDialogRequest = null,
                            actionSuccessMessage = "Permohonan ${req.requestNumber} berhasil disetujui! Surat Jalan STO diterbitkan."
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            errorMessage = "Gagal menyetujui permohonan (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessingAction = false,
                        errorMessage = e.localizedMessage ?: "Gagal menyetujui permohonan"
                    )
                }
            }
        }
    }

    fun confirmReject() {
        val req = _uiState.value.rejectDialogRequest ?: return
        if (_uiState.value.rejectReason.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Alasan penolakan / revisi wajib diisi!") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingAction = true, errorMessage = null) }
            try {
                val resp = apiService.rejectSupervisorReplenishmentRequest(
                    id = req.id,
                    request = RejectReplenishmentRequestDto(reason = _uiState.value.rejectReason)
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            rejectDialogRequest = null,
                            actionSuccessMessage = "Permohonan ${req.requestNumber} ditolak dan dikembalikan ke Admin Utama."
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            errorMessage = "Gagal menolak permohonan (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessingAction = false,
                        errorMessage = e.localizedMessage ?: "Gagal menolak permohonan"
                    )
                }
            }
        }
    }

    fun clearSuccessMessage() {
        _uiState.update { it.copy(actionSuccessMessage = null) }
    }
}
