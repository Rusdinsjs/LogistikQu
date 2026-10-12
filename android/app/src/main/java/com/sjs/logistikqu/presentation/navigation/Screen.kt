package com.sjs.logistikqu.presentation.navigation

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Dashboard : Screen("dashboard")
    data object StockCheck : Screen("stock_check")
    data object SparePartIssue : Screen("spare_part_issue")
    data object GoodsReceive : Screen("goods_receive")
    data object WarehouseTransfer : Screen("warehouse_transfer")
    data object SyncQueue : Screen("sync_queue")
}
