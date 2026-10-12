package com.sjs.logistikqu.presentation.screens.receive

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

    Scaffold(
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = { Text("Penerimaan Barang STO", fontWeight = FontWeight.Bold, color = White) },
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
            if (uiState.successMessage != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = IndustrialEmerald.copy(alpha = 0.2f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, IndustrialEmerald)
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.successMessage!!, color = IndustrialEmerald, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // Step 1: Scan Shipment Document
            Text("1. DOKUMEN PENGIRIMAN (DROP STO)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            IndustrialTextField(
                value = uiState.dropDocumentNumber,
                onValueChange = viewModel::onDocNumberChanged,
                label = "Nomor Surat Jalan Drop",
                placeholder = "Pindai surat jalan e.g. DROP-20261011-00004",
                onScanClick = { viewModel.setScanningDoc(true) }
            )

            // Step 2: Scan Received Item
            Text("2. VERIFIKASI FISIK SUKU CADANG", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            IndustrialTextField(
                value = uiState.scannedItemCode,
                onValueChange = viewModel::onItemCodeChanged,
                label = "Kode Part Diterima",
                placeholder = "Pindai label kemasan box",
                onScanClick = { viewModel.setScanningItem(true) }
            )

            OutlinedTextField(
                value = uiState.verifiedQuantity,
                onValueChange = viewModel::onQuantityChanged,
                label = { Text("Kuantitas Diterima Masuk Rak (PCS)", color = Slate400) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialAmber,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White
                )
            )

            // Step 3: Photo Proof of Receipt
            Text("3. BUKTI FOTO PENERIMAAN", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            OutlinedButton(
                onClick = { viewModel.onProofPhotoCaptured("file:///cache/receiving_proof.jpg") },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = IndustrialCyan),
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate700)
            ) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (uiState.proofPhotoPath != null) "Foto Surat Jalan Terlampir ✓" else "Ambil Foto Surat Jalan Fisik", fontSize = 13.sp)
            }

            if (uiState.errorMessage != null) {
                Text(text = uiState.errorMessage!!, color = IndustrialRose, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(12.dp))

            IndustrialButton(
                text = "KONFIRMASI PENERIMAAN (TAMBAH STOK FISIK)",
                onClick = viewModel::submitReceive,
                isLoading = uiState.isSubmitting,
                icon = Icons.Default.Inventory,
                color = IndustrialAmber,
                textColor = Slate950
            )
        }
    }
}
