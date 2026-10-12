package com.sjs.logistikqu.presentation.screens.dashboard

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.res.painterResource
import com.sjs.logistikqu.R
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.presentation.components.MetricStatCard
import com.sjs.logistikqu.presentation.screens.profile.ProfileScreen
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToStockCheck: () -> Unit,
    onNavigateToIssue: () -> Unit,
    onNavigateToReceive: () -> Unit,
    onNavigateToTransfer: () -> Unit,
    onNavigateToReplenishmentRequest: () -> Unit = {},
    onNavigateToSupervisorApproval: () -> Unit = {},
    onNavigateToMainAdminDispatch: () -> Unit = {},
    onNavigateToUsedPartReturns: () -> Unit = {},
    onNavigateToMechanicRequest: () -> Unit = {},
    onNavigateToSyncQueue: () -> Unit,
    onLogout: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = Slate950,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .background(Slate900)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Main Header Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Left: Logo & App Title & Warehouse Badge
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { selectedTab = 0 }
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Logo SJS-VIPO",
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(10.dp))
                        )

                        Spacer(modifier = Modifier.width(10.dp))

                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "LogistikQu",
                                    fontWeight = FontWeight.Bold,
                                    color = White,
                                    fontSize = 17.sp
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Slate800,
                                    border = BorderStroke(1.dp, Slate700)
                                ) {
                                    Text(
                                        text = uiState.activeWarehouse,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = IndustrialCyan,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Text(
                                text = "SJS-VIPO Mining WMS Handheld",
                                color = Slate400,
                                fontSize = 11.sp
                            )
                        }
                    }

                    // Right: Actions (Notification, Home shortcut, Logout)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Notifications
                        IconButton(
                            onClick = viewModel::openNotificationsModal,
                            modifier = Modifier.size(38.dp)
                        ) {
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
                                    tint = if (uiState.unreadNotificationCount > 0) IndustrialAmber else Slate400,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        // Quick Logout Action
                        IconButton(
                            onClick = { showLogoutDialog = true },
                            modifier = Modifier.size(38.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PowerSettingsNew,
                                contentDescription = "Keluar",
                                tint = IndustrialRose,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Cloud Status & Sync Banner (Streamlined)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Cloud Connection Status Pill
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Slate950,
                        border = BorderStroke(1.dp, Slate800)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(IndustrialEmerald)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "logistik.sjsgroup.online",
                                color = Slate300,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "• Online",
                                color = IndustrialEmerald,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // Sync Status Indicator
                    Surface(
                        modifier = Modifier.clickable { selectedTab = 2 },
                        shape = RoundedCornerShape(20.dp),
                        color = if (uiState.pendingSyncCount > 0) IndustrialAmber.copy(alpha = 0.15f) else Slate950,
                        border = BorderStroke(1.dp, if (uiState.pendingSyncCount > 0) IndustrialAmber.copy(alpha = 0.5f) else Slate800)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            if (uiState.isSyncing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(12.dp),
                                    strokeWidth = 2.dp,
                                    color = IndustrialCyan
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Sync,
                                    contentDescription = null,
                                    tint = if (uiState.pendingSyncCount > 0) IndustrialAmber else IndustrialEmerald,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (uiState.pendingSyncCount > 0) "${uiState.pendingSyncCount} Antrean" else "Tersinkron",
                                color = if (uiState.pendingSyncCount > 0) IndustrialAmber else Slate300,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        },
        bottomBar = {
            // Mainstream Modern Material 3 Bottom Navigation Bar
            NavigationBar(
                containerColor = Slate900,
                tonalElevation = 6.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                // 1. Home / Beranda
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Home,
                            contentDescription = "Beranda"
                        )
                    },
                    label = { Text("Beranda", fontSize = 10.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Slate950,
                        selectedTextColor = IndustrialEmerald,
                        indicatorColor = IndustrialEmerald,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate400
                    )
                )

                // 2. Operasional / Workflows
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.GridView,
                            contentDescription = "Operasional"
                        )
                    },
                    label = { Text("Operasional", fontSize = 10.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Slate950,
                        selectedTextColor = IndustrialCyan,
                        indicatorColor = IndustrialCyan,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate400
                    )
                )

                // 3. Antrean Sync
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = {
                        BadgedBox(
                            badge = {
                                if (uiState.pendingSyncCount > 0) {
                                    Badge(containerColor = IndustrialAmber, contentColor = Slate950) {
                                        Text("${uiState.pendingSyncCount}", fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Sync,
                                contentDescription = "Sinkronisasi"
                            )
                        }
                    },
                    label = { Text("Sinkronisasi", fontSize = 10.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Slate950,
                        selectedTextColor = IndustrialAmber,
                        indicatorColor = IndustrialAmber,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate400
                    )
                )

                // 4. Profil / Pengaturan
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Profil"
                        )
                    },
                    label = { Text("Profil", fontSize = 10.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Slate950,
                        selectedTextColor = IndustrialEmerald,
                        indicatorColor = IndustrialEmerald,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate400
                    )
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (selectedTab) {
                0 -> HomeDashboardTab(
                    uiState = uiState,
                    onNavigateToStockCheck = onNavigateToStockCheck,
                    onNavigateToIssue = onNavigateToIssue,
                    onNavigateToReceive = onNavigateToReceive,
                    onNavigateToTransfer = onNavigateToTransfer,
                    onNavigateToReplenishmentRequest = onNavigateToReplenishmentRequest,
                    onNavigateToSupervisorApproval = onNavigateToSupervisorApproval,
                    onNavigateToMainAdminDispatch = onNavigateToMainAdminDispatch,
                    onNavigateToUsedPartReturns = onNavigateToUsedPartReturns,
                    onNavigateToMechanicRequest = onNavigateToMechanicRequest,
                    onNavigateToSyncTab = { selectedTab = 2 },
                    onNavigateToProfileTab = { selectedTab = 3 }
                )
                1 -> OperationsMenuTab(
                    uiState = uiState,
                    onNavigateToStockCheck = onNavigateToStockCheck,
                    onNavigateToIssue = onNavigateToIssue,
                    onNavigateToReceive = onNavigateToReceive,
                    onNavigateToTransfer = onNavigateToTransfer,
                    onNavigateToReplenishmentRequest = onNavigateToReplenishmentRequest,
                    onNavigateToSupervisorApproval = onNavigateToSupervisorApproval,
                    onNavigateToMainAdminDispatch = onNavigateToMainAdminDispatch,
                    onNavigateToUsedPartReturns = onNavigateToUsedPartReturns,
                    onNavigateToMechanicRequest = onNavigateToMechanicRequest
                )
                2 -> SyncOverviewTab(
                    uiState = uiState,
                    onTriggerSync = viewModel::triggerSync,
                    onOpenDetailedQueue = onNavigateToSyncQueue
                )
                3 -> ProfileScreen(
                    user = uiState.user,
                    activeWarehouse = uiState.activeWarehouse,
                    onLogoutClick = { viewModel.logout(onLogout) },
                    onNavigateBack = { selectedTab = 0 }
                )
            }
        }
    }

    // Confirmation Logout Modal Dialog
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            containerColor = Slate900,
            icon = {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(IndustrialRose.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = null,
                        tint = IndustrialRose,
                        modifier = Modifier.size(28.dp)
                    )
                }
            },
            title = {
                Text(
                    text = "Konfirmasi Logout",
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            },
            text = {
                Text(
                    text = "Apakah Anda yakin ingin keluar dari akun ${uiState.user?.fullName ?: "ini"}?\n\nSeluruh data transaksi offline tersimpan aman di database lokal perangkat.",
                    color = Slate300,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        viewModel.logout(onLogout)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialRose),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("YA, KELUAR", color = White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("BATAL", color = Slate400, fontWeight = FontWeight.SemiBold)
                }
            }
        )
    }

    // Supervisor Approval Modal Dialog
    if (uiState.showApprovalModal) {
        AlertDialog(
            onDismissRequest = viewModel::closeApprovalModal,
            containerColor = Slate900,
            icon = {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(IndustrialAmber.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.FactCheck,
                        contentDescription = null,
                        tint = IndustrialAmber,
                        modifier = Modifier.size(28.dp)
                    )
                }
            },
            title = {
                Text(
                    text = "Otorisasi & Approval Supervisor",
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Permintaan Replenishment & Koreksi Stok Opname dari unit lapangan menunggu persetujuan otorisasi Anda.",
                        color = Slate300,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        color = Slate950,
                        border = BorderStroke(1.dp, Slate800)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("No Req: RPL-2026-004", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = IndustrialAmber)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("Permintaan Tambahan 50 Pcs Oil Filter CAT 320D (Site Sorowako Pit A)", fontSize = 12.sp, color = Slate200)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.closeApprovalModal()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialEmerald),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("SETUJUI (APPROVE)", color = Slate950, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeApprovalModal) {
                    Text("TUTUP", color = Slate400, fontWeight = FontWeight.SemiBold)
                }
            }
        )
    }

    // Notification Modal Bottom Sheet
    if (uiState.showNotificationsModal) {
        ModalBottomSheet(
            onDismissRequest = viewModel::closeNotificationsModal,
            containerColor = Slate900,
            contentColor = White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Pemberitahuan & Alert",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = White
                    )
                    TextButton(onClick = viewModel::closeNotificationsModal) {
                        Text("Tutup", color = IndustrialCyan)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                if (uiState.notifications.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Tidak ada pemberitahuan baru", color = Slate400, fontSize = 14.sp)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 400.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.notifications) { notif ->
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.markNotificationRead(notif.id)
                                        viewModel.closeNotificationsModal()
                                        val typeUpper = (notif.triggerType + " " + notif.title + " " + notif.message).uppercase()
                                        when {
                                            typeUpper.contains("APPROVAL") || typeUpper.contains("REPLENISHMENT") || typeUpper.contains("OTORISASI") || typeUpper.contains("SUPERVISOR") -> {
                                                selectedTab = 0
                                                viewModel.openApprovalModal()
                                            }
                                            typeUpper.contains("ISSUE") || typeUpper.contains("POS") -> {
                                                onNavigateToIssue()
                                            }
                                            typeUpper.contains("RECEIVE") || typeUpper.contains("STO") || typeUpper.contains("DROP") -> {
                                                onNavigateToReceive()
                                            }
                                            typeUpper.contains("TRANSFER") -> {
                                                onNavigateToTransfer()
                                            }
                                            typeUpper.contains("STOCK") || typeUpper.contains("OPNAME") || typeUpper.contains("AUDIT") || typeUpper.contains("KRITIS") -> {
                                                onNavigateToStockCheck()
                                            }
                                            else -> {
                                                selectedTab = 2
                                            }
                                        }
                                    },
                                shape = RoundedCornerShape(12.dp),
                                color = if (notif.isRead) Slate950 else Slate800,
                                border = BorderStroke(1.dp, if (notif.isRead) Slate800 else IndustrialAmber)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = notif.title,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = if (notif.isRead) Slate200 else White
                                        )
                                        if (!notif.isRead) {
                                            Surface(
                                                shape = CircleShape,
                                                color = IndustrialAmber
                                            ) {
                                                Box(modifier = Modifier.size(8.dp))
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = notif.message,
                                        fontSize = 12.sp,
                                        color = Slate400,
                                        lineHeight = 16.sp
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

// -------------------------------------------------------------------------------------
// TAB 0: HOME / BERANDA DASHBOARD
// -------------------------------------------------------------------------------------
@Composable
private fun HomeDashboardTab(
    uiState: DashboardUiState,
    onNavigateToStockCheck: () -> Unit,
    onNavigateToIssue: () -> Unit,
    onNavigateToReceive: () -> Unit,
    onNavigateToTransfer: () -> Unit,
    onNavigateToReplenishmentRequest: () -> Unit,
    onNavigateToSupervisorApproval: () -> Unit,
    onNavigateToMainAdminDispatch: () -> Unit,
    onNavigateToUsedPartReturns: () -> Unit,
    onNavigateToMechanicRequest: () -> Unit,
    onNavigateToSyncTab: () -> Unit,
    onNavigateToProfileTab: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Welcome User Greeting Banner
        item {
            val user = uiState.user
            val roleBadgeText = when {
                user?.isSuperAdmin == true -> "Super Admin"
                user?.isSupervisor == true -> "Supervisor Logistik"
                user?.isMainAdmin == true -> "Admin Gudang Utama"
                user?.isContainerAdmin == true -> "Admin Kontainer"
                user?.isMechanic == true -> "Mekanik Armada"
                else -> user?.role ?: "Petugas Logistik"
            }
            val roleBadgeColor = when {
                user?.isSuperAdmin == true -> Color(0xFFA855F7)
                user?.isSupervisor == true -> IndustrialAmber
                user?.isMainAdmin == true -> IndustrialBlue
                user?.isContainerAdmin == true -> IndustrialEmerald
                user?.isMechanic == true -> Slate400
                else -> IndustrialCyan
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigateToProfileTab() },
                shape = RoundedCornerShape(18.dp),
                color = Slate900,
                border = BorderStroke(1.dp, Slate800)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(roleBadgeColor, IndustrialCyan))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = user?.fullName?.take(2)?.uppercase() ?: "LQ",
                                fontWeight = FontWeight.Bold,
                                color = Slate950,
                                fontSize = 16.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Selamat Bertugas,",
                                fontSize = 12.sp,
                                color = Slate400
                            )
                            Text(
                                text = user?.fullName ?: "Petugas Logistik",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = roleBadgeColor.copy(alpha = 0.15f),
                                    border = BorderStroke(1.dp, roleBadgeColor.copy(alpha = 0.4f))
                                ) {
                                    Text(
                                        text = roleBadgeText,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = roleBadgeColor,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = uiState.activeWarehouse,
                                    fontSize = 11.sp,
                                    color = Slate400,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = "Lihat Profil",
                        tint = Slate400,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // 2. Metrics Quick Glance Cards (2 columns, odd last card 1 column wide)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MetricStatCard(
                        title = "Stok Kritis",
                        value = "${uiState.lowStockCount}",
                        subtitle = "Di Bawah Min",
                        color = IndustrialRose,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToStockCheck
                    )
                    MetricStatCard(
                        title = "Transaksi",
                        value = "${uiState.todayTransactionsCount}",
                        subtitle = "Hari Ini",
                        color = IndustrialEmerald,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MetricStatCard(
                        title = "Antrean Sync",
                        value = "${uiState.pendingSyncCount}",
                        subtitle = "Lokal Offline",
                        color = if (uiState.pendingSyncCount > 0) IndustrialAmber else Slate400,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onNavigateToSyncTab
                    )
                }
            }
        }

        // 3. Hero Barcode Scanner Card (Quick Scan)
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigateToStockCheck() },
                shape = RoundedCornerShape(18.dp),
                color = Slate900,
                border = BorderStroke(1.5.dp, IndustrialCyan.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(IndustrialCyan.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = null,
                            tint = IndustrialCyan,
                            modifier = Modifier.size(30.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Pindai Barcode Cepat",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Deteksi instan Suku Cadang, Rak Bin, atau Unit Armada",
                            fontSize = 12.sp,
                            color = Slate400,
                            lineHeight = 16.sp
                        )
                    }
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = IndustrialCyan,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
        }

        // 6. Supervisor Additional Privilege Tile (Quick shortcut if supervisor/admin)
        if (uiState.user?.isSupervisor == true) {
            item {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToSupervisorApproval() },
                    shape = RoundedCornerShape(16.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, IndustrialAmber.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(IndustrialAmber.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.FactCheck,
                                contentDescription = null,
                                tint = IndustrialAmber,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Pusat Otorisasi Supervisor",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                            Text(
                                text = "Otorisasi STO & Koreksi Opname Divisi",
                                fontSize = 12.sp,
                                color = Slate400
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = IndustrialAmber.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = "Buka Panel",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = IndustrialAmber,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

// -------------------------------------------------------------------------------------
// TAB 1: OPERATIONS MENU TAB (Workflow Launchpad)
// -------------------------------------------------------------------------------------
@Composable
private fun OperationsMenuTab(
    uiState: DashboardUiState,
    onNavigateToStockCheck: () -> Unit,
    onNavigateToIssue: () -> Unit,
    onNavigateToReceive: () -> Unit,
    onNavigateToTransfer: () -> Unit,
    onNavigateToReplenishmentRequest: () -> Unit,
    onNavigateToSupervisorApproval: () -> Unit,
    onNavigateToMainAdminDispatch: () -> Unit,
    onNavigateToUsedPartReturns: () -> Unit,
    onNavigateToMechanicRequest: () -> Unit = {}
) {
    val user = uiState.user
    val tabTitle = when {
        user?.isMechanic == true -> "MODUL OPERASIONAL MEKANIK"
        user?.isSupervisor == true && !user.isSuperAdmin -> "MODUL OTORISASI SUPERVISOR"
        user?.isMainAdmin == true && !user.isSuperAdmin -> "MODUL LOGISTIK GUDANG UTAMA"
        user?.isContainerAdmin == true && !user.isSuperAdmin -> "MODUL GUDANG KONTAINER LAPANGAN"
        else -> "KATALOG MODUL OPERASIONAL SISTEM"
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = tabTitle,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400,
                letterSpacing = 1.sp
            )
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when {
                    user?.isMechanic == true -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Permohonan Stok",
                                subtitle = "Pengajuan & Bukti Rusak",
                                tag = "Pengajuan",
                                actionLabel = "Buat Permohonan",
                                icon = Icons.Default.PostAdd,
                                gradientColors = listOf(Color(0xFF6D28D9), Color(0xFF8B5CF6)),
                                accentColor = IndustrialPurple,
                                onClick = onNavigateToMechanicRequest
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Tanggungan Core",
                                subtitle = "Part Wajib Kembali",
                                tag = "BR-004",
                                actionLabel = "Cek Retur",
                                icon = Icons.Default.Sync,
                                gradientColors = listOf(Color(0xFFD97706), Color(0xFFF59E0B)),
                                accentColor = IndustrialAmber,
                                onClick = onNavigateToUsedPartReturns
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Pengambilan Unit",
                                subtitle = "Audit Riwayat Loket",
                                tag = "Mechanic",
                                actionLabel = "Lihat Data",
                                icon = Icons.Default.PrecisionManufacturing,
                                gradientColors = listOf(Color(0xFF059669), Color(0xFF10B981)),
                                accentColor = IndustrialEmerald,
                                onClick = onNavigateToStockCheck
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Katalog Suku Cadang",
                                subtitle = "Cek Ketersediaan Part",
                                tag = "Catalog",
                                actionLabel = "Cari Part",
                                icon = Icons.Default.Inventory2,
                                gradientColors = listOf(Color(0xFF0891B2), Color(0xFF06B6D4)),
                                accentColor = IndustrialCyan,
                                onClick = onNavigateToStockCheck
                            )
                        }
                    }

                    user?.isMainAdmin == true && !user.isSuperAdmin -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Verifikasi STO",
                                subtitle = "Alokasi Koli Permohonan",
                                tag = "Verification",
                                actionLabel = "Cek Permohonan",
                                icon = Icons.Default.Assignment,
                                gradientColors = listOf(Color(0xFF2563EB), Color(0xFF3B82F6)),
                                accentColor = IndustrialBlue,
                                onClick = onNavigateToMainAdminDispatch
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Dispatch STO",
                                subtitle = "Kirim Drop ke Pit Site",
                                tag = "In-Transit",
                                actionLabel = "Kirim Barang",
                                icon = Icons.Default.LocalShipping,
                                gradientColors = listOf(Color(0xFFD97706), Color(0xFFF59E0B)),
                                accentColor = IndustrialAmber,
                                onClick = onNavigateToMainAdminDispatch
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Retur Part Bekas",
                                subtitle = "Terima & Disposisi Core",
                                tag = "Core Return",
                                actionLabel = "Kelola Retur",
                                icon = Icons.Default.Sync,
                                gradientColors = listOf(Color(0xFFE11D48), Color(0xFFF43F5E)),
                                accentColor = IndustrialRose,
                                onClick = onNavigateToUsedPartReturns
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Stok Gudang Pusat",
                                subtitle = "Monitoring Persediaan",
                                tag = "Main WH",
                                actionLabel = "Cek Stok",
                                icon = Icons.Default.Inventory2,
                                gradientColors = listOf(Color(0xFF0891B2), Color(0xFF06B6D4)),
                                accentColor = IndustrialCyan,
                                onClick = onNavigateToStockCheck
                            )
                        }
                    }

                    user?.isSupervisor == true && !user.isSuperAdmin -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Otorisasi STO",
                                subtitle = "Approval Replenishment",
                                tag = "Approval Req",
                                actionLabel = "Buka Otorisasi",
                                icon = Icons.Default.FactCheck,
                                gradientColors = listOf(Color(0xFFD97706), Color(0xFFF59E0B)),
                                accentColor = IndustrialAmber,
                                onClick = onNavigateToSupervisorApproval
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Approval Opname",
                                subtitle = "Otorisasi Selisih Fisik",
                                tag = "Stock Audit",
                                actionLabel = "Review Koreksi",
                                icon = Icons.Default.CheckCircle,
                                gradientColors = listOf(Color(0xFFE11D48), Color(0xFFF43F5E)),
                                accentColor = IndustrialRose,
                                onClick = onNavigateToSupervisorApproval
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Konsumsi Abnormal",
                                subtitle = "Deteksi Pemakaian >3x",
                                tag = "Alert Unit",
                                actionLabel = "Investigasi",
                                icon = Icons.Default.Warning,
                                gradientColors = listOf(Color(0xFF475569), Color(0xFF334155)),
                                accentColor = Slate400,
                                onClick = onNavigateToStockCheck
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Kartu Stok Divisi",
                                subtitle = "Audit Mutasi & Ledger",
                                tag = "Ledger Audit",
                                actionLabel = "Lihat Stok",
                                icon = Icons.Default.Inventory2,
                                gradientColors = listOf(Color(0xFF059669), Color(0xFF10B981)),
                                accentColor = IndustrialEmerald,
                                onClick = onNavigateToStockCheck
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.fillMaxWidth(),
                                title = "Retur Part Bekas",
                                subtitle = "Monitoring Core Return BR-004",
                                tag = "Core Return",
                                actionLabel = "Audit Retur",
                                icon = Icons.Default.Sync,
                                gradientColors = listOf(Color(0xFF0891B2), Color(0xFF06B6D4)),
                                accentColor = IndustrialCyan,
                                onClick = onNavigateToUsedPartReturns
                            )
                        }
                    }

                    else -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Pengeluaran Part",
                                subtitle = "Loket POS Unit",
                                tag = "BR-001/004",
                                actionLabel = "Buka Loket",
                                icon = Icons.Default.PrecisionManufacturing,
                                gradientColors = listOf(Color(0xFF059669), Color(0xFF10B981)),
                                accentColor = IndustrialEmerald,
                                onClick = onNavigateToIssue
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Penerimaan STO",
                                subtitle = "Verifikasi Kiriman Pusat",
                                tag = "Drop Inbound",
                                actionLabel = "Terima Barang",
                                icon = Icons.Default.LocalShipping,
                                gradientColors = listOf(Color(0xFFD97706), Color(0xFFF59E0B)),
                                accentColor = IndustrialAmber,
                                onClick = onNavigateToReceive
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Pengajuan Reorder",
                                subtitle = "Kebutuhan Buffer ROP",
                                tag = "Reorder ROP",
                                actionLabel = "Buat Tiket",
                                icon = Icons.Default.TrendingUp,
                                gradientColors = listOf(Color(0xFF0891B2), Color(0xFF06B6D4)),
                                accentColor = IndustrialCyan,
                                onClick = onNavigateToReplenishmentRequest
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Retur Part Bekas",
                                subtitle = "Terima Core Return BR-004",
                                tag = "Core Return",
                                actionLabel = "Proses Retur",
                                icon = Icons.Default.Sync,
                                gradientColors = listOf(Color(0xFFE11D48), Color(0xFFF43F5E)),
                                accentColor = IndustrialRose,
                                onClick = onNavigateToUsedPartReturns
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Cek Stok & Rak",
                                subtitle = "Opname & Audit Bin Fisik",
                                tag = "Opname Bin",
                                actionLabel = "Pindai Rak",
                                icon = Icons.Default.Inventory2,
                                gradientColors = listOf(Color(0xFF0891B2), Color(0xFF06B6D4)),
                                accentColor = IndustrialCyan,
                                onClick = onNavigateToStockCheck
                            )
                            BentoGridCard(
                                modifier = Modifier.weight(1f),
                                title = "Transfer Gudang",
                                subtitle = "Mutasi Antar Kontainer",
                                tag = "Inter-WH",
                                actionLabel = "Buat Mutasi",
                                icon = Icons.Default.SwapHoriz,
                                gradientColors = listOf(Color(0xFF2563EB), Color(0xFF3B82F6)),
                                accentColor = IndustrialBlue,
                                onClick = onNavigateToTransfer
                            )
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------
// TAB 2: SYNC OVERVIEW TAB
// -------------------------------------------------------------------------------------
@Composable
private fun SyncOverviewTab(
    uiState: DashboardUiState,
    onTriggerSync: () -> Unit,
    onOpenDetailedQueue: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            color = Slate900,
            border = BorderStroke(1.dp, Slate800)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(if (uiState.pendingSyncCount > 0) IndustrialAmber.copy(alpha = 0.15f) else IndustrialEmerald.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Sync,
                        contentDescription = null,
                        tint = if (uiState.pendingSyncCount > 0) IndustrialAmber else IndustrialEmerald,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = if (uiState.pendingSyncCount > 0) "${uiState.pendingSyncCount} Transaksi Menunggu Sync" else "Seluruh Data Tersinkronisasi",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = White
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Aplikasi berjalan dalam mode Offline-First. Seluruh transaksi pengeluaran dan penerimaan otomatis tersimpan di database lokal HP dan dikirim ke server saat online.",
                    fontSize = 12.sp,
                    color = Slate400,
                    lineHeight = 17.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = onTriggerSync,
                    enabled = !uiState.isSyncing,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialEmerald)
                ) {
                    if (uiState.isSyncing) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Slate950, strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Menyinkronkan...", color = Slate950, fontWeight = FontWeight.Bold)
                    } else {
                        Icon(Icons.Default.Sync, contentDescription = null, tint = Slate950, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("SINKRONKAN SEKARANG", color = Slate950, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedButton(
                    onClick = onOpenDetailedQueue,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300),
                    border = BorderStroke(1.dp, Slate700)
                ) {
                    Text("Buka Riwayat Antrean Detail", fontSize = 13.sp)
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------
// REUSABLE MODERN COMPONENTS: BentoGridCard & OperationWorkflowTile
// -------------------------------------------------------------------------------------
@Composable
private fun BentoGridCard(
    modifier: Modifier = Modifier,
    title: String,
    subtitle: String,
    tag: String,
    actionLabel: String,
    icon: ImageVector,
    gradientColors: List<Color>,
    accentColor: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .heightIn(min = 156.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = Slate900,
        border = BorderStroke(1.2.dp, Slate800)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Upper Row: Gradient Icon & Tag Pill
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Brush.linearGradient(gradientColors)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = Slate950,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = accentColor.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, accentColor.copy(alpha = 0.3f))
                ) {
                    Text(
                        text = tag,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = accentColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Text Info
            Column {
                Text(
                    text = title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = White,
                    lineHeight = 18.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    fontSize = 11.sp,
                    color = Slate400,
                    lineHeight = 14.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Bottom CTA Label
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = actionLabel,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = accentColor
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}

@Composable
private fun OperationWorkflowTile(
    title: String,
    subtitle: String,
    badge: String,
    accentColor: Color,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = Slate900,
        border = BorderStroke(1.dp, Slate800)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(accentColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(26.dp)
                )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = title,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = White
                    )
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = accentColor.copy(alpha = 0.12f)
                    ) {
                        Text(
                            text = badge,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = accentColor,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
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
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
