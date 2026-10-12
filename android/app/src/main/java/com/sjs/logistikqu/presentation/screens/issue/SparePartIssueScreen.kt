package com.sjs.logistikqu.presentation.screens.issue

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.presentation.components.IndustrialButton
import com.sjs.logistikqu.presentation.components.IndustrialTextField
import com.sjs.logistikqu.presentation.screens.scanner.CameraXScannerScreen
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SparePartIssueScreen(
    viewModel: SparePartIssueViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.activeScanningField != null) {
        val title = when (uiState.activeScanningField) {
            ScanningField.EQUIPMENT -> "Pindai QR / Barcode Unit Armada"
            ScanningField.MECHANIC -> "Pindai Barcode ID Card Mekanik"
            ScanningField.PART -> "Pindai Barcode Suku Cadang"
            null -> ""
        }
        CameraXScannerScreen(
            title = title,
            onBarcodeScanned = { raw -> viewModel.onScanBarcode(raw) },
            onClose = { viewModel.setScanningField(null) }
        )
        return
    }

    Scaffold(
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = { Text("Pengeluaran POS Loket", fontWeight = FontWeight.Bold, color = White) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali", tint = White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate900)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Success Card
            if (uiState.issueSuccessNumber != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = IndustrialEmerald.copy(alpha = 0.2f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, IndustrialEmerald)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("PENGELUARAN BERHASIL TERCATAT!", fontWeight = FontWeight.Bold, color = IndustrialEmerald, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "No Tiket / Issue: ${uiState.issueSuccessNumber}",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black,
                            color = White
                        )
                        Text(
                            text = "Stok lokal telah dipotong & transaksi diantrekan secara aman.",
                            fontSize = 12.sp,
                            color = Slate300
                        )
                    }
                }
            }

            // Section 1: Armada & Operasional (BR-001)
            Text("1. IDENTITAS UNIT & ARMADA TAMBANG", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)

            IndustrialTextField(
                value = uiState.equipmentNumber,
                onValueChange = viewModel::onEquipmentChanged,
                label = "Nomor Unit Alat (Barcode)",
                placeholder = "Pindai barcode unit e.g. DT-001 / EX-201",
                onScanClick = { viewModel.setScanningField(ScanningField.EQUIPMENT) }
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = uiState.hmKm,
                    onValueChange = viewModel::onHmKmChanged,
                    label = { Text("Hour Meter (HM / KM)", color = Slate400) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900,
                        focusedBorderColor = IndustrialCyan,
                        unfocusedBorderColor = Slate700,
                        focusedTextColor = White
                    )
                )

                OutlinedTextField(
                    value = uiState.workOrderNumber,
                    onValueChange = viewModel::onWorkOrderChanged,
                    label = { Text("No Work Order (WO)", color = Slate400) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900,
                        focusedBorderColor = IndustrialCyan,
                        unfocusedBorderColor = Slate700,
                        focusedTextColor = White
                    )
                )
            }

            // Section 2: Mechanic / Receiver
            Text("2. MEKANIK & PENERIMA", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)

            IndustrialTextField(
                value = uiState.mechanicName,
                onValueChange = viewModel::onMechanicChanged,
                label = "Nama / ID Mekanik",
                placeholder = "Pindai badge atau masukkan nama",
                onScanClick = { viewModel.setScanningField(ScanningField.MECHANIC) }
            )

            // Section 3: Spare Part Barcode & Qty
            Text("3. SUKU CADANG & KUANTITAS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)

            IndustrialTextField(
                value = uiState.sparePartBarcode,
                onValueChange = viewModel::onPartBarcodeChanged,
                label = "Nomor Part (Barcode)",
                placeholder = "Pindai barcode part e.g. FLT-001",
                onScanClick = { viewModel.setScanningField(ScanningField.PART) }
            )

            OutlinedTextField(
                value = uiState.quantity,
                onValueChange = viewModel::onQuantityChanged,
                label = { Text("Kuantitas Pengeluaran (Qty)", color = Slate400) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialEmerald,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White
                )
            )

            // Section 4: Photo Documentation & GPS
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { viewModel.onPhotoCaptured("file:///cache/photo_proof.jpg") },
                    modifier = Modifier.weight(1f).height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialCyan),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate700)
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (uiState.capturedPhotoPath != null) "Foto Tersimpan ✓" else "Ambil Foto Bukti", fontSize = 12.sp)
                }

                OutlinedButton(
                    onClick = { viewModel.onLocationCaptured(-2.5321, 121.3542) },
                    modifier = Modifier.weight(1f).height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialAmber),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate700)
                ) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (uiState.latitude != null) "GPS Valid ✓" else "Kunci GPS Site", fontSize = 12.sp)
                }
            }

            if (uiState.errorMessage != null) {
                Text(
                    text = uiState.errorMessage!!,
                    color = IndustrialRose,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            IndustrialButton(
                text = "SUBMIT PENGELUARAN PART (OFFLINE READY)",
                onClick = viewModel::submitIssue,
                isLoading = uiState.isSubmitting,
                icon = Icons.Default.Check,
                color = IndustrialEmerald
            )
        }
    }
}
