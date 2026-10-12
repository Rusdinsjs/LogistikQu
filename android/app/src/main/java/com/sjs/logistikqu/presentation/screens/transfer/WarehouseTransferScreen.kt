package com.sjs.logistikqu.presentation.screens.transfer

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
fun WarehouseTransferScreen(
    viewModel: WarehouseTransferViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.isScanningPart) {
        CameraXScannerScreen(
            title = "Pindai Barcode Part yang Ditransfer",
            onBarcodeScanned = { raw -> viewModel.onScanBarcode(raw) },
            onClose = { viewModel.setScanningPart(false) }
        )
        return
    }

    Scaffold(
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = { Text("Transfer Antar Gudang", fontWeight = FontWeight.Bold, color = White) },
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

            // Warehouse Origin & Destination
            Text("1. GUDANG ASAL & TUJUAN", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = uiState.sourceWarehouseId,
                    onValueChange = viewModel::onSourceChanged,
                    label = { Text("Gudang Asal", color = Slate400) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900,
                        focusedBorderColor = IndustrialBlue,
                        unfocusedBorderColor = Slate700,
                        focusedTextColor = White
                    )
                )
                OutlinedTextField(
                    value = uiState.destinationWarehouseId,
                    onValueChange = viewModel::onDestinationChanged,
                    label = { Text("Gudang Tujuan", color = Slate400) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900,
                        focusedBorderColor = IndustrialBlue,
                        unfocusedBorderColor = Slate700,
                        focusedTextColor = White
                    )
                )
            }

            // Scanned Items
            Text("2. SUKU CADANG & JUMLAH", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            IndustrialTextField(
                value = uiState.scannedPartId,
                onValueChange = viewModel::onPartChanged,
                label = "Kode Suku Cadang (Part Number)",
                placeholder = "Pindai barcode part",
                onScanClick = { viewModel.setScanningPart(true) }
            )

            OutlinedTextField(
                value = uiState.quantity,
                onValueChange = viewModel::onQtyChanged,
                label = { Text("Kuantitas Dipindahkan", color = Slate400) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialBlue,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White
                )
            )

            OutlinedTextField(
                value = uiState.notes,
                onValueChange = viewModel::onNotesChanged,
                label = { Text("Catatan Mutasi", color = Slate400) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialBlue,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White
                )
            )

            if (uiState.errorMessage != null) {
                Text(text = uiState.errorMessage!!, color = IndustrialRose, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(12.dp))

            IndustrialButton(
                text = "KONFIRMASI PERPINDAHAN STOK",
                onClick = viewModel::submitTransfer,
                isLoading = uiState.isSubmitting,
                icon = Icons.Default.SwapHoriz,
                color = IndustrialBlue,
                textColor = White
            )
        }
    }
}
