package com.sjs.logistikqu.presentation.navigation

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Dashboard : Screen("dashboard")
    data object StockCheck : Screen("stock_check")
    data object SparePartIssue : Screen("spare_part_issue")
    data object GoodsReceive : Screen("goods_receive")
    data object WarehouseTransfer : Screen("warehouse_transfer")
    data object ReplenishmentRequest : Screen("replenishment_request")
    data object SupervisorApproval : Screen("supervisor_approval")
    data object MainAdminDispatch : Screen("main_admin_dispatch")
    data object UsedPartReturns : Screen("used_part_returns")
    data object MechanicRequest : Screen("mechanic_request")
    data object SyncQueue : Screen("sync_queue")
    data object Profile : Screen("profile")
}
