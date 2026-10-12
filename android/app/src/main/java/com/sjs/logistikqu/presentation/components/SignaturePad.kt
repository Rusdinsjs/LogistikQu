package com.sjs.logistikqu.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Draw
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.sjs.logistikqu.presentation.theme.*

@Composable
fun SignaturePad(
    onSignatureConfirmed: (List<List<Offset>>) -> Unit,
    onCancel: () -> Unit,
    signerName: String = "Mekanik Armada"
) {
    // List of strokes, each stroke is a list of points (Offset)
    var currentPath by remember { mutableStateOf<List<Offset>>(emptyList()) }
    var paths by remember { mutableStateOf<List<List<Offset>>>(emptyList()) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Slate900, RoundedCornerShape(16.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Draw,
                    contentDescription = null,
                    tint = IndustrialCyan,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "Tanda Tangan Digital Mekanik",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Penerima: $signerName",
                        color = Slate400,
                        fontSize = 11.sp
                    )
                }
            }

            IconButton(onClick = onCancel) {
                Icon(Icons.Default.Clear, contentDescription = "Tutup", tint = Slate400)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Canvas for drawing signature
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Slate950)
                .border(BorderStroke(1.dp, if (paths.isNotEmpty() || currentPath.isNotEmpty()) IndustrialCyan else Slate800), RoundedCornerShape(12.dp))
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            currentPath = listOf(offset)
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            currentPath = currentPath + change.position
                        },
                        onDragEnd = {
                            if (currentPath.isNotEmpty()) {
                                paths = paths + listOf(currentPath)
                                currentPath = emptyList()
                            }
                        },
                        onDragCancel = {
                            currentPath = emptyList()
                        }
                    )
                }
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                // Baseline guide line
                val baselineY = size.height * 0.78f
                drawLine(
                    color = Color.DarkGray,
                    start = Offset(32f, baselineY),
                    end = Offset(size.width - 32f, baselineY),
                    strokeWidth = 2f
                )

                // Draw completed paths
                for (stroke in paths) {
                    if (stroke.size > 1) {
                        val path = Path().apply {
                            moveTo(stroke.first().x, stroke.first().y)
                            for (i in 1 until stroke.size) {
                                lineTo(stroke[i].x, stroke[i].y)
                            }
                        }
                        drawPath(
                            path = path,
                            color = IndustrialEmerald,
                            style = Stroke(
                                width = 5f,
                                cap = StrokeCap.Round,
                                join = StrokeJoin.Round
                            )
                        )
                    } else if (stroke.size == 1) {
                        drawCircle(
                            color = IndustrialEmerald,
                            radius = 2.5f,
                            center = stroke.first()
                        )
                    }
                }

                // Draw active stroke being dragged
                if (currentPath.size > 1) {
                    val path = Path().apply {
                        moveTo(currentPath.first().x, currentPath.first().y)
                        for (i in 1 until currentPath.size) {
                            lineTo(currentPath[i].x, currentPath[i].y)
                        }
                    }
                    drawPath(
                        path = path,
                        color = IndustrialEmerald,
                        style = Stroke(
                            width = 5f,
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                }
            }

            if (paths.isEmpty() && currentPath.isEmpty()) {
                Text(
                    text = "Goreskan tanda tangan mekanik di area ini...",
                    color = Slate600,
                    fontSize = 12.sp,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Action Buttons: Clear & Confirm
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedButton(
                onClick = {
                    paths = emptyList()
                    currentPath = emptyList()
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Slate700),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300)
            ) {
                Icon(Icons.Default.Clear, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Bersihkan", fontSize = 12.sp)
            }

            Button(
                onClick = {
                    if (paths.isNotEmpty()) {
                        onSignatureConfirmed(paths)
                    }
                },
                enabled = paths.isNotEmpty(),
                modifier = Modifier
                    .weight(1.4f)
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = IndustrialCyan,
                    disabledContainerColor = Slate800
                )
            ) {
                Icon(Icons.Default.Check, contentDescription = null, tint = if (paths.isNotEmpty()) Slate950 else Slate500, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Simpan Tanda Tangan", color = if (paths.isNotEmpty()) Slate950 else Slate500, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun SignaturePadDialog(
    isOpen: Boolean,
    onDismiss: () -> Unit,
    onSignatureConfirmed: (List<List<Offset>>) -> Unit,
    signerName: String
) {
    if (isOpen) {
        Dialog(
            onDismissRequest = onDismiss,
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.7f))
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                SignaturePad(
                    onSignatureConfirmed = {
                        onSignatureConfirmed(it)
                        onDismiss()
                    },
                    onCancel = onDismiss,
                    signerName = signerName
                )
            }
        }
    }
}
