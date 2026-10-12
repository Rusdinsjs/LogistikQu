package com.sjs.logistikqu.presentation.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.api.models.MobileNotificationDto
import com.sjs.logistikqu.domain.entities.User
import com.sjs.logistikqu.domain.repository.AuthRepository
import com.sjs.logistikqu.domain.repository.SyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val user: User? = null,
    val pendingSyncCount: Int = 0,
    val unreadNotificationCount: Int = 0,
    val pendingDropsCount: Int = 0,
    val isSyncing: Boolean = false,
    val lowStockCount: Int = 4,
    val todayTransactionsCount: Int = 18,
    val activeWarehouse: String = "WH-CONT-HE",
    val notifications: List<MobileNotificationDto> = emptyList(),
    val showNotificationsModal: Boolean = false,
    val showApprovalModal: Boolean = false
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val syncRepository: SyncRepository,
    private val apiService: LogistikQuApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    private fun loadDashboardData() {
        viewModelScope.launch {
            authRepository.getLoggedInUser().collect { user ->
                _uiState.update { it.copy(user = user, activeWarehouse = user?.warehouseId ?: "WH-CONT-HE") }
            }
        }
        viewModelScope.launch {
            syncRepository.getPendingQueueFlow().collect { queue ->
                _uiState.update { it.copy(pendingSyncCount = queue.size) }
            }
        }
        loadNotifications()
    }

    fun loadNotifications() {
        viewModelScope.launch {
            try {
                val res = apiService.getUnreadNotificationCount()
                if (res.isSuccessful) {
                    val count = res.body()?.unreadCount ?: 0
                    _uiState.update { it.copy(unreadNotificationCount = count) }
                }
            } catch (e: Exception) {
                // Offline fallback
            }
        }
    }

    fun openNotificationsModal() {
        viewModelScope.launch {
            _uiState.update { it.copy(showNotificationsModal = true) }
            try {
                val res = apiService.getNotifications()
                if (res.isSuccessful && res.body() != null) {
                    _uiState.update { it.copy(notifications = res.body()!!) }
                }
            } catch (e: Exception) {
                // Keep existing or empty list on offline
            }
        }
    }

    fun closeNotificationsModal() {
        _uiState.update { it.copy(showNotificationsModal = false) }
    }

    fun openApprovalModal() {
        _uiState.update { it.copy(showApprovalModal = true) }
    }

    fun closeApprovalModal() {
        _uiState.update { it.copy(showApprovalModal = false) }
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch {
            try {
                apiService.markNotificationAsRead(id)
                val res = apiService.getNotifications()
                if (res.isSuccessful && res.body() != null) {
                    val list = res.body()!!
                    val unread = list.count { !it.isRead }
                    _uiState.update { it.copy(notifications = list, unreadNotificationCount = unread) }
                }
            } catch (e: Exception) {
                // Offline fallback
            }
        }
    }

    fun triggerSync() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true) }
            syncRepository.processPendingQueue()
            loadNotifications()
            _uiState.update { it.copy(isSyncing = false) }
        }
    }

    fun logout(onLogoutSuccess: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            onLogoutSuccess()
        }
    }
}
