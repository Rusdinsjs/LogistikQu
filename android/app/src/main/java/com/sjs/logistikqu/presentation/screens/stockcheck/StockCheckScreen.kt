package com.sjs.logistikqu.presentation.screens.stockcheck

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
fun StockCheckScreen(
    viewModel: StockCheckViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.isScanningLocation) {
        CameraXScannerScreen(
            title = "Pindai Barcode Rak / Lokasi Kontainer",
            onBarcodeScanned = { barcode -> viewModel.onLocationScanned(barcode) },
            onClose = { viewModel.setScanningLocation(false) }
        )
        return
    }

    if (uiState.isScanningPart) {
        CameraXScannerScreen(
            title = "Pindai Barcode Suku Cadang (Part Number)",
            onBarcodeScanned = { barcode -> viewModel.onPartScanned(barcode) },
            onClose = { viewModel.setScanningPart(false) }
        )
        return
    }

    Scaffold(
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = { Text("Pengecekan Stok & Rak", fontWeight = FontWeight.Bold, color = White) },
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
            // Step 1: Scan Warehouse Location
            Text("LANGKAH 1: LOKASI PENYIMPANAN", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            IndustrialTextField(
                value = uiState.scannedLocationBin,
                onValueChange = {},
                label = "Lokasi Rak / Bin Code",
                placeholder = "Pindai barcode rak e.g. RACK-HE-A1",
                onScanClick = { viewModel.setScanningLocation(true) }
            )

            // Step 2: Scan Spare Part
            Text("LANGKAH 2: IDENTITAS SUKU CADANG", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
            IndustrialTextField(
                value = uiState.scannedPartNumber,
                onValueChange = { viewModel.onPartScanned(it) },
                label = "Nomor Part (Barcode)",
                placeholder = "Pindai barcode part e.g. FLT-001 / ENG-001",
                onScanClick = { viewModel.setScanningPart(true) }
            )

            // Display Matched Stock Details
            val item = uiState.foundStockItem
            if (item != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Slate900),
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, IndustrialCyan)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = item.partNumber, fontWeight = FontWeight.Black, fontSize = 18.sp, color = White)
                            Text(
                                text = "Status: ${item.status}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (item.status == "NORMAL") IndustrialEmerald else IndustrialRose,
                                modifier = Modifier
                                    .background(Slate800, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = item.partName, fontSize = 14.sp, color = Slate200)

                        Spacer(modifier = Modifier.height(16.dp))
                        Divider(color = Slate800)
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("Saldo Sistem On-Hand", fontSize = 11.sp, color = Slate400)
                                Text("${item.qtyOnHand} ${item.uom}", fontSize = 20.sp, fontWeight = FontWeight.Black, color = IndustrialEmerald)
                            }
                            Column {
                                Text("Lokasi Terdaftar", fontSize = 11.sp, color = Slate400)
                                Text(item.binCode ?: "Belum Ada Rak", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = IndustrialCyan)
                            }
                            Column {
                                Text("Zona / Level", fontSize = 11.sp, color = Slate400)
                                Text("${item.zone ?: "-"} / ${item.shelfLevel ?: "-"}", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Slate200)
                            }
                        }
                    }
                }

                // Operator Physical Count Verification
                Text("LANGKAH 3: VERIFIKASI FISIK OPERATOR", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)

                OutlinedTextField(
                    value = uiState.verifiedCountInput,
                    onValueChange = viewModel::onCountInputChanged,
                    label = { Text("Kuantitas Fisik Terhitung (${item.uom})", color = Slate400) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900,
                        focusedBorderColor = IndustrialEmerald,
                        unfocusedBorderColor = Slate700,
                        focusedTextColor = White,
                        unfocusedTextColor = Slate200
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                IndustrialButton(
                    text = "SIMPAN & VERIFIKASI STOK FISIK",
                    onClick = viewModel::submitCount,
                    isLoading = uiState.isSubmitting,
                    icon = Icons.Default.CheckCircle,
                    color = IndustrialEmerald
                )
            }

            if (uiState.submissionMessage != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = IndustrialEmerald.copy(alpha = 0.15f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, IndustrialEmerald)
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CloudDone, contentDescription = null, tint = IndustrialEmerald)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.submissionMessage!!, color = IndustrialEmerald, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (uiState.errorMessage != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = IndustrialRose.copy(alpha = 0.15f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, IndustrialRose)
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = IndustrialRose)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.errorMessage!!, color = IndustrialRose, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
