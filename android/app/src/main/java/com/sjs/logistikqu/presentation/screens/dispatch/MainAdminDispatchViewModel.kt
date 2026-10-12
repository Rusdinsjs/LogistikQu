package com.sjs.logistikqu.presentation.screens.dispatch

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.RejectReplenishmentRequestDto
import com.sjs.logistikqu.data.api.models.ReplenishmentRequestDto
import com.sjs.logistikqu.data.api.models.VerifyReplenishmentRequestDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MainAdminDispatchUiState(
    val requests: List<ReplenishmentRequestDto> = emptyList(),
    val isLoading: Boolean = false,
    val isProcessingAction: Boolean = false,
    val verifyDialogRequest: ReplenishmentRequestDto? = null,
    val adminNotes: String = "",
    val returnDialogRequest: ReplenishmentRequestDto? = null,
    val returnReason: String = "",
    val actionSuccessMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class MainAdminDispatchViewModel @Inject constructor(
    private val apiService: LogistikQuApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainAdminDispatchUiState())
    val uiState: StateFlow<MainAdminDispatchUiState> = _uiState.asStateFlow()

    init {
        loadRequests()
    }

    fun loadRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val resp = apiService.getReplenishmentRequests(warehouseId = null, status = null)
                if (resp.isSuccessful) {
                    val all = resp.body() ?: emptyList()
                    val actionable = all.filter {
                        it.status == "REQUESTED" || it.status == "RETURNED_TO_MAIN_ADMIN"
                    }
                    _uiState.update {
                        it.copy(
                            requests = actionable,
                            isLoading = false
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Gagal memuat antrean permohonan (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Gagal terhubung ke server pusat"
                    )
                }
            }
        }
    }

    fun openVerifyDialog(req: ReplenishmentRequestDto) {
        _uiState.update { it.copy(verifyDialogRequest = req, adminNotes = "Stok gudang utama telah diverifikasi siap drop", errorMessage = null) }
    }

    fun openReturnDialog(req: ReplenishmentRequestDto) {
        _uiState.update { it.copy(returnDialogRequest = req, returnReason = "", errorMessage = null) }
    }

    fun dismissDialogs() {
        _uiState.update { it.copy(verifyDialogRequest = null, returnDialogRequest = null) }
    }

    fun onAdminNotesChanged(notes: String) {
        _uiState.update { it.copy(adminNotes = notes) }
    }

    fun onReturnReasonChanged(reason: String) {
        _uiState.update { it.copy(returnReason = reason) }
    }

    fun confirmVerify() {
        val req = _uiState.value.verifyDialogRequest ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingAction = true, errorMessage = null) }
            try {
                val resp = apiService.verifyReplenishmentRequest(
                    id = req.id,
                    request = VerifyReplenishmentRequestDto(
                        adminNotes = _uiState.value.adminNotes,
                        items = emptyList() // Backend preserves items if empty
                    )
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            verifyDialogRequest = null,
                            actionSuccessMessage = "Permohonan ${req.requestNumber} diverifikasi dan diajukan ke Supervisor!"
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            errorMessage = "Gagal memverifikasi permohonan (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessingAction = false,
                        errorMessage = e.localizedMessage ?: "Gagal memverifikasi permohonan"
                    )
                }
            }
        }
    }

    fun confirmReturn() {
        val req = _uiState.value.returnDialogRequest ?: return
        if (_uiState.value.returnReason.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Alasan pengembalian ke kontainer wajib diisi!") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingAction = true, errorMessage = null) }
            try {
                val resp = apiService.returnToContainerReplenishmentRequest(
                    id = req.id,
                    request = RejectReplenishmentRequestDto(reason = _uiState.value.returnReason)
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            returnDialogRequest = null,
                            actionSuccessMessage = "Permohonan ${req.requestNumber} dikembalikan ke Admin Kontainer."
                        )
                    }
                    loadRequests()
                } else {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            errorMessage = "Gagal mengembalikan permohonan (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessingAction = false,
                        errorMessage = e.localizedMessage ?: "Gagal mengembalikan permohonan"
                    )
                }
            }
        }
    }

    fun clearSuccessMessage() {
        _uiState.update { it.copy(actionSuccessMessage = null) }
    }
}
