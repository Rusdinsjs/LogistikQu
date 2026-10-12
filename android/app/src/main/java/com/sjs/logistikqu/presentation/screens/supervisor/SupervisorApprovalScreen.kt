package com.sjs.logistikqu.presentation.screens.supervisor

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sjs.logistikqu.data.api.models.ReplenishmentRequestDto
import com.sjs.logistikqu.presentation.components.LogistikQuTopBar
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupervisorApprovalScreen(
    viewModel: SupervisorApprovalViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    SupervisorApprovalContent(
        uiState = uiState,
        onNavigateBack = onNavigateBack,
        onClearSuccessMessage = viewModel::clearSuccessMessage,
        onFilterSelected = viewModel::onFilterSelected,
        onLoadRequests = viewModel::loadRequests,
        onOpenApproveDialog = viewModel::openApproveDialog,
        onOpenRejectDialog = viewModel::openRejectDialog,
        onDismissDialogs = viewModel::dismissDialogs,
        onSupervisorNotesChanged = viewModel::onSupervisorNotesChanged,
        onConfirmApprove = viewModel::confirmApprove,
        onRejectReasonChanged = viewModel::onRejectReasonChanged,
        onConfirmReject = viewModel::confirmReject
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupervisorApprovalContent(
    uiState: SupervisorApprovalUiState,
    onNavigateBack: () -> Unit,
    onClearSuccessMessage: () -> Unit,
    onFilterSelected: (String) -> Unit,
    onLoadRequests: () -> Unit,
    onOpenApproveDialog: (ReplenishmentRequestDto) -> Unit,
    onOpenRejectDialog: (ReplenishmentRequestDto) -> Unit,
    onDismissDialogs: () -> Unit,
    onSupervisorNotesChanged: (String) -> Unit,
    onConfirmApprove: () -> Unit,
    onRejectReasonChanged: (String) -> Unit,
    onConfirmReject: () -> Unit
) {
    Scaffold(
        containerColor = Slate950,
        topBar = {
            LogistikQuTopBar(
                title = "Pusat Otorisasi Supervisor",
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
                Spacer(modifier = Modifier.height(12.dp))
                // Banner Otorisasi
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, IndustrialAmber.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.FactCheck,
                                contentDescription = null,
                                tint = IndustrialAmber,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Otorisasi Drop STO Antar Gudang",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Supervisor logistik bertindak sebagai pemegang kewenangan rilis dokumen drop dari Gudang Utama ke Gudang Kontainer.",
                            fontSize = 11.sp,
                            color = Slate300,
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            // Success feedback
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
                            IconButton(onClick = onClearSuccessMessage) {
                                Icon(Icons.Default.Close, contentDescription = "Tutup", tint = Slate400)
                            }
                        }
                    }
                }
            }

            // Error feedback
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
                val filters = listOf("VERIFIED", "REQUESTED", "APPROVED", "ALL")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(filters) { filter ->
                        val isSelected = uiState.selectedFilter == filter
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) IndustrialAmber else Slate900,
                            border = BorderStroke(1.dp, if (isSelected) IndustrialAmber else Slate800),
                            modifier = Modifier.clickable { onFilterSelected(filter) }
                        ) {
                            Text(
                                text = when (filter) {
                                    "VERIFIED" -> "Siap Otorisasi (Verified)"
                                    "REQUESTED" -> "Diajukan Kontainer"
                                    "APPROVED" -> "Disetujui"
                                    else -> "Semua Tiket"
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
                        text = "DAFTAR PERMOHONAN STO (${uiState.requests.size})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate400,
                        letterSpacing = 1.sp
                    )
                    IconButton(onClick = onLoadRequests) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = IndustrialCyan, modifier = Modifier.size(18.dp))
                    }
                }
            }

            // Requests List
            if (uiState.isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = IndustrialAmber)
                    }
                }
            } else if (uiState.requests.isEmpty()) {
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
                            Text("Tidak Ada Tiket Pending", fontWeight = FontWeight.Bold, color = White, fontSize = 13.sp)
                            Text("Semua permohonan telah diproses.", color = Slate400, fontSize = 11.sp)
                        }
                    }
                }
            } else {
                items(uiState.requests, key = { it.id }) { req ->
                    SupervisorRequestCard(
                        request = req,
                        onApprove = { onOpenApproveDialog(req) },
                        onReject = { onOpenRejectDialog(req) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }

    // Modal Approve Dialog
    if (uiState.approveDialogRequest != null) {
        val req = uiState.approveDialogRequest!!
        AlertDialog(
            onDismissRequest = onDismissDialogs,
            containerColor = Slate900,
            title = {
                Text("Setujui Permohonan STO", fontWeight = FontWeight.Bold, color = White, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Apakah Anda menyetujui penerbitan STO untuk nomor tiket ${req.requestNumber} dari ${req.mainWarehouseId} menuju ${req.containerWarehouseId}?",
                        color = Slate300,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = uiState.supervisorNotes,
                        onValueChange = onSupervisorNotesChanged,
                        placeholder = { Text("Catatan persetujuan supervisor (opsional)", color = Slate500, fontSize = 12.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedBorderColor = IndustrialEmerald,
                            unfocusedBorderColor = Slate800,
                            focusedTextColor = White
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = onConfirmApprove,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialEmerald),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !uiState.isProcessingAction
                ) {
                    if (uiState.isProcessingAction) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Slate950, strokeWidth = 2.dp)
                    } else {
                        Text("SETUJUI & RILIS STO", color = Slate950, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissDialogs) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }

    // Modal Reject Dialog
    if (uiState.rejectDialogRequest != null) {
        val req = uiState.rejectDialogRequest!!
        AlertDialog(
            onDismissRequest = onDismissDialogs,
            containerColor = Slate900,
            title = {
                Text("Tolak / Kembalikan Permohonan", fontWeight = FontWeight.Bold, color = IndustrialRose, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Permohonan ${req.requestNumber} akan dikembalikan ke Admin Gudang Utama untuk direvisi.",
                        color = Slate300,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = uiState.rejectReason,
                        onValueChange = onRejectReasonChanged,
                        placeholder = { Text("Tuliskan alasan penolakan (wajib)", color = Slate500, fontSize = 12.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedBorderColor = IndustrialRose,
                            unfocusedBorderColor = Slate800,
                            focusedTextColor = White
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = onConfirmReject,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialRose),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !uiState.isProcessingAction
                ) {
                    if (uiState.isProcessingAction) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = White, strokeWidth = 2.dp)
                    } else {
                        Text("TOLAK PERMOHONAN", color = White, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissDialogs) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun SupervisorRequestCard(
    request: ReplenishmentRequestDto,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val isVerified = request.status == "VERIFIED"
    val isApproved = request.status == "APPROVED" || request.status == "IN_TRANSIT" || request.status == "COMPLETED"

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Slate900,
        border = BorderStroke(1.dp, if (isVerified) IndustrialAmber.copy(alpha = 0.5f) else Slate800),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = request.requestNumber,
                    fontWeight = FontWeight.Bold,
                    color = White,
                    fontSize = 14.sp
                )

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = when (request.status) {
                        "VERIFIED" -> IndustrialAmber.copy(alpha = 0.2f)
                        "APPROVED", "IN_TRANSIT", "COMPLETED" -> IndustrialEmerald.copy(alpha = 0.2f)
                        else -> Slate800
                    }
                ) {
                    Text(
                        text = request.status,
                        color = when (request.status) {
                            "VERIFIED" -> IndustrialAmber
                            "APPROVED", "IN_TRANSIT", "COMPLETED" -> IndustrialEmerald
                            else -> Slate300
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Rute Distribusi:", color = Slate400, fontSize = 11.sp)
                Text("${request.mainWarehouseId} ➔ ${request.containerWarehouseId}", color = IndustrialCyan, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
            }

            if (!request.notes.isNullOrBlank()) {
                Text(text = "Catatan Kontainer: \"${request.notes}\"", color = Slate300, fontSize = 11.sp)
            }

            if (!request.adminNotes.isNullOrBlank()) {
                Text(text = "Catatan Admin Utama: \"${request.adminNotes}\"", color = IndustrialAmber, fontSize = 11.sp)
            }

            if (isVerified) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onApprove,
                        colors = ButtonDefaults.buttonColors(containerColor = IndustrialEmerald),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1.3f)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = Slate950, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("SETUJUI", color = Slate950, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    OutlinedButton(
                        onClick = onReject,
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, IndustrialRose),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialRose),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("TOLAK", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun SupervisorApprovalScreenPreview() {
    LogistikQuTheme {
        SupervisorApprovalContent(
            uiState = SupervisorApprovalUiState(
                requests = listOf(
                    ReplenishmentRequestDto(
                        id = "1",
                        requestNumber = "REQ-20231024-001",
                        containerWarehouseId = "Gudang Kontainer A",
                        mainWarehouseId = "Gudang Utama",
                        status = "VERIFIED",
                        notes = "Permohonan filter oli emergency",
                        adminNotes = "Verifikasi stok siap drop"
                    ),
                    ReplenishmentRequestDto(
                        id = "2",
                        requestNumber = "REQ-20231024-002",
                        containerWarehouseId = "Gudang Kontainer B",
                        mainWarehouseId = "Gudang Utama",
                        status = "APPROVED",
                        notes = "Permohonan rutin bulanan"
                    )
                ),
                isLoading = false,
                selectedFilter = "VERIFIED"
            ),
            onNavigateBack = {},
            onClearSuccessMessage = {},
            onFilterSelected = {},
            onLoadRequests = {},
            onOpenApproveDialog = {},
            onOpenRejectDialog = {},
            onDismissDialogs = {},
            onSupervisorNotesChanged = {},
            onConfirmApprove = {},
            onRejectReasonChanged = {},
            onConfirmReject = {}
        )
    }
}

