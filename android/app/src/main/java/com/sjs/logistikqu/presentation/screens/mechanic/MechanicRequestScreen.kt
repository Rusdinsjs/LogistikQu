package com.sjs.logistikqu.presentation.screens.mechanic

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.data.api.models.MechanicRequestDto
import com.sjs.logistikqu.presentation.components.LogistikQuTopBar
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MechanicRequestScreen(
    viewModel: MechanicRequestViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    val canApprove = uiState.userRole == "SUPER_ADMIN" ||
            uiState.userPermissions.contains("mechanic_request.approve")
    val canFulfill = uiState.userRole == "SUPER_ADMIN" ||
            uiState.userPermissions.contains("mechanic_request.fulfill")

    Scaffold(
        containerColor = Slate950,
        topBar = {
            LogistikQuTopBar(
                title = "Permohonan Stok Mekanik",
                isOnline = true,
                onNavigateBack = onNavigateBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.openCreateDialog() },
                containerColor = IndustrialCyan,
                contentColor = Slate950
            ) {
                Icon(Icons.Default.Add, contentDescription = "Ajukan Permohonan")
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Status filter chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = uiState.statusFilter == null,
                    onClick = { viewModel.setStatusFilter(null) },
                    label = { Text("Semua", fontSize = 11.sp) }
                )
                FilterChip(
                    selected = uiState.statusFilter == "SUBMITTED",
                    onClick = { viewModel.setStatusFilter("SUBMITTED") },
                    label = { Text("Menunggu", fontSize = 11.sp) }
                )
                FilterChip(
                    selected = uiState.statusFilter == "APPROVED",
                    onClick = { viewModel.setStatusFilter("APPROVED") },
                    label = { Text("Disetujui", fontSize = 11.sp) }
                )
                FilterChip(
                    selected = uiState.statusFilter == "COMPLETED",
                    onClick = { viewModel.setStatusFilter("COMPLETED") },
                    label = { Text("Selesai", fontSize = 11.sp) }
                )
            }

            // Summary banner if available
            uiState.summary?.let { sum ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, Slate800)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Total", fontSize = 10.sp, color = Slate400)
                            Text("${sum.total}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = White)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Menunggu", fontSize = 10.sp, color = IndustrialAmber)
                            Text("${sum.submitted}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = IndustrialAmber)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Disetujui", fontSize = 10.sp, color = IndustrialCyan)
                            Text("${sum.approved}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = IndustrialCyan)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Selesai", fontSize = 10.sp, color = IndustrialGreen)
                            Text("${sum.completed}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = IndustrialGreen)
                        }
                    }
                }
            }

            // Feedback messages
            uiState.successMessage?.let { msg ->
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = IndustrialGreen.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, IndustrialGreen)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = IndustrialGreen)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(msg, color = IndustrialGreen, fontSize = 12.sp)
                    }
                }
            }

            uiState.errorMessage?.let { err ->
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color.Red.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, Color.Red)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Color.Red)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(err, color = Color.Red, fontSize = 12.sp)
                    }
                }
            }

            // Request List
            if (uiState.isLoading && uiState.requests.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IndustrialCyan)
                }
            } else if (uiState.requests.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Belum ada permohonan stok", color = Slate500, fontSize = 13.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(uiState.requests) { req ->
                        MechanicRequestCard(
                            request = req,
                            onClick = { viewModel.openDetail(req.id) }
                        )
                    }
                }
            }
        }
    }

    // Detail Dialog
    if (uiState.isDetailDialogOpen && uiState.selectedDetail != null) {
        val detail = uiState.selectedDetail!!
        AlertDialog(
            onDismissRequest = { viewModel.closeDetail() },
            containerColor = Slate900,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Build, contentDescription = null, tint = IndustrialCyan)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        detail.request.requestNumber,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = White
                    )
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Tipe: ${detail.request.requestType} | Status: ${detail.request.status}",
                        fontSize = 12.sp,
                        color = IndustrialCyan
                    )
                    Text("Unit: ${detail.request.unitNumber ?: "-"} | HM: ${detail.request.hmKm ?: "0"}", fontSize = 12.sp, color = Slate300)
                    Text("Mekanik: ${detail.request.mechanicName}", fontSize = 12.sp, color = Slate300)
                    detail.request.damageDescription?.let {
                        Text("Kerusakan: $it", fontSize = 12.sp, color = Slate400)
                    }
                    Divider(color = Slate800, modifier = Modifier.padding(vertical = 4.dp))
                    Text("Daftar Item:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = White)
                    detail.items.forEach { itm ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("${itm.sparePartId} - ${itm.partName}", fontSize = 11.sp, color = Slate300)
                            Text("${itm.requestedQty} ${itm.unitOfMeasure}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = White)
                        }
                    }
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (detail.request.status == "SUBMITTED" && canApprove) {
                        Button(
                            onClick = { viewModel.approveRequest(detail.request.id) },
                            colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan)
                        ) {
                            Text("Setujui", color = Slate950, fontSize = 12.sp)
                        }
                    }
                    if (detail.request.status == "APPROVED" && canFulfill) {
                        Button(
                            onClick = { viewModel.fulfillRequest(detail.request.id) },
                            colors = ButtonDefaults.buttonColors(containerColor = IndustrialGreen)
                        ) {
                            Text("Fulfill", color = Slate950, fontSize = 12.sp)
                        }
                    }
                    TextButton(onClick = { viewModel.closeDetail() }) {
                        Text("Tutup", color = Slate400, fontSize = 12.sp)
                    }
                }
            }
        )
    }

    // Create Request Dialog
    if (uiState.isCreateDialogOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.closeCreateDialog() },
            containerColor = Slate900,
            title = {
                Text(
                    "Form Permohonan Stock",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = White
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Type selector
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = uiState.formType == "REPLACEMENT",
                            onClick = { viewModel.setFormType("REPLACEMENT") },
                            label = { Text("Penggantian", fontSize = 11.sp) }
                        )
                        FilterChip(
                            selected = uiState.formType == "RETURN",
                            onClick = { viewModel.setFormType("RETURN") },
                            label = { Text("Pengembalian", fontSize = 11.sp) }
                        )
                    }

                    if (uiState.formType == "REPLACEMENT") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Data Unit Alat", color = Slate400, fontSize = 11.sp)
                            OutlinedButton(
                                onClick = viewModel::openAddEquipmentDialog,
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                modifier = Modifier.height(28.dp),
                                border = BorderStroke(1.dp, IndustrialCyan.copy(alpha = 0.5f)),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, tint = IndustrialCyan, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("+ Unit Baru", color = IndustrialCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        OutlinedTextField(
                            value = uiState.formUnitNumber,
                            onValueChange = { viewModel.updateFormField(unit = it) },
                            label = { Text("No. Lambung Unit (DT-001)", fontSize = 11.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = uiState.formHmKm,
                            onValueChange = { viewModel.updateFormField(hmKm = it) },
                            label = { Text("HM/KM Saat Ini", fontSize = 11.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = uiState.formDamageDescription,
                            onValueChange = { viewModel.updateFormField(damageDesc = it) },
                            label = { Text("Deskripsi Kerusakan / Analisa", fontSize = 11.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        OutlinedTextField(
                            value = uiState.formReturnReason,
                            onValueChange = { viewModel.updateFormField(returnReason = it) },
                            label = { Text("Alasan Retur (UNUSED/EXCESS)", fontSize = 11.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    OutlinedTextField(
                        value = uiState.formSparePartId,
                        onValueChange = { viewModel.updateFormField(partId = it) },
                        label = { Text("Part Number (FLT-001)", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = uiState.formQuantity,
                        onValueChange = { viewModel.updateFormField(qty = it) },
                        label = { Text("Jumlah Qty", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.submitRequest() },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                    enabled = !uiState.isSubmitting
                ) {
                    Text(if (uiState.isSubmitting) "Menyimpan..." else "Ajukan", color = Slate950)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.closeCreateDialog() }) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }

    // Duplicate Warning Dialog
    uiState.duplicateWarning?.let { warnMsg ->
        AlertDialog(
            onDismissRequest = { viewModel.clearMessages() },
            containerColor = Slate900,
            title = {
                Text("Peringatan Duplikasi", color = IndustrialAmber, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(warnMsg, color = Slate300, fontSize = 13.sp)
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.submitRequest(force = true) },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialAmber)
                ) {
                    Text("Tetap Ajukan", color = Slate950)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.clearMessages() }) {
                    Text("Periksa Lagi", color = Slate400)
                }
            }
        )
    }

    // Dialog Tambah Unit Equipment Baru untuk Mekanik (Instruksi #4)
    if (uiState.showAddEquipmentDialog) {
        var newUnitNumber by remember { mutableStateOf("") }
        var newUnitName by remember { mutableStateOf("") }
        var newUnitType by remember { mutableStateOf("HEAVY_EQUIPMENT") }
        var newUnitHmKm by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = viewModel::closeAddEquipmentDialog,
            containerColor = Slate900,
            title = {
                Text("Tambah Unit Equipment Baru", color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newUnitNumber,
                        onValueChange = { newUnitNumber = it.uppercase() },
                        label = { Text("Nomor Lambung (e.g. DT-099)", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedBorderColor = IndustrialCyan,
                            unfocusedBorderColor = Slate700
                        )
                    )
                    OutlinedTextField(
                        value = newUnitName,
                        onValueChange = { newUnitName = it },
                        label = { Text("Nama Unit / Model", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedBorderColor = IndustrialCyan,
                            unfocusedBorderColor = Slate700
                        )
                    )
                    OutlinedTextField(
                        value = newUnitType,
                        onValueChange = { newUnitType = it },
                        label = { Text("Tipe Unit (HEAVY_EQUIPMENT / DUMP_TRUCK)", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedBorderColor = IndustrialCyan,
                            unfocusedBorderColor = Slate700
                        )
                    )
                    OutlinedTextField(
                        value = newUnitHmKm,
                        onValueChange = { newUnitHmKm = it },
                        label = { Text("HM/KM Saat Ini", color = Slate400) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedBorderColor = IndustrialCyan,
                            unfocusedBorderColor = Slate700
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newUnitNumber.isNotBlank() && newUnitName.isNotBlank()) {
                            viewModel.quickAddEquipment(
                                newUnitNumber,
                                newUnitName,
                                newUnitType,
                                newUnitHmKm.toDoubleOrNull()
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                    enabled = !uiState.isSavingEquipment && newUnitNumber.isNotBlank() && newUnitName.isNotBlank()
                ) {
                    Text(if (uiState.isSavingEquipment) "Menyimpan..." else "Simpan Unit", color = Slate950, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeAddEquipmentDialog) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun MechanicRequestCard(
    request: MechanicRequestDto,
    onClick: () -> Unit
) {
    val statusColor = when (request.status) {
        "SUBMITTED" -> IndustrialAmber
        "APPROVED" -> IndustrialCyan
        "COMPLETED" -> IndustrialGreen
        "REJECTED" -> Color.Red
        else -> Slate400
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Slate900,
        border = BorderStroke(1.dp, Slate800),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = request.requestNumber,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = IndustrialCyan
                )
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = statusColor.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, statusColor.copy(alpha = 0.5f))
                ) {
                    Text(
                        text = request.status,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (request.requestType == "REPLACEMENT") "Unit: ${request.unitNumber ?: "-"}" else "Pengembalian Part",
                    fontSize = 12.sp,
                    color = White,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Mekanik: ${request.mechanicName}",
                    fontSize = 11.sp,
                    color = Slate400
                )
            }

            request.damageDescription?.let { desc ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = desc,
                    fontSize = 11.sp,
                    color = Slate500,
                    maxLines = 2
                )
            }
        }
    }
}
