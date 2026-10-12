package com.sjs.logistikqu.presentation.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.presentation.components.MetricStatCard
import com.sjs.logistikqu.presentation.components.SyncStatusBadge
import com.sjs.logistikqu.presentation.theme.*

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToStockCheck: () -> Unit,
    onNavigateToIssue: () -> Unit,
    onNavigateToReceive: () -> Unit,
    onNavigateToTransfer: () -> Unit,
    onNavigateToSyncQueue: () -> Unit,
    onLogout: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = Slate950,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Slate900)
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(IndustrialEmerald, RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("LQ", fontWeight = FontWeight.Black, color = Slate950, fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = uiState.user?.fullName ?: "Petugas Logistik",
                                fontWeight = FontWeight.Bold,
                                color = White,
                                fontSize = 16.sp
                            )
                            Text(
                                text = "Role: ${uiState.user?.role ?: "Operator"} | ${uiState.activeWarehouse}",
                                color = Slate400,
                                fontSize = 12.sp
                            )
                        }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = viewModel::loadNotifications) {
                            BadgedBox(
                                badge = {
                                    if (uiState.unreadNotificationCount > 0) {
                                        Badge(
                                            containerColor = IndustrialRose,
                                            contentColor = White
                                        ) {
                                            Text(
                                                text = if (uiState.unreadNotificationCount > 99) "99+" else "${uiState.unreadNotificationCount}",
                                                fontSize = 10.sp
                                            )
                                        }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Notifications,
                                    contentDescription = "Notifikasi",
                                    tint = if (uiState.unreadNotificationCount > 0) IndustrialAmber else Slate400
                                )
                            }
                        }
                        IconButton(onClick = { viewModel.logout(onLogout) }) {
                            Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Slate400)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Offline Sync Status Banner
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    SyncStatusBadge(
                        pendingCount = uiState.pendingSyncCount,
                        onClick = onNavigateToSyncQueue
                    )

                    IconButton(
                        onClick = viewModel::triggerSync,
                        enabled = !uiState.isSyncing,
                        modifier = Modifier.size(36.dp)
                    ) {
                        if (uiState.isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = IndustrialCyan)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Sinkronkan", tint = IndustrialCyan)
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Metrics Quick Glance
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricStatCard(
                        title = "Stok Kritis",
                        value = "${uiState.lowStockCount} Part",
                        subtitle = "Di bawah Safety Stock",
                        color = IndustrialRose,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToStockCheck
                    )
                    MetricStatCard(
                        title = "Hari Ini",
                        value = "${uiState.todayTransactionsCount} Transaksi",
                        subtitle = "POS & Drop STO",
                        color = IndustrialEmerald,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Section: Operational Workflows (Large Rugged Action Cards)
            item {
                Text(
                    text = "MENU OPERASIONAL GUDANG",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate400,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            // Action 1: Stock Check
            item {
                WorkflowActionTile(
                    title = "1. Pengecekan Stok & Rak",
                    subtitle = "Pindai lokasi rak, verifikasi kuantitas fisik, dan catat hasil opname",
                    icon = Icons.Default.Inventory2,
                    badge = "Scan Bin",
                    accentColor = IndustrialCyan,
                    onClick = onNavigateToStockCheck
                )
            }

            // Action 2: Spare Part Issue
            item {
                WorkflowActionTile(
                    title = "2. Pengeluaran Part (POS Loket)",
                    subtitle = "Pengeluaran ke unit tambang (No Unit, HM/KM, Mekanik, Work Order)",
                    icon = Icons.Default.PrecisionManufacturing,
                    badge = "BR-001 s/d BR-004",
                    accentColor = IndustrialEmerald,
                    onClick = onNavigateToIssue
                )
            }

            // Action 3: Goods Receive
            item {
                WorkflowActionTile(
                    title = "3. Penerimaan Barang STO",
                    subtitle = "Konfirmasi penerimaan kiriman drop dari Gudang Utama ke Kontainer",
                    icon = Icons.Default.LocalShipping,
                    badge = "Scan Surat Jalan",
                    accentColor = IndustrialAmber,
                    onClick = onNavigateToReceive
                )
            }

            // Action 4: Warehouse Transfer
            item {
                WorkflowActionTile(
                    title = "4. Transfer Antar Gudang",
                    subtitle = "Mutasi suku cadang antar kontainer lapangan atau relokasi bin",
                    icon = Icons.Default.SwapHoriz,
                    badge = "Inter-WH",
                    accentColor = IndustrialBlue,
                    onClick = onNavigateToTransfer
                )
            }

            // Supervisor Additional Privilege Tile (Role-based)
            if (uiState.user?.isSupervisor == true) {
                item {
                    Text(
                        text = "OTORISASI SUPERVISOR",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = IndustrialAmber,
                        letterSpacing = 1.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                item {
                    WorkflowActionTile(
                        title = "Persetujuan Replenishment & Koreksi",
                        subtitle = "Otorisasi pengajuan buffer stock dan approval stock opname",
                        icon = Icons.Default.FactCheck,
                        badge = "Supervisor Only",
                        accentColor = IndustrialAmber,
                        onClick = { /* Navigasi ke approval view */ }
                    )
                }
            }
        }
    }
}

@Composable
fun WorkflowActionTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    badge: String,
    accentColor: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 96.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Slate900),
        border = androidx.compose.foundation.BorderStroke(1.5.dp, Slate800)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(accentColor.copy(alpha = 0.15f))
                    .border(1.dp, accentColor.copy(alpha = 0.4f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(28.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = title,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = White
                    )
                    Text(
                        text = badge,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = accentColor,
                        modifier = Modifier
                            .background(accentColor.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = Slate400,
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = Slate400,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
