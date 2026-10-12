package com.sjs.logistikqu.presentation.screens.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.sjs.logistikqu.presentation.components.IndustrialButton
import com.sjs.logistikqu.presentation.theme.*
import com.sjs.logistikqu.security.BiometricAuthManager

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoginSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    var tempUrl by remember(uiState.serverUrl) { mutableStateOf(uiState.serverUrl) }

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onLoginSuccess()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate950)
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Top Bar with Server Settings
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                IconButton(onClick = { viewModel.toggleServerSettings(true) }) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "Pengaturan Server",
                        tint = IndustrialCyan
                    )
                }
            }

            // Enterprise App Logo
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .background(IndustrialEmerald, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "LQ",
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Black,
                    color = Slate950
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "LogistikQu Mobile",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = White
            )

            Text(
                text = "SJS-VIPO — Industrial Handheld WMS",
                fontSize = 12.sp,
                color = Slate400
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Server URL Badge (Clickable to change)
            Surface(
                modifier = Modifier.clickable { viewModel.toggleServerSettings(true) },
                shape = RoundedCornerShape(10.dp),
                color = Slate900,
                border = BorderStroke(1.dp, Slate800)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Dns,
                        contentDescription = null,
                        tint = IndustrialCyan,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Server: ${uiState.serverUrl}",
                        color = Slate300,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        tint = Slate500,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Username input
            OutlinedTextField(
                value = uiState.username,
                onValueChange = viewModel::onUsernameChange,
                label = { Text("Username", color = Slate400) },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = IndustrialCyan) },
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialCyan,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White,
                    unfocusedTextColor = Slate200
                ),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Password input
            OutlinedTextField(
                value = uiState.password,
                onValueChange = viewModel::onPasswordChange,
                label = { Text("Password", color = Slate400) },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = IndustrialCyan) },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate900,
                    unfocusedContainerColor = Slate900,
                    focusedBorderColor = IndustrialCyan,
                    unfocusedBorderColor = Slate700,
                    focusedTextColor = White,
                    unfocusedTextColor = Slate200
                ),
                singleLine = true
            )

            if (uiState.errorMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = IndustrialRose.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, IndustrialRose),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = uiState.errorMessage!!,
                        color = IndustrialRose,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Login Button (Large Touch Target for Mining Gloves)
            IndustrialButton(
                text = "MASUK KE SISTEM",
                onClick = viewModel::login,
                isLoading = uiState.isLoading
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Quick Demo Account Chips
            Text(
                text = "Pilih Akun Demo Cepat:",
                fontSize = 11.sp,
                color = Slate400,
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAccountChip(
                    label = "superadmin",
                    role = "Super Admin",
                    onClick = {
                        viewModel.onUsernameChange("superadmin")
                        viewModel.onPasswordChange("password123")
                    },
                    modifier = Modifier.weight(1f)
                )
                QuickAccountChip(
                    label = "admin_cont_he",
                    role = "Admin Kontainer",
                    onClick = {
                        viewModel.onUsernameChange("admin_cont_he")
                        viewModel.onPasswordChange("password123")
                    },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAccountChip(
                    label = "supervisor_he",
                    role = "Supervisor",
                    onClick = {
                        viewModel.onUsernameChange("supervisor_he")
                        viewModel.onPasswordChange("password123")
                    },
                    modifier = Modifier.weight(1f)
                )
                QuickAccountChip(
                    label = "manager",
                    role = "Manager",
                    onClick = {
                        viewModel.onUsernameChange("manager")
                        viewModel.onPasswordChange("password123")
                    },
                    modifier = Modifier.weight(1f)
                )
            }

            if (uiState.isBiometricAvailable && activity != null) {
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(
                    onClick = {
                        val biometricManager = BiometricAuthManager(context)
                        biometricManager.promptBiometric(
                            activity = activity,
                            onSuccess = {
                                viewModel.onUsernameChange("superadmin")
                                viewModel.onPasswordChange("password123")
                                viewModel.login()
                            },
                            onError = { /* ignored */ }
                        )
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate200),
                    border = BorderStroke(1.dp, Slate700)
                ) {
                    Icon(Icons.Default.Fingerprint, contentDescription = null, tint = IndustrialCyan)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Masuk dengan Biometrik", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }

    // Server Settings Dialog
    if (uiState.showServerSettings) {
        AlertDialog(
            onDismissRequest = { viewModel.toggleServerSettings(false) },
            containerColor = Slate900,
            title = {
                Text(
                    text = "Konfigurasi URL Server",
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
            },
            text = {
                Column {
                    Text(
                        text = "Pilih host backend atau masukkan URL server kustom:",
                        color = Slate400,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Preset buttons
                    Button(
                        onClick = { tempUrl = "http://10.0.2.2:8090/" },
                        colors = ButtonDefaults.buttonColors(containerColor = if (tempUrl.contains("10.0.2.2")) IndustrialCyan else Slate800),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Android Emulator (10.0.2.2:8090)",
                            color = if (tempUrl.contains("10.0.2.2")) Slate950 else White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = { tempUrl = "http://192.168.100.7:8090/" },
                        colors = ButtonDefaults.buttonColors(containerColor = if (tempUrl.contains("192.168.100.7")) IndustrialEmerald else Slate800),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Wi-Fi LAN Host (192.168.100.7:8090)",
                            color = if (tempUrl.contains("192.168.100.7")) Slate950 else White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = { tempUrl = "https://logistik.sjsgroup.online/" },
                        colors = ButtonDefaults.buttonColors(containerColor = if (tempUrl.contains("sjsgroup")) IndustrialAmber else Slate800),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "VPS Online (logistik.sjsgroup.online)",
                            color = if (tempUrl.contains("sjsgroup")) Slate950 else White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = tempUrl,
                        onValueChange = { tempUrl = it },
                        label = { Text("URL Server", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = White,
                            unfocusedTextColor = Slate200,
                            focusedBorderColor = IndustrialCyan
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.updateServerUrl(tempUrl) },
                    colors = ButtonDefaults.buttonColors(containerColor = IndustrialEmerald)
                ) {
                    Text("SIMPAN", color = Slate950, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.toggleServerSettings(false) }) {
                    Text("BATAL", color = Slate400)
                }
            }
        )
    }
}

@Composable
fun QuickAccountChip(
    label: String,
    role: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(10.dp),
        color = Slate900,
        border = BorderStroke(1.dp, Slate800)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = label, color = IndustrialCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(text = role, color = Slate400, fontSize = 10.sp)
        }
    }
}
