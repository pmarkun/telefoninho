package com.telefoninho.child.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

data class PixelPalette(
    val bg: Color,
    val fg: Color,
    val panel: Color,
    val accent: Color,
    val surface: Color,
    val gradientMid: Color,
    val gradientEnd: Color,
)

object PixelTheme {
    private val bulbassauro = PixelPalette(
        bg = Color(0xFFD7F5D0),
        fg = Color(0xFF1B3D1B),
        panel = Color(0xFFB8E6B0),
        accent = Color(0xFF2F7D32),
        surface = Color(0xFFEAF8DD),
        gradientMid = Color(0xFFEAF7D8),
        gradientEnd = Color(0xFFD8ECFF),
    )

    private val squirtle = PixelPalette(
        bg = Color(0xFFD8ECFF),
        fg = Color(0xFF163B5C),
        panel = Color(0xFFACD7F5),
        accent = Color(0xFF245D8C),
        surface = Color(0xFFE7F5FF),
        gradientMid = Color(0xFFE5F8FF),
        gradientEnd = Color(0xFFD7F5D0),
    )

    private val charmander = PixelPalette(
        bg = Color(0xFFFFE1C2),
        fg = Color(0xFF5A260F),
        panel = Color(0xFFFFBE74),
        accent = Color(0xFFD65F1A),
        surface = Color(0xFFFFF0DA),
        gradientMid = Color(0xFFFFE8B8),
        gradientEnd = Color(0xFFD8ECFF),
    )

    private var palette by mutableStateOf(bulbassauro)

    val bg: Color get() = palette.bg
    val fg: Color get() = palette.fg
    val panel: Color get() = palette.panel
    val accent: Color get() = palette.accent
    val surface: Color get() = palette.surface
    val gradientMid: Color get() = palette.gradientMid
    val gradientEnd: Color get() = palette.gradientEnd

    fun applyPalette(name: String) {
        palette = when (name) {
            "squirtle" -> squirtle
            "charmander" -> charmander
            else -> bulbassauro
        }
    }
}

fun Modifier.pixelSurface(): Modifier =
    this
        .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
        .background(PixelTheme.surface)
