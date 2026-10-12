package com.sjs.logistikqu.presentation.screens.replenishment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import com.sjs.logistikqu.domain.entities.ReplenishmentDraftItem
import com.sjs.logistikqu.domain.entities.ReplenishmentRecommendation
import com.sjs.logistikqu.domain.usecase.GetReplenishmentRecommendationsUseCase
import com.sjs.logistikqu.domain.usecase.SubmitReplenishmentRequestUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReplenishmentRequestUiState(
    val isLoading: Boolean = false,
    val warehouseId: String = "WH-CONT-HE",
    val searchQuery: String = "",
    val recommendations: List<ReplenishmentRecommendation> = emptyList(),
    val draftItems: Map<String, ReplenishmentDraftItem> = emptyMap(),
    val overallNotes: String = "",
    val isSubmitting: Boolean = false,
    val showConfirmDialog: Boolean = false,
    val successTicketNumber: String? = null,
    val errorMessage: String? = null
) {
    val selectedCount: Int get() = draftItems.size
    val totalRequestedQuantity: Double get() = draftItems.values.sumOf { it.requestedQty }

    val filteredRecommendations: List<ReplenishmentRecommendation>
        get() {
            if (searchQuery.isBlank()) return recommendations
            val q = searchQuery.trim().lowercase()
            return recommendations.filter {
                it.partName.lowercase().contains(q) ||
                it.sparePartId.lowercase().contains(q)
            }
        }
}

@HiltViewModel
class ReplenishmentRequestViewModel @Inject constructor(
    private val getRecommendationsUseCase: GetReplenishmentRecommendationsUseCase,
    private val submitRequestUseCase: SubmitReplenishmentRequestUseCase,
    private val preferencesManager: UserPreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReplenishmentRequestUiState())
    val uiState: StateFlow<ReplenishmentRequestUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val whId = preferencesManager.warehouseIdFlow.first().ifBlank { "WH-CONT-HE" }
            _uiState.update { it.copy(warehouseId = whId) }
            loadRecommendations(whId)
        }
    }

    fun loadRecommendations(warehouseId: String = _uiState.value.warehouseId) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val res = getRecommendationsUseCase(warehouseId)
            if (res.isSuccess) {
                val list = res.getOrDefault(emptyList())
                _uiState.update { current ->
                    // Auto-select items that are critically below ROP / minStock with recommended order qty
                    val initialDrafts = current.draftItems.toMutableMap()
                    list.filter { it.currentStock <= it.minStock }.forEach { rec ->
                        if (!initialDrafts.containsKey(rec.sparePartId)) {
                            initialDrafts[rec.sparePartId] = ReplenishmentDraftItem(
                                sparePartId = rec.sparePartId,
                                partName = rec.partName,
                                unitOfMeasure = rec.unitOfMeasure,
                                currentStock = rec.currentStock,
                                recommendedQty = rec.recommendedOrderQty,
                                requestedQty = rec.recommendedOrderQty,
                                notes = "Otomatis di bawah ROP"
                            )
                        }
                    }
                    current.copy(
                        isLoading = false,
                        recommendations = list,
                        draftItems = initialDrafts
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = res.exceptionOrNull()?.localizedMessage ?: "Gagal memuat rekomendasi ROP"
                    )
                }
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun toggleItemSelection(rec: ReplenishmentRecommendation) {
        _uiState.update { current ->
            val updated = current.draftItems.toMutableMap()
            if (updated.containsKey(rec.sparePartId)) {
                updated.remove(rec.sparePartId)
            } else {
                val defaultQty = if (rec.recommendedOrderQty > 0) rec.recommendedOrderQty else 5.0
                updated[rec.sparePartId] = ReplenishmentDraftItem(
                    sparePartId = rec.sparePartId,
                    partName = rec.partName,
                    unitOfMeasure = rec.unitOfMeasure,
                    currentStock = rec.currentStock,
                    recommendedQty = rec.recommendedOrderQty,
                    requestedQty = defaultQty,
                    notes = ""
                )
            }
            current.copy(draftItems = updated)
        }
    }

    fun updateRequestedQty(sparePartId: String, newQty: Double) {
        if (newQty < 0) return
        _uiState.update { current ->
            val updated = current.draftItems.toMutableMap()
            val existing = updated[sparePartId]
            if (existing != null) {
                if (newQty == 0.0) {
                    updated.remove(sparePartId)
                } else {
                    updated[sparePartId] = existing.copy(requestedQty = newQty)
                }
            }
            current.copy(draftItems = updated)
        }
    }

    fun incrementRequestedQty(sparePartId: String, delta: Double = 1.0) {
        val currentQty = _uiState.value.draftItems[sparePartId]?.requestedQty ?: 0.0
        updateRequestedQty(sparePartId, currentQty + delta)
    }

    fun decrementRequestedQty(sparePartId: String, delta: Double = 1.0) {
        val currentQty = _uiState.value.draftItems[sparePartId]?.requestedQty ?: 0.0
        val target = (currentQty - delta).coerceAtLeast(1.0)
        updateRequestedQty(sparePartId, target)
    }

    fun updateItemNotes(sparePartId: String, notes: String) {
        _uiState.update { current ->
            val updated = current.draftItems.toMutableMap()
            val existing = updated[sparePartId]
            if (existing != null) {
                updated[sparePartId] = existing.copy(notes = notes)
            }
            current.copy(draftItems = updated)
        }
    }

    fun onOverallNotesChanged(notes: String) {
        _uiState.update { it.copy(overallNotes = notes) }
    }

    fun openConfirmationDialog() {
        if (_uiState.value.draftItems.isEmpty()) {
            _uiState.update { it.copy(errorMessage = "Pilih minimal 1 suku cadang untuk diajukan") }
            return
        }
        _uiState.update { it.copy(showConfirmDialog = true, errorMessage = null) }
    }

    fun dismissConfirmationDialog() {
        _uiState.update { it.copy(showConfirmDialog = false) }
    }

    fun submitRequest() {
        val state = _uiState.value
        val items = state.draftItems.values.toList()
        if (items.isEmpty()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, showConfirmDialog = false, errorMessage = null) }
            val res = submitRequestUseCase(
                containerWarehouseId = state.warehouseId,
                items = items,
                notes = state.overallNotes.ifBlank { null }
            )
            if (res.isSuccess) {
                val ticketNo = res.getOrNull() ?: "REQ-SUBMITTED"
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        successTicketNumber = ticketNo,
                        draftItems = emptyMap(),
                        overallNotes = ""
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = res.exceptionOrNull()?.localizedMessage ?: "Gagal mengirim pengajuan replenishment"
                    )
                }
            }
        }
    }

    fun clearSuccessMessage() {
        _uiState.update { it.copy(successTicketNumber = null) }
    }
}
