package com.sjs.logistikqu.presentation.screens.issue

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.sjs.logistikqu.presentation.components.IndustrialButton
import com.sjs.logistikqu.presentation.components.IndustrialTextField
import com.sjs.logistikqu.presentation.components.SignaturePadDialog
import com.sjs.logistikqu.presentation.screens.scanner.CameraXScannerScreen
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SparePartIssueScreen(
    viewModel: SparePartIssueViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

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
                title = {
                    Column {
                        Text("Pengeluaran POS Loket (Issue)", fontWeight = FontWeight.Bold, color = White, fontSize = 16.sp)
                        Text("Gudang: ${uiState.activeWarehouseId}", color = Slate400, fontSize = 11.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali", tint = White)
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.Home, contentDescription = "Beranda", tint = IndustrialEmerald)
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
                    colors = CardDefaults.cardColors(containerColor = IndustrialEmerald.copy(alpha = 0.15f)),
                    border = BorderStroke(1.dp, IndustrialEmerald)
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
                            text = "Stok fisik kontainer telah dipotong & bukti transaksi siap dicetak ke printer sabuk thermal.",
                            fontSize = 12.sp,
                            color = Slate300
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { viewModel.printOrShareReceipt(context) },
                                colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Icon(Icons.Default.Print, contentDescription = null, tint = Slate950, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Cetak Ulang Slip", color = Slate950, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                            OutlinedButton(
                                onClick = viewModel::startNewTransaction,
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, Slate700)
                            ) {
                                Text("Transaksi Baru", color = White, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            // Section 1: Armada & Operasional (BR-001)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("1. IDENTITAS UNIT & ARMADA (BR-001)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
                TextButton(
                    onClick = viewModel::openAddEquipmentDialog,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp), tint = IndustrialCyan)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("+ Unit Baru", color = IndustrialCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            IndustrialTextField(
                value = uiState.equipmentNumber,
                onValueChange = viewModel::onEquipmentChanged,
                label = "Nomor Unit Alat (Barcode)",
                placeholder = "Pindai barcode unit e.g. DT-018 / EX-2001",
                onScanClick = { viewModel.setScanningField(ScanningField.EQUIPMENT) }
            )

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = uiState.hmKm,
                    onValueChange = viewModel::onHmKmChanged,
                    label = { Text("Hour Meter (HM / KM)", color = Slate400) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
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
                    modifier = Modifier.fillMaxWidth(),
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("2. MEKANIK & PENERIMA", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
                TextButton(
                    onClick = viewModel::openAddMechanicDialog,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp), tint = IndustrialCyan)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("+ Mekanik Baru", color = IndustrialCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            IndustrialTextField(
                value = uiState.mechanicName,
                onValueChange = viewModel::onMechanicChanged,
                label = "Nama / ID Badge Mekanik",
                placeholder = "Pindai badge atau ketik nama e.g. AHMAD-MEK01",
                onScanClick = { viewModel.setScanningField(ScanningField.MECHANIC) }
            )

            // Section 3: Spare Part Barcode & Qty
            Text("3. SUKU CADANG & KUANTITAS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)

            IndustrialTextField(
                value = uiState.sparePartBarcode,
                onValueChange = viewModel::onPartBarcodeChanged,
                label = "Nomor Part (Barcode)",
                placeholder = "Pindai barcode part e.g. FLT-600-211-1340",
                onScanClick = { viewModel.setScanningField(ScanningField.PART) }
            )

            if (uiState.partName.isNotBlank()) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, Slate800)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = uiState.partName, color = White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text(text = "Lokasi Rak Kontainer: ${uiState.binLocation}", color = IndustrialCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Warning Banner for BR-004 Core Return
            if (uiState.requiresCoreReturn) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = IndustrialAmber.copy(alpha = 0.15f),
                    border = BorderStroke(1.5.dp, IndustrialAmber)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = IndustrialAmber, modifier = Modifier.size(24.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "ATURAN BR-004: WAJIB CORE RETURN",
                                color = IndustrialAmber,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            Text(
                                text = "Komponen bekas/core wajib diserahkan mekanik ke loket kontainer maksimal 24 jam sebelum WO ditutup.",
                                color = Slate200,
                                fontSize = 11.sp,
                                lineHeight = 15.sp
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = uiState.quantity,
                onValueChange = viewModel::onQuantityChanged,
                label = { Text("Kuantitas Pengeluaran (Qty)", color = Slate400) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialEmerald,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White
                )
            )

            // Section 4: Digital Signature Pad (Point #3)
            Text("4. OTORISASI DIGITAL MEKANIK (POINT #3)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = IndustrialCyan, letterSpacing = 1.sp)

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Slate900,
                border = BorderStroke(1.dp, if (uiState.isSignatureCaptured) IndustrialEmerald else Slate800)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Tanda Tangan Digital Mekanik", color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(
                                text = if (uiState.isSignatureCaptured) "Tanda tangan sah telah dibubuhkan ✓" else "Wajib ditandatangani mekanik di layar",
                                color = if (uiState.isSignatureCaptured) IndustrialEmerald else Slate400,
                                fontSize = 11.sp
                            )
                        }

                        if (uiState.isSignatureCaptured) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = IndustrialEmerald.copy(alpha = 0.2f)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = IndustrialEmerald, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("TERVERIFIKASI", color = IndustrialEmerald, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedButton(
                        onClick = viewModel::openSignaturePad,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, if (uiState.isSignatureCaptured) IndustrialEmerald else IndustrialCyan),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = if (uiState.isSignatureCaptured) IndustrialEmerald else IndustrialCyan
                        )
                    ) {
                        Icon(Icons.Default.Draw, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (uiState.isSignatureCaptured) "Ubah / Tanda Tangan Ulang" else "Buka Pad Tanda Tangan Mekanik ✍️",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // Section 5: Photo Documentation & GPS
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { viewModel.onPhotoCaptured("file:///cache/photo_proof.jpg") },
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialCyan),
                    border = BorderStroke(1.dp, Slate700)
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (uiState.capturedPhotoPath != null) "Foto Tersimpan ✓" else "Ambil Foto WO", fontSize = 12.sp)
                }

                OutlinedButton(
                    onClick = { viewModel.onLocationCaptured(-2.5321, 121.3542) },
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialAmber),
                    border = BorderStroke(1.dp, Slate700)
                ) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (uiState.latitude != null) "GPS Valid ✓" else "Kunci GPS", fontSize = 12.sp)
                }
            }

            if (uiState.errorMessage != null) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = IndustrialRose.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, IndustrialRose)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = IndustrialRose, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = uiState.errorMessage!!,
                            color = IndustrialRose,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            IndustrialButton(
                text = "SUBMIT & CETAK SLIP THERMAL POS",
                onClick = viewModel::submitIssue,
                isLoading = uiState.isSubmitting,
                icon = Icons.Default.Print,
                color = IndustrialEmerald
            )

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    // Modal Signature Pad Dialog
    SignaturePadDialog(
        isOpen = uiState.isSignaturePadOpen,
        onDismiss = viewModel::dismissSignaturePad,
        onSignatureConfirmed = viewModel::onSignatureConfirmed,
        signerName = uiState.mechanicName.ifBlank { "Mekanik Lapangan" }
    )

    // Thermal Slip Preview Dialog
    if (uiState.showReceiptDialog && uiState.lastReceiptData != null) {
        val slipData = uiState.lastReceiptData!!
        Dialog(
            onDismissRequest = viewModel::dismissReceiptDialog,
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.8f))
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, Slate800),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .padding(16.dp)
                            .verticalScroll(rememberScrollState()),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Receipt, contentDescription = null, tint = IndustrialCyan)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Slip Bukti Serah Terima", fontWeight = FontWeight.Bold, color = White, fontSize = 14.sp)
                            }
                            IconButton(onClick = viewModel::dismissReceiptDialog) {
                                Icon(Icons.Default.Close, contentDescription = "Tutup", tint = Slate400)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Monospace Realistic Paper Slip Preview
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFF8F9FA),
                            border = BorderStroke(1.dp, Color(0xFFDEE2E6)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = ThermalReceiptHelper.formatSlipText(slipData),
                                    color = Color(0xFF212529),
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    lineHeight = 15.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Actions: Cetak Bluetooth & Tutup
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = { viewModel.printOrShareReceipt(context) },
                                colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .weight(1.4f)
                                    .height(48.dp)
                            ) {
                                Icon(Icons.Default.Print, contentDescription = null, tint = Slate950, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Cetak / Share Slip", color = Slate950, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }

                            OutlinedButton(
                                onClick = viewModel::startNewTransaction,
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, Slate700),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                            ) {
                                Text("Selesai", color = White, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    // Dialog Tambah Unit Equipment Baru (Instruksi #3)
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
                        value = newUnitHmKm,
                        onValueChange = { newUnitHmKm = it },
                        label = { Text("HM/KM Awal", color = Slate400) },
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
                    enabled = !uiState.isSavingMaster && newUnitNumber.isNotBlank() && newUnitName.isNotBlank()
                ) {
                    Text(if (uiState.isSavingMaster) "Menyimpan..." else "Simpan Unit", color = Slate950, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeAddEquipmentDialog) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }

    // Dialog Tambah Mekanik Baru (Instruksi #3)
    if (uiState.showAddMechanicDialog) {
        var newMechanicName by remember { mutableStateOf("") }
        var newMechanicPosition by remember { mutableStateOf("Mekanik") }

        AlertDialog(
            onDismissRequest = viewModel::closeAddMechanicDialog,
            containerColor = Slate900,
            title = {
                Text("Tambah Mekanik Baru", color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newMechanicName,
                        onValueChange = { newMechanicName = it },
                        label = { Text("Nama Lengkap Mekanik", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedBorderColor = IndustrialCyan,
                            unfocusedBorderColor = Slate700
                        )
                    )
                    OutlinedTextField(
                        value = newMechanicPosition,
                        onValueChange = { newMechanicPosition = it },
                        label = { Text("Posisi / Spesialisasi", color = Slate400) },
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
                        if (newMechanicName.isNotBlank()) {
                            viewModel.quickAddMechanic(newMechanicName, newMechanicPosition)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                    enabled = !uiState.isSavingMaster && newMechanicName.isNotBlank()
                ) {
                    Text(if (uiState.isSavingMaster) "Menyimpan..." else "Simpan Mekanik", color = Slate950, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeAddMechanicDialog) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }
}
