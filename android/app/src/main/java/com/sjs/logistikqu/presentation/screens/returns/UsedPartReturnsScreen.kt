package com.sjs.logistikqu.presentation.screens.returns

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.hilt.navigation.compose.hiltViewModel
import com.sjs.logistikqu.data.api.models.UsedPartReturnDto
import com.sjs.logistikqu.presentation.components.LogistikQuTopBar
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UsedPartReturnsScreen(
    viewModel: UsedPartReturnsViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = Slate950,
        topBar = {
            LogistikQuTopBar(
                title = "Pelacakan Core Return BR-004",
                isOnline = true,
                onNavigateBack = onNavigateBack
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, if (uiState.isMechanic) IndustrialAmber else IndustrialAmber.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.RotateLeft,
                                contentDescription = null,
                                tint = IndustrialAmber,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (uiState.isMechanic) "Tanggungan Core Retur Anda (BR-004)" else "Keterlacakan Komponen Bekas (Core)",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (uiState.isMechanic)
                                "Pantau komponen bekas (Filter, Alternator, Turbo, Starter) yang wajib Anda serahkan ke loket kontainer maksimal 1x24 jam setelah perbaikan."
                            else
                                "Aturan BR-004: Mekanik wajib mengembalikan komponen bekas (Filter, Alternator, Turbo, Starter) ke kontainer maksimal 1x24 jam sebelum WO ditutup.",
                            fontSize = 11.sp,
                            color = Slate300,
                            lineHeight = 15.sp
                        )

                        if (uiState.isMechanic) {
                            Spacer(modifier = Modifier.height(10.dp))
                            val pendingCount = uiState.returns.count { it.status == "PENDING_RETURN" }
                            val completedCount = uiState.returns.count { it.status != "PENDING_RETURN" }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Surface(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(8.dp),
                                    color = Slate950,
                                    border = BorderStroke(1.dp, IndustrialAmber.copy(alpha = 0.4f))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("BELUM DISERAHKAN", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = IndustrialAmber)
                                        Text("$pendingCount Part", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = White)
                                    }
                                }
                                Surface(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(8.dp),
                                    color = Slate950,
                                    border = BorderStroke(1.dp, IndustrialEmerald.copy(alpha = 0.4f))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("SUDAH DISERAHKAN", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = IndustrialEmerald)
                                        Text("$completedCount Part", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = White)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Success Feedback
            if (uiState.actionSuccessMessage != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = IndustrialEmerald.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, IndustrialEmerald)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = uiState.actionSuccessMessage!!,
                                color = IndustrialEmerald,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = viewModel::clearSuccessMessage) {
                                Icon(Icons.Default.Close, contentDescription = "Tutup", tint = Slate400)
                            }
                        }
                    }
                }
            }

            // Error Feedback
            if (uiState.errorMessage != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = IndustrialRose.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, IndustrialRose)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = IndustrialRose)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = uiState.errorMessage!!, color = IndustrialRose, fontSize = 12.sp)
                        }
                    }
                }
            }

            // Status Filter Chips
            item {
                val filters = listOf("ALL", "PENDING_RETURN", "RECEIVED_AT_CONTAINER", "COMPLETED")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(filters) { filter ->
                        val isSelected = uiState.selectedStatus == filter
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) IndustrialAmber else Slate900,
                            border = BorderStroke(1.dp, if (isSelected) IndustrialAmber else Slate800),
                            modifier = Modifier.clickable { viewModel.onStatusFilterSelected(filter) }
                        ) {
                            Text(
                                text = when (filter) {
                                    "PENDING_RETURN" -> "Dipegang Mekanik"
                                    "RECEIVED_AT_CONTAINER" -> "Disimpan di Kontainer"
                                    "COMPLETED" -> "Selesai (Di Gudang Utama)"
                                    else -> "Semua Retur"
                                },
                                color = if (isSelected) Slate950 else White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }

            // Section Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "DAFTAR CORE RETURN (${uiState.returns.size})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate400,
                        letterSpacing = 1.sp
                    )
                    IconButton(onClick = viewModel::loadReturns) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = IndustrialCyan, modifier = Modifier.size(18.dp))
                    }
                }
            }

            // List of Returns
            if (uiState.isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = IndustrialAmber)
                    }
                }
            } else if (uiState.returns.isEmpty()) {
                item {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = Slate900,
                        border = BorderStroke(1.dp, Slate800)
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp).fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald, modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Tidak Ada Core Tertunda", fontWeight = FontWeight.Bold, color = White, fontSize = 13.sp)
                            Text("Semua komponen bekas mekanik telah diserahkan.", color = Slate400, fontSize = 11.sp)
                        }
                    }
                }
            } else {
                items(uiState.returns, key = { it.id }) { ret ->
                    UsedPartCard(
                        item = ret,
                        isMechanic = uiState.isMechanic,
                        onReceive = { viewModel.openReceiveModal(ret) },
                        onTransfer = { viewModel.transferCoreToMain(ret) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }

    // Modal Receive Core
    if (uiState.receiveModalReturn != null) {
        val ret = uiState.receiveModalReturn!!
        AlertDialog(
            onDismissRequest = viewModel::dismissReceiveModal,
            containerColor = Slate900,
            title = {
                Text("Terima Core Fisik dari Mekanik", fontWeight = FontWeight.Bold, color = White, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Konfirmasi penerimaan komponen fisik bekas untuk tiket ${ret.returnNumber} (Part: ${ret.sparePartId}, Unit: ${ret.unitNumber}) dari mekanik ${ret.mechanicName}?",
                        color = Slate300,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = uiState.containerNotes,
                        onValueChange = viewModel::onNotesChanged,
                        label = { Text("Catatan Kondisi Fisik", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedBorderColor = IndustrialCyan,
                            unfocusedBorderColor = Slate800,
                            focusedTextColor = White
                        )
                    )
                    OutlinedButton(
                        onClick = { viewModel.onPhotoCaptured("file:///cache/core_${ret.returnNumber}.jpg") },
                        modifier = Modifier.fillMaxWidth().height(44.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, Slate700)
                    ) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (uiState.containerPhotoPath != null) "Foto Core Terlampir ✓" else "Ambil Foto Komponen Bekas", fontSize = 11.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::confirmReceiveCore,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !uiState.isProcessingAction
                ) {
                    if (uiState.isProcessingAction) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Slate950, strokeWidth = 2.dp)
                    } else {
                        Text("KONFIRMASI TERIMA", color = Slate950, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissReceiveModal) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun UsedPartCard(
    item: UsedPartReturnDto,
    isMechanic: Boolean = false,
    onReceive: () -> Unit,
    onTransfer: () -> Unit
) {
    val isPending = item.status == "PENDING_RETURN"
    val isAtContainer = item.status == "RECEIVED_AT_CONTAINER"

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Slate900,
        border = BorderStroke(1.dp, if (isPending) IndustrialAmber.copy(alpha = 0.5f) else Slate800),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.returnNumber,
                    fontWeight = FontWeight.Bold,
                    color = White,
                    fontSize = 13.sp
                )

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = when (item.status) {
                        "PENDING_RETURN" -> IndustrialRose.copy(alpha = 0.2f)
                        "RECEIVED_AT_CONTAINER" -> IndustrialCyan.copy(alpha = 0.2f)
                        else -> IndustrialEmerald.copy(alpha = 0.2f)
                    }
                ) {
                    Text(
                        text = item.status,
                        color = when (item.status) {
                            "PENDING_RETURN" -> IndustrialRose
                            "RECEIVED_AT_CONTAINER" -> IndustrialCyan
                            else -> IndustrialEmerald
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Text(
                text = "${item.sparePartId} • ${item.partName ?: "Komponen Core Rekondisi"}",
                color = White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Unit: ${item.unitNumber}", color = Slate300, fontSize = 11.sp)
                Text("Mekanik: ${item.mechanicName}", color = Slate300, fontSize = 11.sp)
                Text("Qty: ${item.qty.toInt()} ${item.unitOfMeasure}", color = IndustrialAmber, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }

            if (isMechanic) {
                // Tampilan Khusus Mekanik: Status Tanggungan Core Retur (BR-004)
                if (isPending) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = IndustrialRose.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, IndustrialRose.copy(alpha = 0.4f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = IndustrialRose, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = "⚠️ Tanggungan Anda (Belum Diserahkan)",
                                    color = IndustrialRose,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                                Text(
                                    text = "Wajib serahkan fisik part rusak ke loket Admin Kontainer (Aturan BR-004 maks 1x24 jam)",
                                    color = Slate300,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                } else {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = IndustrialEmerald.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, IndustrialEmerald.copy(alpha = 0.4f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = "✓ Sudah Diserahkan ke Admin Kontainer",
                                    color = IndustrialEmerald,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                                val receivedInfo = if (!item.containerReceivedAt.isNullOrEmpty()) {
                                    "Diterima: ${item.containerReceivedAt}"
                                } else {
                                    "Telah diterima fisik di gudang kontainer"
                                }
                                Text(
                                    text = receivedInfo,
                                    color = Slate300,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                }
            } else {
                // Tampilan Admin Kontainer: Tombol Aksi Penerimaan dan Transfer
                if (isPending) {
                    Button(
                        onClick = onReceive,
                        colors = ButtonDefaults.buttonColors(containerColor = IndustrialAmber),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(42.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Slate950, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("TERIMA CORE DARI MEKANIK", color = Slate950, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                } else if (isAtContainer) {
                    Button(
                        onClick = onTransfer,
                        colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(42.dp)
                    ) {
                        Icon(Icons.Default.Send, contentDescription = null, tint = Slate950, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("TRANSFER KE GUDANG UTAMA", color = Slate950, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
