package com.sjs.logistikqu.presentation.screens.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import com.sjs.logistikqu.data.network.NetworkConnectivityManager
import com.sjs.logistikqu.data.network.NetworkStatus
import com.sjs.logistikqu.domain.entities.SyncQueueItem
import com.sjs.logistikqu.domain.usecase.SyncQueueUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class SyncFilter {
    ALL,
    PENDING,
    CONFLICT
}

data class SyncQueueUiState(
    val queueItems: List<SyncQueueItem> = emptyList(),
    val filteredItems: List<SyncQueueItem> = emptyList(),
    val activeFilter: SyncFilter = SyncFilter.ALL,
    val isOnline: Boolean = true,
    val deviceId: String = "ANDROID-WH-001",
    val lastSyncTime: Long = 0L,
    val isSyncing: Boolean = false,
    val syncSummaryMessage: String? = null,
    val pendingCount: Int = 0,
    val successCount: Int = 0,
    val failedCount: Int = 0,
    val conflictCount: Int = 0
)

@HiltViewModel
class SyncQueueViewModel @Inject constructor(
    private val syncQueueUseCase: SyncQueueUseCase,
    private val networkManager: NetworkConnectivityManager,
    private val preferencesManager: UserPreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(SyncQueueUiState())
    val uiState: StateFlow<SyncQueueUiState> = _uiState.asStateFlow()

    init {
        observeNetwork()
        observePreferences()
        observeQueue()
    }

    private fun observeNetwork() {
        viewModelScope.launch {
            networkManager.networkStatusFlow.collect { status ->
                _uiState.update { it.copy(isOnline = status == NetworkStatus.ONLINE) }
            }
        }
    }

    private fun observePreferences() {
        viewModelScope.launch {
            combine(
                preferencesManager.deviceIdFlow,
                preferencesManager.lastSyncTimeFlow
            ) { devId, lastSync ->
                Pair(devId, lastSync)
            }.collect { (devId, lastSync) ->
                _uiState.update {
                    it.copy(
                        deviceId = devId,
                        lastSyncTime = lastSync
                    )
                }
            }
        }
    }

    private fun observeQueue() {
        viewModelScope.launch {
            syncQueueUseCase.getAllQueue().collect { list ->
                val pending = list.count { it.status == "PENDING" || it.status == "PROCESSING" }
                val success = list.count { it.status == "SUCCESS" }
                val failed = list.count { it.status == "FAILED" }
                val conflict = list.count { it.status == "CONFLICT" }

                _uiState.update { current ->
                    val filtered = applyFilter(list, current.activeFilter)
                    current.copy(
                        queueItems = list,
                        filteredItems = filtered,
                        pendingCount = pending,
                        successCount = success,
                        failedCount = failed,
                        conflictCount = conflict
                    )
                }
            }
        }
    }

    fun setFilter(filter: SyncFilter) {
        _uiState.update { current ->
            current.copy(
                activeFilter = filter,
                filteredItems = applyFilter(current.queueItems, filter)
            )
        }
    }

    private fun applyFilter(list: List<SyncQueueItem>, filter: SyncFilter): List<SyncQueueItem> {
        return when (filter) {
            SyncFilter.ALL -> list
            SyncFilter.PENDING -> list.filter { it.status == "PENDING" || it.status == "PROCESSING" || it.status == "FAILED" }
            SyncFilter.CONFLICT -> list.filter { it.status == "CONFLICT" }
        }
    }

    fun triggerSyncNow() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, syncSummaryMessage = null) }
            val result = syncQueueUseCase.triggerSync()
            _uiState.update {
                it.copy(
                    isSyncing = false,
                    syncSummaryMessage = if (result.isSuccess) {
                        val res = result.getOrNull()
                        "Sinkronisasi Selesai: ${res?.successCount ?: 0} Berhasil, ${res?.failedCount ?: 0} Gagal, ${res?.conflictCount ?: 0} Konflik"
                    } else {
                        "Gagal sinkronisasi: ${result.exceptionOrNull()?.localizedMessage}"
                    }
                )
            }
        }
    }

    fun resolveConflict(conflictId: String, resolution: String, notes: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true) }
            val result = syncQueueUseCase.resolveConflict(conflictId, resolution, notes)
            _uiState.update {
                it.copy(
                    isSyncing = false,
                    syncSummaryMessage = if (result.isSuccess) {
                        "Resolusi konflik $resolution berhasil diterapkan ke server!"
                    } else {
                        "Gagal resolusi konflik: ${result.exceptionOrNull()?.localizedMessage}"
                    }
                )
            }
        }
    }
}
