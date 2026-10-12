package com.sjs.logistikqu.presentation.screens.sync

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.domain.entities.SyncQueueItem
import com.sjs.logistikqu.presentation.components.IndustrialButton
import com.sjs.logistikqu.presentation.components.LogistikQuTopBar
import com.sjs.logistikqu.presentation.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SyncQueueScreen(
    viewModel: SyncQueueViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy HH:mm:ss", Locale.getDefault()) }

    Scaffold(
        containerColor = Slate950,
        topBar = {
            LogistikQuTopBar(
                title = "Pusat Sinkronisasi Offline",
                isOnline = uiState.isOnline,
                pendingSyncCount = uiState.pendingCount,
                conflictCount = uiState.conflictCount,
                deviceId = uiState.deviceId,
                onNavigateBack = onNavigateBack
            )
        },
        bottomBar = {
            Surface(
                color = Slate900,
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                IndustrialButton(
                    text = if (uiState.isOnline) "SINKRONKAN SEKARANG KE SERVER" else "OFFLINE - MENUNGGU JARINGAN TAMBANG",
                    onClick = viewModel::triggerSyncNow,
                    isLoading = uiState.isSyncing,
                    icon = Icons.Default.Sync,
                    color = if (uiState.isOnline) IndustrialEmerald else Slate700,
                    enabled = uiState.isOnline && !uiState.isSyncing
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            // Last Sync Status Card
            Card(
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                border = BorderStroke(1.dp, Slate800)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Terakhir Sinkron:", fontSize = 11.sp, color = Slate400)
                        Text(
                            text = if (uiState.lastSyncTime > 0) dateFormat.format(Date(uiState.lastSyncTime)) else "Belum pernah sinkron",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (uiState.isOnline) IndustrialEmerald.copy(alpha = 0.2f) else IndustrialAmber.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = if (uiState.isOnline) "SERVER TERHUBUNG" else "DEAD ZONE TAMBANG",
                            color = if (uiState.isOnline) IndustrialEmerald else IndustrialAmber,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            // Sync Summary Alert if present
            if (uiState.syncSummaryMessage != null) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = IndustrialCyan.copy(alpha = 0.15f)),
                    border = BorderStroke(1.dp, IndustrialCyan)
                ) {
                    Text(
                        text = uiState.syncSummaryMessage!!,
                        color = IndustrialCyan,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // KPI Metric Cards Grid
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SyncKpiCard(
                    title = "Pending",
                    count = uiState.pendingCount,
                    color = IndustrialAmber,
                    modifier = Modifier.weight(1f)
                )
                SyncKpiCard(
                    title = "Sukses",
                    count = uiState.successCount,
                    color = IndustrialEmerald,
                    modifier = Modifier.weight(1f)
                )
                SyncKpiCard(
                    title = "Gagal",
                    count = uiState.failedCount,
                    color = IndustrialRose,
                    modifier = Modifier.weight(1f)
                )
                SyncKpiCard(
                    title = "Konflik",
                    count = uiState.conflictCount,
                    color = Color(0xFFEF4444),
                    modifier = Modifier.weight(1f)
                )
            }

            // Filter Tabs
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SyncFilterChip(
                    label = "Semua (${uiState.queueItems.size})",
                    isSelected = uiState.activeFilter == SyncFilter.ALL,
                    onClick = { viewModel.setFilter(SyncFilter.ALL) },
                    modifier = Modifier.weight(1f)
                )
                SyncFilterChip(
                    label = "Pending (${uiState.pendingCount})",
                    isSelected = uiState.activeFilter == SyncFilter.PENDING,
                    onClick = { viewModel.setFilter(SyncFilter.PENDING) },
                    modifier = Modifier.weight(1f)
                )
                SyncFilterChip(
                    label = "Konflik (${uiState.conflictCount})",
                    isSelected = uiState.activeFilter == SyncFilter.CONFLICT,
                    onClick = { viewModel.setFilter(SyncFilter.CONFLICT) },
                    modifier = Modifier.weight(1f)
                )
            }

            // Queue List or Empty State
            if (uiState.filteredItems.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize().weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.CloudDone,
                            contentDescription = null,
                            tint = IndustrialEmerald,
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Tidak Ada Antrean pada Kategori Ini",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                        Text(
                            text = "Database lokal Room sinkron dengan server LogistikQu",
                            fontSize = 12.sp,
                            color = Slate400
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize().weight(1f)
                ) {
                    items(uiState.filteredItems) { item ->
                        SyncQueueItemCard(
                            item = item,
                            dateFormat = dateFormat,
                            onResolveConflict = { resolution ->
                                viewModel.resolveConflict(item.id, resolution, "Resolved from Android Sync Center")
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SyncKpiCard(
    title: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Slate900),
        border = BorderStroke(1.dp, color.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = count.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black, color = color)
            Text(text = title, fontSize = 10.sp, color = Slate400, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun SyncFilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(10.dp),
        color = if (isSelected) IndustrialEmerald else Slate900,
        border = BorderStroke(1.dp, if (isSelected) IndustrialEmerald else Slate800)
    ) {
        Box(
            modifier = Modifier.padding(vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                color = if (isSelected) Slate950 else White,
                fontSize = 12.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}

@Composable
fun SyncQueueItemCard(
    item: SyncQueueItem,
    dateFormat: SimpleDateFormat,
    onResolveConflict: (resolution: String) -> Unit
) {
    val isConflict = item.status == "CONFLICT"
    val isFailed = item.status == "FAILED"
    val isSuccess = item.status == "SUCCESS"

    val statusColor = when (item.status) {
        "SUCCESS" -> IndustrialEmerald
        "PENDING", "PROCESSING" -> IndustrialAmber
        "FAILED" -> IndustrialRose
        "CONFLICT" -> Color(0xFFEF4444)
        else -> Slate400
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Slate900),
        border = BorderStroke(1.dp, if (isConflict) Color(0xFFEF4444) else if (isFailed) IndustrialRose else Slate800)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = when (item.transactionType) {
                            "ISSUE" -> Icons.Default.Output
                            "RECEIVE" -> Icons.Default.Input
                            "TRANSFER" -> Icons.Default.SwapHoriz
                            else -> Icons.Default.Inventory
                        },
                        contentDescription = null,
                        tint = IndustrialEmerald,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = item.transactionType,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = White
                    )
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = statusColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = item.status,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "ID: ${item.id}",
                fontSize = 11.sp,
                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                color = Slate400
            )

            Text(
                text = "Dibuat: ${dateFormat.format(Date(item.createdAt))}",
                fontSize = 11.sp,
                color = Slate400
            )

            if (item.retryCount > 0) {
                Text(
                    text = "Percobaan Ulang: ${item.retryCount}x",
                    fontSize = 11.sp,
                    color = IndustrialAmber
                )
            }

            // Error display
            if (!item.errorMessage.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = IndustrialRose.copy(alpha = 0.1f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Error: ${item.errorMessage}",
                        fontSize = 11.sp,
                        color = IndustrialRose,
                        modifier = Modifier.padding(8.dp)
                    )
                }
            }

            // Conflict Resolution Card
            if (isConflict) {
                Spacer(modifier = Modifier.height(10.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = Slate950),
                    border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "KONFLIK STOK SERVER DI DETEKSI",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFEF4444)
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Stok server tidak mencukupi untuk memenuhi transaksi lokal. Sesuai Server Authority, saldo fisik server dijadikan acuan.",
                            fontSize = 11.sp,
                            color = Slate300
                        )

                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { onResolveConflict("OVERRIDE") },
                                colors = ButtonDefaults.buttonColors(containerColor = IndustrialAmber),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("OVERRIDE", color = Slate950, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Button(
                                onClick = { onResolveConflict("REJECT") },
                                colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("REJECT", color = White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
