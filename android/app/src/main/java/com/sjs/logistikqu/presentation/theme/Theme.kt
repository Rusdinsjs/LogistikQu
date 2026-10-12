package com.sjs.logistikqu.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// High Contrast Industrial Mining Color Palette
val Slate950 = Color(0xFF020617)
val Slate900 = Color(0xFF0F172A)
val Slate800 = Color(0xFF1E293B)
val Slate700 = Color(0xFF334155)
val Slate600 = Color(0xFF475569)
val Slate500 = Color(0xFF64748B)
val Slate400 = Color(0xFF94A3B8)
val Slate300 = Color(0xFFCBD5E1)
val Slate200 = Color(0xFFE2E8F0)
val White = Color(0xFFFFFFFF)

// Operational Accents
val IndustrialEmerald = Color(0xFF10B981) // Normal / Pass / Inbound
val IndustrialGreen = IndustrialEmerald
val IndustrialAmber = Color(0xFFF59E0B)   // Warning / Moderate / In-Transit
val IndustrialRose = Color(0xFFEF4444)    // Critical / Breakdown / Defect
val IndustrialCyan = Color(0xFF06B6D4)    // Barcode / Scanner Active
val IndustrialBlue = Color(0xFF3B82F6)    // Equipment / WO
val IndustrialPurple = Color(0xFF8B5CF6)  // Mechanic / Permohonan Stok

val DarkColorScheme = darkColorScheme(
    primary = IndustrialEmerald,
    onPrimary = Slate950,
    primaryContainer = Color(0xFF064E3B),
    onPrimaryContainer = Color(0xFFA7F3D0),
    secondary = IndustrialCyan,
    onSecondary = Slate950,
    background = Slate950,
    onBackground = Slate200,
    surface = Slate900,
    onSurface = Slate200,
    surfaceVariant = Slate800,
    onSurfaceVariant = Slate400,
    error = IndustrialRose,
    onError = Slate950
)

val LightColorScheme = lightColorScheme(
    primary = Color(0xFF059669),
    onPrimary = White,
    secondary = Color(0xFF0284C7),
    onSecondary = White,
    background = Color(0xFFF8FAFC),
    onBackground = Slate900,
    surface = White,
    onSurface = Slate900,
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Slate700,
    error = IndustrialRose,
    onError = White
)

val Typography = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 36.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        lineHeight = 20.sp
    )
)

@Composable
fun LogistikQuTheme(
    darkTheme: Boolean = true, // Default to High Contrast Dark for Rugged Screens
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
