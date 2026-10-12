package com.sjs.logistikqu.presentation.navigation

import androidx.compose.runtime.Composable
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
import com.sjs.logistikqu.presentation.screens.receive.GoodsReceiveScreen
import com.sjs.logistikqu.presentation.screens.receive.GoodsReceiveViewModel
import com.sjs.logistikqu.presentation.screens.stockcheck.StockCheckScreen
import com.sjs.logistikqu.presentation.screens.stockcheck.StockCheckViewModel
import com.sjs.logistikqu.presentation.screens.sync.SyncQueueScreen
import com.sjs.logistikqu.presentation.screens.sync.SyncQueueViewModel
import com.sjs.logistikqu.presentation.screens.transfer.WarehouseTransferScreen
import com.sjs.logistikqu.presentation.screens.transfer.WarehouseTransferViewModel

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

        composable(Screen.SyncQueue.route) {
            val viewModel: SyncQueueViewModel = hiltViewModel()
            SyncQueueScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
