package com.sjs.logistikqu.presentation.screens.returns

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.ReceiveContainerReturnRequestDto
import com.sjs.logistikqu.data.api.models.UsedPartReturnDto
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UsedPartReturnsUiState(
    val returns: List<UsedPartReturnDto> = emptyList(),
    val isLoading: Boolean = false,
    val selectedStatus: String = "ALL",
    val isMechanic: Boolean = false,
    val isProcessingAction: Boolean = false,
    val receiveModalReturn: UsedPartReturnDto? = null,
    val containerNotes: String = "Komponen bekas/core diterima di kontainer",
    val containerPhotoPath: String? = null,
    val actionSuccessMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class UsedPartReturnsViewModel @Inject constructor(
    private val apiService: LogistikQuApiService,
    private val userPreferences: UserPreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(UsedPartReturnsUiState())
    val uiState: StateFlow<UsedPartReturnsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val role = userPreferences.roleFlow.first() ?: ""
            _uiState.update { it.copy(isMechanic = role == "MECHANIC") }
            loadReturns()
        }
    }

    fun loadReturns() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val status = if (_uiState.value.selectedStatus == "ALL") null else _uiState.value.selectedStatus
            try {
                val resp = apiService.getUsedPartReturns(warehouseId = null, status = status, search = null)
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            returns = resp.body() ?: emptyList(),
                            isLoading = false
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Gagal memuat daftar core return (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Gagal terhubung ke server"
                    )
                }
            }
        }
    }

    fun onStatusFilterSelected(status: String) {
        _uiState.update { it.copy(selectedStatus = status) }
        loadReturns()
    }

    fun openReceiveModal(item: UsedPartReturnDto) {
        _uiState.update {
            it.copy(
                receiveModalReturn = item,
                containerNotes = "Komponen fisik bekas telah diserahkan mekanik di loket kontainer",
                containerPhotoPath = null,
                errorMessage = null
            )
        }
    }

    fun dismissReceiveModal() {
        _uiState.update { it.copy(receiveModalReturn = null) }
    }

    fun onNotesChanged(notes: String) {
        _uiState.update { it.copy(containerNotes = notes) }
    }

    fun onPhotoCaptured(path: String) {
        _uiState.update { it.copy(containerPhotoPath = path) }
    }

    fun confirmReceiveCore() {
        val ret = _uiState.value.receiveModalReturn ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingAction = true, errorMessage = null) }
            try {
                val resp = apiService.receiveContainerReturn(
                    id = ret.id,
                    request = ReceiveContainerReturnRequestDto(
                        containerNotes = _uiState.value.containerNotes,
                        containerPhotoUrl = _uiState.value.containerPhotoPath ?: "file:///cache/core_return.jpg"
                    )
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            receiveModalReturn = null,
                            actionSuccessMessage = "Core return ${ret.returnNumber} berhasil diterima di kontainer!"
                        )
                    }
                    loadReturns()
                } else {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            errorMessage = "Gagal memproses penerimaan core (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessingAction = false,
                        errorMessage = e.localizedMessage ?: "Gagal memproses penerimaan core"
                    )
                }
            }
        }
    }

    fun transferCoreToMain(ret: UsedPartReturnDto) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingAction = true, errorMessage = null) }
            try {
                val resp = apiService.transferCoreToMain(
                    id = ret.id,
                    payload = mapOf("notes" to "Core dikirim kembali ke Gudang Utama")
                )
                if (resp.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            actionSuccessMessage = "Core ${ret.returnNumber} berhasil ditransfer ke Gudang Utama!"
                        )
                    }
                    loadReturns()
                } else {
                    _uiState.update {
                        it.copy(
                            isProcessingAction = false,
                            errorMessage = "Gagal mentransfer core (${resp.code()})"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessingAction = false,
                        errorMessage = e.localizedMessage ?: "Gagal mentransfer core"
                    )
                }
            }
        }
    }

    fun clearSuccessMessage() {
        _uiState.update { it.copy(actionSuccessMessage = null) }
    }
}
