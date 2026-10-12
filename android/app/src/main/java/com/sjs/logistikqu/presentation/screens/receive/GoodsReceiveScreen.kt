package com.sjs.logistikqu.presentation.screens.receive

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
fun GoodsReceiveScreen(
    viewModel: GoodsReceiveViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.isScanningDoc) {
        CameraXScannerScreen(
            title = "Pindai Barcode Surat Jalan Drop STO",
            onBarcodeScanned = { raw -> viewModel.onScanBarcode(raw) },
            onClose = { viewModel.setScanningDoc(false) }
        )
        return
    }

    if (uiState.isScanningItem) {
        CameraXScannerScreen(
            title = "Pindai Barcode Suku Cadang yang Diterima",
            onBarcodeScanned = { raw -> viewModel.onScanBarcode(raw) },
            onClose = { viewModel.setScanningItem(false) }
        )
        return
    }

    if (uiState.isScanningBin) {
        CameraXScannerScreen(
            title = "Pindai Barcode Stiker Rak / Bin Kontainer",
            onBarcodeScanned = { raw -> viewModel.onScanBarcode(raw) },
            onClose = { viewModel.setScanningBin(false) }
        )
        return
    }

    Scaffold(
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Penerimaan STO & Guided Put-Away", fontWeight = FontWeight.Bold, color = White, fontSize = 16.sp)
                        Text("Gudang: ${uiState.warehouseId}", color = Slate400, fontSize = 11.sp)
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
            // Success Feedback
            if (uiState.successMessage != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = IndustrialEmerald.copy(alpha = 0.15f)),
                    border = BorderStroke(1.dp, IndustrialEmerald)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Barang Berhasil Diterima di Rak!",
                                color = IndustrialEmerald,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = uiState.successMessage!!,
                                color = Slate200,
                                fontSize = 12.sp
                            )
                        }
                        IconButton(onClick = viewModel::clearSuccessMessage) {
                            Icon(Icons.Default.Close, contentDescription = "Tutup", tint = Slate400)
                        }
                    }
                }
            }

            // Step 1: Scan Shipment Document
            Text(
                text = "1. DOKUMEN PENGIRIMAN (DROP STO)",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400,
                letterSpacing = 1.sp
            )
            IndustrialTextField(
                value = uiState.dropDocumentNumber,
                onValueChange = viewModel::onDocNumberChanged,
                label = "Nomor Surat Jalan Drop",
                placeholder = "Pindai surat jalan e.g. DROP-20261011-00004",
                onScanClick = { viewModel.setScanningDoc(true) }
            )

            // Step 2: Physical Part Verification
            Text(
                text = "2. VERIFIKASI FISIK SUKU CADANG",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400,
                letterSpacing = 1.sp
            )
            IndustrialTextField(
                value = uiState.scannedItemCode,
                onValueChange = viewModel::onItemCodeChanged,
                label = "Kode / Part Number",
                placeholder = "Pindai label kemasan e.g. PART-600-211-1340",
                onScanClick = { viewModel.setScanningItem(true) }
            )

            OutlinedTextField(
                value = uiState.verifiedQuantity,
                onValueChange = viewModel::onQuantityChanged,
                label = { Text("Kuantitas Fisik Masuk Kontainer (PCS)", color = Slate400) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialAmber,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White
                )
            )

            // Step 3: Guided Put-Away (Penataan Rak / Bin Kontainer)
            Text(
                text = "3. GUIDED PUT-AWAY (PENATAAN RAK / BIN)",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = IndustrialCyan,
                letterSpacing = 1.sp
            )

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Slate900,
                border = BorderStroke(1.dp, IndustrialCyan.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Place, contentDescription = null, tint = IndustrialCyan, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Rekomendasi Rak Cerdas:", color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = IndustrialCyan.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = uiState.suggestedBinCode,
                                color = IndustrialCyan,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Letakkan suku cadang pada bin yang telah dialokasikan atau pindai barcode stiker rak fisik kontainer.",
                        color = Slate400,
                        fontSize = 11.sp
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    IndustrialTextField(
                        value = uiState.targetBinCode,
                        onValueChange = viewModel::onTargetBinChanged,
                        label = "Kode Rak / Bin Penempatan",
                        placeholder = "Pindai stiker rak e.g. BIN-A1-01",
                        onScanClick = { viewModel.setScanningBin(true) }
                    )

                    if (uiState.availableBins.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("Pilih Denah Rak Cepat:", color = Slate400, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(6.dp))
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(uiState.availableBins, key = { it.binCode }) { bin ->
                                val isSelected = uiState.targetBinCode == bin.binCode
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isSelected) IndustrialCyan else Slate950,
                                    border = BorderStroke(1.dp, if (isSelected) IndustrialCyan else Slate800),
                                    modifier = Modifier.clickable { viewModel.onTargetBinChanged(bin.binCode) }
                                ) {
                                    Text(
                                        text = bin.binCode,
                                        color = if (isSelected) Slate950 else White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Step 4: Photo Proof
            Text(
                text = "4. BUKTI FOTO PENERIMAAN FISIK",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400,
                letterSpacing = 1.sp
            )
            OutlinedButton(
                onClick = { viewModel.onProofPhotoCaptured("file:///cache/receiving_proof.jpg") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialCyan),
                border = BorderStroke(1.dp, Slate700)
            ) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (uiState.proofPhotoPath != null) "Foto Surat Jalan & Rak Terlampir ✓" else "Ambil Foto Surat Jalan Fisik",
                    fontSize = 13.sp
                )
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
                text = "KONFIRMASI PENERIMAAN & PENATAAN RAK",
                onClick = viewModel::submitReceive,
                isLoading = uiState.isSubmitting,
                icon = Icons.Default.Inventory,
                color = IndustrialAmber,
                textColor = Slate950
            )
        }
    }
}
