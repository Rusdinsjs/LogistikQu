package com.sjs.logistikqu.presentation.screens.dispatch

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sjs.logistikqu.data.api.models.ReplenishmentRequestDto
import com.sjs.logistikqu.presentation.components.LogistikQuTopBar
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAdminDispatchScreen(
    viewModel: MainAdminDispatchViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = Slate950,
        topBar = {
            LogistikQuTopBar(
                title = "Verifikasi STO Gudang Utama",
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
                    border = BorderStroke(1.dp, IndustrialBlue.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.LocalShipping,
                                contentDescription = null,
                                tint = IndustrialBlue,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Verifikasi Permohonan Kontainer",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Admin Gudang Utama bertugas memeriksa ketersediaan fisik stok koli di gudang utama sebelum diajukan ke Supervisor untuk penerbitan drop STO.",
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
                            IconButton(onClick = viewModel::clearSuccessMessage) {
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

            // Section Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "ANTREAN VERIFIKASI STO (${uiState.requests.size})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate400,
                        letterSpacing = 1.sp
                    )
                    IconButton(onClick = viewModel::loadRequests) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = IndustrialCyan, modifier = Modifier.size(18.dp))
                    }
                }
            }

            // List of Requests
            if (uiState.isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = IndustrialBlue)
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
                            Text("Semua permohonan kontainer telah diverifikasi.", color = Slate400, fontSize = 11.sp)
                        }
                    }
                }
            } else {
                items(uiState.requests, key = { it.id }) { req ->
                    MainDispatchCard(
                        request = req,
                        onVerify = { viewModel.openVerifyDialog(req) },
                        onReturn = { viewModel.openReturnDialog(req) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }

    // Modal Verify Dialog
    if (uiState.verifyDialogRequest != null) {
        val req = uiState.verifyDialogRequest!!
        AlertDialog(
            onDismissRequest = viewModel::dismissDialogs,
            containerColor = Slate900,
            title = {
                Text("Verifikasi Ketersediaan Fisik", fontWeight = FontWeight.Bold, color = White, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Konfirmasi bahwa stok suku cadang untuk tiket ${req.requestNumber} tersedia di Gudang Utama dan siap diajukan ke Supervisor?",
                        color = Slate300,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = uiState.adminNotes,
                        onValueChange = viewModel::onAdminNotesChanged,
                        placeholder = { Text("Catatan verifikasi admin utama", color = Slate500, fontSize = 12.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedBorderColor = IndustrialBlue,
                            unfocusedBorderColor = Slate800,
                            focusedTextColor = White
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::confirmVerify,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialBlue),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !uiState.isProcessingAction
                ) {
                    if (uiState.isProcessingAction) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = White, strokeWidth = 2.dp)
                    } else {
                        Text("VERIFIKASI & AJUKAN", color = White, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDialogs) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }

    // Modal Return Dialog
    if (uiState.returnDialogRequest != null) {
        val req = uiState.returnDialogRequest!!
        AlertDialog(
            onDismissRequest = viewModel::dismissDialogs,
            containerColor = Slate900,
            title = {
                Text("Kembalikan ke Kontainer", fontWeight = FontWeight.Bold, color = IndustrialAmber, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Tiket ${req.requestNumber} akan dikembalikan ke Admin Kontainer untuk direvisi/dibatalkan.",
                        color = Slate300,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = uiState.returnReason,
                        onValueChange = viewModel::onReturnReasonChanged,
                        placeholder = { Text("Alasan pengembalian (misal: stok kosong/spesifikasi salah)", color = Slate500, fontSize = 12.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Slate950,
                            unfocusedContainerColor = Slate950,
                            focusedBorderColor = IndustrialAmber,
                            unfocusedBorderColor = Slate800,
                            focusedTextColor = White
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::confirmReturn,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialAmber),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !uiState.isProcessingAction
                ) {
                    if (uiState.isProcessingAction) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Slate950, strokeWidth = 2.dp)
                    } else {
                        Text("KEMBALIKAN KE KONTAINER", color = Slate950, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDialogs) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun MainDispatchCard(
    request: ReplenishmentRequestDto,
    onVerify: () -> Unit,
    onReturn: () -> Unit
) {
    val isReturned = request.status == "RETURNED_TO_MAIN_ADMIN"

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Slate900,
        border = BorderStroke(1.dp, if (isReturned) IndustrialRose.copy(alpha = 0.5f) else IndustrialBlue.copy(alpha = 0.4f)),
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
                    color = if (isReturned) IndustrialRose.copy(alpha = 0.2f) else IndustrialCyan.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = if (isReturned) "REVISI SUPERVISOR" else "PERMOHONAN BARU",
                        color = if (isReturned) IndustrialRose else IndustrialCyan,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Tujuan Drop:", color = Slate400, fontSize = 11.sp)
                Text(request.containerWarehouseId, color = IndustrialEmerald, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }

            if (!request.notes.isNullOrBlank()) {
                Text(text = "Catatan Pemohon: \"${request.notes}\"", color = Slate300, fontSize = 11.sp)
            }

            if (!request.supervisorNotes.isNullOrBlank()) {
                Text(text = "Catatan Supervisor: \"${request.supervisorNotes}\"", color = IndustrialRose, fontSize = 11.sp)
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onVerify,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialBlue),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1.3f)
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("VERIFIKASI & AJUKAN", color = White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }

                OutlinedButton(
                    onClick = onReturn,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, Slate700),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Kembalikan", fontSize = 11.sp, color = Slate300)
                }
            }
        }
    }
}
