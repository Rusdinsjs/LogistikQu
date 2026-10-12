package com.sjs.logistikqu.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.sjs.logistikqu.presentation.screens.auth.LoginScreen
import com.sjs.logistikqu.presentation.screens.auth.LoginViewModel
import com.sjs.logistikqu.presentation.screens.dashboard.DashboardScreen
import com.sjs.logistikqu.presentation.screens.dashboard.DashboardViewModel
import com.sjs.logistikqu.presentation.screens.issue.SparePartIssueScreen
import com.sjs.logistikqu.presentation.screens.issue.SparePartIssueViewModel
import com.sjs.logistikqu.presentation.screens.profile.ProfileScreen
import com.sjs.logistikqu.presentation.screens.receive.GoodsReceiveScreen
import com.sjs.logistikqu.presentation.screens.receive.GoodsReceiveViewModel
import com.sjs.logistikqu.presentation.screens.stockcheck.StockCheckScreen
import com.sjs.logistikqu.presentation.screens.stockcheck.StockCheckViewModel
import com.sjs.logistikqu.presentation.screens.sync.SyncQueueScreen
import com.sjs.logistikqu.presentation.screens.sync.SyncQueueViewModel
import com.sjs.logistikqu.presentation.screens.transfer.WarehouseTransferScreen
import com.sjs.logistikqu.presentation.screens.transfer.WarehouseTransferViewModel

import com.sjs.logistikqu.presentation.screens.dispatch.MainAdminDispatchScreen
import com.sjs.logistikqu.presentation.screens.replenishment.ReplenishmentRequestScreen
import com.sjs.logistikqu.presentation.screens.returns.UsedPartReturnsScreen
import com.sjs.logistikqu.presentation.screens.supervisor.SupervisorApprovalScreen

@Composable
fun LogistikQuNavGraph(
    navController: NavHostController,
    startDestination: String = Screen.Login.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Login.route) {
            val viewModel: LoginViewModel = hiltViewModel()
            LoginScreen(
                viewModel = viewModel,
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            val viewModel: DashboardViewModel = hiltViewModel()
            DashboardScreen(
                viewModel = viewModel,
                onNavigateToStockCheck = { navController.navigate(Screen.StockCheck.route) },
                onNavigateToIssue = { navController.navigate(Screen.SparePartIssue.route) },
                onNavigateToReceive = { navController.navigate(Screen.GoodsReceive.route) },
                onNavigateToTransfer = { navController.navigate(Screen.WarehouseTransfer.route) },
                onNavigateToReplenishmentRequest = { navController.navigate(Screen.ReplenishmentRequest.route) },
                onNavigateToSupervisorApproval = { navController.navigate(Screen.SupervisorApproval.route) },
                onNavigateToMainAdminDispatch = { navController.navigate(Screen.MainAdminDispatch.route) },
                onNavigateToUsedPartReturns = { navController.navigate(Screen.UsedPartReturns.route) },
                onNavigateToMechanicRequest = { navController.navigate(Screen.MechanicRequest.route) },
                onNavigateToSyncQueue = { navController.navigate(Screen.SyncQueue.route) },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Dashboard.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.StockCheck.route) {
            val viewModel: StockCheckViewModel = hiltViewModel()
            StockCheckScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.SparePartIssue.route) {
            val viewModel: SparePartIssueViewModel = hiltViewModel()
            SparePartIssueScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.GoodsReceive.route) {
            val viewModel: GoodsReceiveViewModel = hiltViewModel()
            GoodsReceiveScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.WarehouseTransfer.route) {
            val viewModel: WarehouseTransferViewModel = hiltViewModel()
            WarehouseTransferScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.ReplenishmentRequest.route) {
            val viewModel: com.sjs.logistikqu.presentation.screens.replenishment.ReplenishmentRequestViewModel = hiltViewModel()
            ReplenishmentRequestScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.SupervisorApproval.route) {
            val viewModel: com.sjs.logistikqu.presentation.screens.supervisor.SupervisorApprovalViewModel = hiltViewModel()
            SupervisorApprovalScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.MainAdminDispatch.route) {
            val viewModel: com.sjs.logistikqu.presentation.screens.dispatch.MainAdminDispatchViewModel = hiltViewModel()
            MainAdminDispatchScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.UsedPartReturns.route) {
            val viewModel: com.sjs.logistikqu.presentation.screens.returns.UsedPartReturnsViewModel = hiltViewModel()
            UsedPartReturnsScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.MechanicRequest.route) {
            val viewModel: com.sjs.logistikqu.presentation.screens.mechanic.MechanicRequestViewModel = hiltViewModel()
            com.sjs.logistikqu.presentation.screens.mechanic.MechanicRequestScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.SyncQueue.route) {
            val viewModel: SyncQueueViewModel = hiltViewModel()
            SyncQueueScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Profile.route) {
            val viewModel: DashboardViewModel = hiltViewModel()
            val uiState by viewModel.uiState.collectAsState()
            ProfileScreen(
                user = uiState.user,
                activeWarehouse = uiState.activeWarehouse,
                onLogoutClick = {
                    viewModel.logout {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
