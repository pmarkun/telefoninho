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
        bg = Color(0xFFB7E36C),
        fg = Color(0xFF143B1B),
        panel = Color(0xFF7CCB68),
        accent = Color(0xFF2B7D3B),
        surface = Color(0xFFE8F8BF),
        gradientMid = Color(0xFFC8F082),
        gradientEnd = Color(0xFFFFC7D7),
    )

    private val squirtle = PixelPalette(
        bg = Color(0xFF7EC8FF),
        fg = Color(0xFF0D355C),
        panel = Color(0xFF4DA3D9),
        accent = Color(0xFF1F5D9C),
        surface = Color(0xFFD9F2FF),
        gradientMid = Color(0xFF9EE4FF),
        gradientEnd = Color(0xFFFFF0A8),
    )

    private val charmander = PixelPalette(
        bg = Color(0xFFFFA347),
        fg = Color(0xFF5A210D),
        panel = Color(0xFFFF7A32),
        accent = Color(0xFFD63818),
        surface = Color(0xFFFFE0A8),
        gradientMid = Color(0xFFFFC247),
        gradientEnd = Color(0xFFFF6A3D),
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
