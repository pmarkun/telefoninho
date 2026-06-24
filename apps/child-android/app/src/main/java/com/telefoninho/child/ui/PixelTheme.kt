package com.telefoninho.child.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object PixelTheme {
    val bg = Color(0xFFD7F5D0)
    val fg = Color(0xFF1B3D1B)
    val panel = Color(0xFFB8E6B0)
    val accent = Color(0xFF2F7D32)
}

fun Modifier.pixelSurface(): Modifier =
    this
        .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
        .background(Color(0xFFEAF8DD))
