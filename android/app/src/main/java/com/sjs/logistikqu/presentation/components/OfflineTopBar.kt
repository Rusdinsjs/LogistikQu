package com.sjs.logistikqu.presentation.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sjs.logistikqu.presentation.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogistikQuTopBar(
    title: String,
    isOnline: Boolean,
    pendingSyncCount: Int = 0,
    conflictCount: Int = 0,
    deviceId: String = "ANDROID-WH-001",
    onNavigateBack: (() -> Unit)? = null,
    onSyncBadgeClick: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    Column(modifier = Modifier.fillMaxWidth().background(Slate900)) {
        TopAppBar(
            title = {
                Column {
                    Text(
                        text = title,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        color = White
                    )
                    Text(
                        text = "Device ID: $deviceId",
                        fontSize = 11.sp,
                        color = Slate400
                    )
                }
            },
            navigationIcon = {
                if (onNavigateBack != null) {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Kembali",
                            tint = White
                        )
                    }
                }
            },
            actions = {
                // Network Status Indicator Chip
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isOnline) IndustrialEmerald.copy(alpha = 0.15f) else IndustrialAmber.copy(alpha = 0.15f),
                    modifier = Modifier.padding(end = 8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (isOnline) IndustrialEmerald else IndustrialAmber)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isOnline) "ONLINE" else "OFFLINE",
                            color = if (isOnline) IndustrialEmerald else IndustrialAmber,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                }

                // Sync Queue Indicator Badge
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = when {
                        conflictCount > 0 -> IndustrialRose.copy(alpha = 0.2f)
                        pendingSyncCount > 0 -> IndustrialAmber.copy(alpha = 0.2f)
                        else -> Slate800
                    },
                    modifier = Modifier
                        .clickable(enabled = onSyncBadgeClick != null) { onSyncBadgeClick?.invoke() }
                        .padding(end = 8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Icon(
                            imageVector = when {
                                conflictCount > 0 -> Icons.Default.Warning
                                pendingSyncCount > 0 -> Icons.Default.Sync
                                else -> Icons.Default.CloudDone
                            },
                            contentDescription = null,
                            tint = when {
                                conflictCount > 0 -> IndustrialRose
                                pendingSyncCount > 0 -> IndustrialAmber
                                else -> IndustrialEmerald
                            },
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = when {
                                conflictCount > 0 -> "$conflictCount Konflik"
                                pendingSyncCount > 0 -> "$pendingSyncCount Pending"
                                else -> "Synced"
                            },
                            color = when {
                                conflictCount > 0 -> IndustrialRose
                                pendingSyncCount > 0 -> IndustrialAmber
                                else -> IndustrialEmerald
                            },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                actions()
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Slate900,
                scrolledContainerColor = Slate900
            )
        )

        // Offline Banner Alert (Mining Dead Zone Alert)
        AnimatedVisibility(visible = !isOnline) {
            Surface(
                color = IndustrialAmber.copy(alpha = 0.9f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(vertical = 4.dp, horizontal = 12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CloudOff,
                        contentDescription = null,
                        tint = Slate950,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "MODE OFFLINE TAMBANG AKTIF • Transaksi disimpan lokal di Room DB",
                        color = Slate950,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}
