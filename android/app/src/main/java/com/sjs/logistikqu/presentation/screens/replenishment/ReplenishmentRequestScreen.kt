package com.sjs.logistikqu.presentation.screens.replenishment

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sjs.logistikqu.domain.entities.ReplenishmentRecommendation
import com.sjs.logistikqu.presentation.components.IndustrialButton
import com.sjs.logistikqu.presentation.components.LogistikQuTopBar
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReplenishmentRequestScreen(
    viewModel: ReplenishmentRequestViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = Slate950,
        topBar = {
            LogistikQuTopBar(
                title = "Pengajuan Buffer Stock ROP",
                isOnline = true,
                onNavigateBack = onNavigateBack
            )
        },
        bottomBar = {
            if (uiState.selectedCount > 0) {
                Surface(
                    color = Slate900,
                    border = BorderStroke(1.dp, Slate800),
                    shadowElevation = 16.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                            .navigationBarsPadding(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "${uiState.selectedCount} Part Terpilih",
                                color = White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "Total Qty: ${uiState.totalRequestedQuantity.toInt()} PCS",
                                color = IndustrialCyan,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Button(
                            onClick = viewModel::openConfirmationDialog,
                            colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                        ) {
                            Icon(Icons.Default.Send, contentDescription = null, tint = Slate950, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Ajukan ke Gudang Utama", color = Slate950, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
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
                // Info ROP banner
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Slate900,
                    border = BorderStroke(1.dp, IndustrialCyan.copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.TrendingUp,
                                contentDescription = null,
                                tint = IndustrialCyan,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Kalkulator Buffer Stok Kontainer (${uiState.warehouseId})",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = White
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Formula: ROP = (Average Daily Usage × Lead Time) + Safety Stock. Suku cadang dengan stok fisik di bawah ROP otomatis diprioritaskan.",
                            fontSize = 11.sp,
                            color = Slate300,
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            // Success feedback card
            if (uiState.successTicketNumber != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = IndustrialEmerald.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, IndustrialEmerald)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Pengajuan Berhasil Dikirim!",
                                    color = IndustrialEmerald,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = "Nomor Tiket: ${uiState.successTicketNumber}. Menunggu verifikasi Admin Gudang Utama.",
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

            // Search and Filter Bar
            item {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = viewModel::onSearchQueryChanged,
                    placeholder = { Text("Cari part number atau nama suku cadang...", color = Slate500, fontSize = 13.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400) },
                    trailingIcon = {
                        if (uiState.searchQuery.isNotBlank()) {
                            IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                Icon(Icons.Default.Close, contentDescription = "Hapus", tint = Slate400)
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900,
                        focusedBorderColor = IndustrialCyan,
                        unfocusedBorderColor = Slate800,
                        focusedTextColor = White,
                        unfocusedTextColor = White
                    ),
                    singleLine = true
                )
            }

            // Section Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "REKOMENDASI SUKU CADANG (${uiState.filteredRecommendations.size})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate400,
                        letterSpacing = 1.sp
                    )
                    TextButton(onClick = { viewModel.loadRecommendations() }) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = IndustrialCyan, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Perbarui", color = IndustrialCyan, fontSize = 12.sp)
                    }
                }
            }

            // Recommendation List
            if (uiState.isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = IndustrialCyan)
                    }
                }
            } else if (uiState.filteredRecommendations.isEmpty()) {
                item {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = Slate900,
                        border = BorderStroke(1.dp, Slate800)
                    ) {
                        Column(
                            modifier = Modifier
                                .padding(24.dp)
                                .fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IndustrialEmerald, modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Stok Kontainer Aman", fontWeight = FontWeight.Bold, color = White, fontSize = 14.sp)
                            Text("Semua suku cadang berada di atas batas Minimum & ROP.", color = Slate400, fontSize = 12.sp)
                        }
                    }
                }
            } else {
                items(uiState.filteredRecommendations, key = { it.sparePartId }) { rec ->
                    val isSelected = uiState.draftItems.containsKey(rec.sparePartId)
                    val draft = uiState.draftItems[rec.sparePartId]

                    ReplenishmentItemCard(
                        recommendation = rec,
                        isSelected = isSelected,
                        draftQty = draft?.requestedQty ?: rec.recommendedOrderQty,
                        draftNotes = draft?.notes ?: "",
                        onToggleSelect = { viewModel.toggleItemSelection(rec) },
                        onIncrement = { viewModel.incrementRequestedQty(rec.sparePartId, 1.0) },
                        onDecrement = { viewModel.decrementRequestedQty(rec.sparePartId, 1.0) },
                        onQtyChanged = { newQty -> viewModel.updateRequestedQty(rec.sparePartId, newQty) },
                        onNotesChanged = { notes -> viewModel.updateItemNotes(rec.sparePartId, notes) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }

    // Confirmation Dialog
    if (uiState.showConfirmDialog) {
        AlertDialog(
            onDismissRequest = viewModel::dismissConfirmationDialog,
            containerColor = Slate900,
            title = {
                Text(
                    text = "Konfirmasi Pengajuan STO",
                    fontWeight = FontWeight.Bold,
                    color = White,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Pengajuan permohonan buffer stock akan dikirim ke Gudang Utama untuk diverifikasi oleh Admin Utama & disetujui Supervisor.",
                        color = Slate300,
                        fontSize = 13.sp
                    )
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Slate950,
                        border = BorderStroke(1.dp, Slate800)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Gudang Tujuan: ${uiState.warehouseId}", color = Slate400, fontSize = 12.sp)
                            Text("Total Item: ${uiState.selectedCount} Part", color = White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("Total Kuantitas: ${uiState.totalRequestedQuantity.toInt()} PCS", color = IndustrialCyan, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                    OutlinedTextField(
                        value = uiState.overallNotes,
                        onValueChange = viewModel::onOverallNotesChanged,
                        placeholder = { Text("Catatan justifikasi kebutuhan lapangan (opsional)", color = Slate500, fontSize = 12.sp) },
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
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::submitRequest,
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialCyan),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !uiState.isSubmitting
                ) {
                    if (uiState.isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Slate950, strokeWidth = 2.dp)
                    } else {
                        Text("Kirim Sekarang", color = Slate950, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissConfirmationDialog) {
                    Text("Batal", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun ReplenishmentItemCard(
    recommendation: ReplenishmentRecommendation,
    isSelected: Boolean,
    draftQty: Double,
    draftNotes: String,
    onToggleSelect: () -> Unit,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onQtyChanged: (Double) -> Unit,
    onNotesChanged: (String) -> Unit
) {
    val isCritical = recommendation.currentStock <= recommendation.minStock
    val borderColor = if (isSelected) IndustrialCyan else if (isCritical) IndustrialRose.copy(alpha = 0.5f) else Slate800

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Slate900,
        border = BorderStroke(1.dp, borderColor),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header Row: Checkbox, Name, Badge
            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { onToggleSelect() },
                    colors = CheckboxDefaults.colors(
                        checkedColor = IndustrialCyan,
                        checkmarkColor = Slate950,
                        uncheckedColor = Slate600
                    ),
                    modifier = Modifier.size(24.dp)
                )

                Spacer(modifier = Modifier.width(10.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = recommendation.partName,
                        fontWeight = FontWeight.Bold,
                        color = White,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Part No: ${recommendation.sparePartId}",
                        color = Slate400,
                        fontSize = 12.sp
                    )
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = if (isCritical) IndustrialRose.copy(alpha = 0.2f) else IndustrialAmber.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = if (isCritical) "DI BAWAH MIN" else "ROP TRIGGER",
                        color = if (isCritical) IndustrialRose else IndustrialAmber,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Stock Details Bento Grid
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Slate950, RoundedCornerShape(8.dp))
                    .padding(8.dp),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                StockMetric("Fisik Kontainer", "${recommendation.currentStock.toInt()} ${recommendation.unitOfMeasure}", if (isCritical) IndustrialRose else White)
                StockMetric("Min Stock", "${recommendation.minStock.toInt()}", Slate300)
                StockMetric("ROP Formula", "${recommendation.reorderPoint?.toInt() ?: recommendation.minStock.toInt()}", IndustrialAmber)
                StockMetric("Saran Drop", "+${recommendation.recommendedOrderQty.toInt()}", IndustrialCyan)
            }

            // Controls when item is selected
            if (isSelected) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Kuantitas Diajukan:",
                        color = Slate300,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = onDecrement,
                            modifier = Modifier
                                .size(32.dp)
                                .background(Slate800, CircleShape)
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = "Kurang", tint = White, modifier = Modifier.size(16.dp))
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Slate950,
                            border = BorderStroke(1.dp, IndustrialCyan)
                        ) {
                            Text(
                                text = "${draftQty.toInt()} ${recommendation.unitOfMeasure}",
                                color = IndustrialCyan,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        IconButton(
                            onClick = onIncrement,
                            modifier = Modifier
                                .size(32.dp)
                                .background(IndustrialCyan, CircleShape)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Tambah", tint = Slate950, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StockMetric(label: String, value: String, valueColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, fontSize = 10.sp, color = Slate500)
        Text(text = value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = valueColor)
    }
}
