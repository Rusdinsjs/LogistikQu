package com.sjs.logistikqu.presentation.screens.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.domain.entities.User
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    user: User?,
    activeWarehouse: String,
    onLogoutClick: () -> Unit = {},
    onNavigateBack: (() -> Unit)? = null
) {
    Scaffold(
        containerColor = Slate950,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Profil Petugas & Pengaturan",
                        fontWeight = FontWeight.Bold,
                        color = White,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Kembali",
                                tint = White
                            )
                        }
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Identity Header Card (Hero Profile)
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Slate900,
                border = BorderStroke(1.dp, Slate800)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Avatar Ring
                    Box(
                        modifier = Modifier
                            .size(76.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(IndustrialEmerald, IndustrialCyan)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(70.dp)
                                .clip(CircleShape)
                                .background(Slate950),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = user?.fullName?.take(2)?.uppercase() ?: "LQ",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                color = IndustrialEmerald
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = user?.fullName ?: "Petugas Logistik",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = White
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "@${user?.username ?: "operator"}",
                        fontSize = 13.sp,
                        color = Slate400
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Role Chip
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (user?.isSupervisor == true) IndustrialAmber.copy(alpha = 0.15f) else IndustrialEmerald.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, if (user?.isSupervisor == true) IndustrialAmber else IndustrialEmerald)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(
                                imageVector = if (user?.isSupervisor == true) Icons.Default.AdminPanelSettings else Icons.Default.Badge,
                                contentDescription = null,
                                tint = if (user?.isSupervisor == true) IndustrialAmber else IndustrialEmerald,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = user?.role?.uppercase() ?: "OPERATOR LAPANGAN",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (user?.isSupervisor == true) IndustrialAmber else IndustrialEmerald
                            )
                        }
                    }
                }
            }

            // 2. Warehouse Assignment Card
            ProfileSectionCard(
                title = "PENUGASAN OPERASIONAL",
                icon = Icons.Default.Warehouse
            ) {
                ProfileInfoRow(
                    icon = Icons.Default.Storefront,
                    label = "Gudang Aktif",
                    value = activeWarehouse
                )
                HorizontalDivider(color = Slate800, thickness = 1.dp)
                ProfileInfoRow(
                    icon = Icons.Default.LocationOn,
                    label = "Area Site",
                    value = "Site Sorowako (SJS-VIPO Mining Pit)"
                )
                HorizontalDivider(color = Slate800, thickness = 1.dp)
                ProfileInfoRow(
                    icon = Icons.Default.FactCheck,
                    label = "Tipe Otorisasi",
                    value = if (user?.isSupervisor == true) "Full Operational & Approval Replenishment" else "POS Issue, Receive STO, & Opname Rak"
                )
            }

            // 3. System & Connectivity Card
            ProfileSectionCard(
                title = "KONEKSI CLOUD & PERANGKAT",
                icon = Icons.Default.Dns
            ) {
                ProfileInfoRow(
                    icon = Icons.Default.CloudQueue,
                    label = "Host Backend Cloud",
                    value = "https://logistik.sjsgroup.online/",
                    valueColor = IndustrialCyan
                )
                HorizontalDivider(color = Slate800, thickness = 1.dp)
                ProfileInfoRow(
                    icon = Icons.Default.Sync,
                    label = "Sync Engine",
                    value = "Offline-First Distributed Engine (SQLite)"
                )
                HorizontalDivider(color = Slate800, thickness = 1.dp)
                ProfileInfoRow(
                    icon = Icons.Default.Smartphone,
                    label = "ID Terminal / Hardware",
                    value = "ANDROID-WH-001 (Device Binding Aktif)"
                )
                HorizontalDivider(color = Slate800, thickness = 1.dp)
                ProfileInfoRow(
                    icon = Icons.Default.Security,
                    label = "Versi Sistem",
                    value = "LogistikQu Mobile v2.1.0 Enterprise"
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ProfileSectionCard(
    title: String,
    icon: ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = Slate900,
        border = BorderStroke(1.dp, Slate800)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = IndustrialEmerald,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate400,
                    letterSpacing = 1.sp
                )
            }
            content()
        }
    }
}

@Composable
private fun ProfileInfoRow(
    icon: ImageVector,
    label: String,
    value: String,
    valueColor: Color = White
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Slate800),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Slate300,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, fontSize = 11.sp, color = Slate400)
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = value,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = valueColor
            )
        }
    }
}
