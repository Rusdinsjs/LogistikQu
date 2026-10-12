package com.sjs.logistikqu.presentation.screens.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import com.sjs.logistikqu.R
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

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onLoginSuccess()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate950)
            .statusBarsPadding()
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Enterprise App Logo (SJS-VIPO Emblem)
            Image(
                painter = painterResource(id = R.drawable.app_logo),
                contentDescription = "Logo SJS-VIPO LogistikQu",
                modifier = Modifier
                    .size(92.dp)
                    .clip(RoundedCornerShape(20.dp))
            )

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

            // Cloud Server Connection Pill (Fixed Production Backend)
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Slate900,
                border = BorderStroke(1.dp, Slate800)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(IndustrialEmerald, RoundedCornerShape(4.dp))
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "logistik.sjsgroup.online",
                        color = Slate200,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "• Auto-Sync",
                        color = IndustrialEmerald,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Akses Akun Demo Cepat:",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate300
                )
                Text(
                    text = "Password: password123",
                    fontSize = 10.sp,
                    color = Slate500
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            // 1. MEKANIK (MOBILE FIELD REQUEST)
            Text(
                text = "PERAN MEKANIK (MOBILE FIELD REQUEST)",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = IndustrialPurple,
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAccountChip(
                    label = "mekanik_he",
                    role = "Mekanik HE",
                    description = "Alat Berat • EMP-101",
                    accentColor = IndustrialPurple,
                    onClick = { viewModel.quickLogin("mekanik_he") },
                    modifier = Modifier.weight(1f)
                )
                QuickAccountChip(
                    label = "mekanik_dt",
                    role = "Mekanik DT",
                    description = "Dump Truck • EMP-103",
                    accentColor = IndustrialPurple,
                    onClick = { viewModel.quickLogin("mekanik_dt") },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // 2. ADMIN KONTAINER & GUDANG
            Text(
                text = "ADMIN KONTAINER & GUDANG UTAMA",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = IndustrialCyan,
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAccountChip(
                    label = "admin_cont_he",
                    role = "Admin Kontainer HE",
                    description = "POS Issue & Stock",
                    accentColor = IndustrialCyan,
                    onClick = { viewModel.quickLogin("admin_cont_he") },
                    modifier = Modifier.weight(1f)
                )
                QuickAccountChip(
                    label = "admin_main_he",
                    role = "Admin Utama HE",
                    description = "Drop & Verifikasi",
                    accentColor = IndustrialBlue,
                    onClick = { viewModel.quickLogin("admin_main_he") },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // 3. SUPERVISOR & MANAJEMEN
            Text(
                text = "SUPERVISOR & MANAJEMEN SISTEM",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = IndustrialAmber,
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAccountChip(
                    label = "supervisor_he",
                    role = "Supervisor HE",
                    description = "Approval STO",
                    accentColor = IndustrialAmber,
                    onClick = { viewModel.quickLogin("supervisor_he") },
                    modifier = Modifier.weight(1f)
                )
                QuickAccountChip(
                    label = "manager",
                    role = "Manager Logistik",
                    description = "Executive Oversight",
                    accentColor = IndustrialEmerald,
                    onClick = { viewModel.quickLogin("manager") },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAccountChip(
                    label = "superadmin",
                    role = "Super Admin Sistem",
                    description = "Akses Root Penuh",
                    accentColor = Slate300,
                    onClick = { viewModel.quickLogin("superadmin") },
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
                                viewModel.quickLogin("superadmin")
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
}

@Composable
fun QuickAccountChip(
    label: String,
    role: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accentColor: Color = IndustrialCyan,
    description: String? = null
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        color = Slate900,
        border = BorderStroke(1.dp, Slate800)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 7.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = label, color = accentColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(text = role, color = Slate200, fontSize = 10.sp, fontWeight = FontWeight.Medium)
            if (description != null) {
                Text(text = description, color = Slate400, fontSize = 9.sp)
            }
        }
    }
}
