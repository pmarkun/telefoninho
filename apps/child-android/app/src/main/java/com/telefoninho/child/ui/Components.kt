package com.telefoninho.child.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.telefoninho.child.data.CallStatus
import com.telefoninho.child.data.ContactInfo

@Composable
fun PixelTitle(text: String) {
    Text(
        text = text, color = PixelTheme.fg, fontSize = 32.sp,
        fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
        textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun PixelButton(
    text: String, enabled: Boolean = true, danger: Boolean = false, onClick: () -> Unit,
) {
    val bg = when {
        !enabled -> Color(0xFF9DAA96)
        danger -> Color(0xFFC93F3F)
        else -> PixelTheme.accent
    }
    Box(
        modifier = Modifier.fillMaxWidth().height(72.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(bg)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text, color = Color.White, fontSize = 18.sp,
            fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
            maxLines = 2, overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun PixelIconButton(
    text: String,
    enabled: Boolean = true,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    val bg = when {
        !enabled -> Color(0xFF9DAA96)
        danger -> Color(0xFFC93F3F)
        else -> PixelTheme.accent
    }
    Box(
        modifier = Modifier.size(64.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(bg)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Clip,
        )
    }
}

@Composable
fun PixelCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().pixelSurface().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}

@Composable
fun CodeInput(value: String, onValueChange: (String) -> Unit) {
    BasicTextField(
        value = value, onValueChange = onValueChange,
        cursorBrush = SolidColor(PixelTheme.fg),
        textStyle = TextStyle(
            color = PixelTheme.fg, fontSize = 30.sp, fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center,
        ),
        modifier = Modifier.fillMaxWidth().height(64.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(Color(0xFFEAF8DD))
            .padding(top = 12.dp),
        decorationBox = { innerTextField ->
            Box(contentAlignment = Alignment.Center) {
                if (value.isEmpty()) {
                    Text(
                        text = "------", color = PixelTheme.fg.copy(alpha = 0.35f),
                        fontSize = 30.sp, fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center,
                    )
                }
                innerTextField()
            }
        },
    )
}

@Composable
fun PixelTextInput(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        cursorBrush = SolidColor(PixelTheme.fg),
        textStyle = TextStyle(
            color = PixelTheme.fg, fontSize = 16.sp, fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace, textAlign = TextAlign.Start,
        ),
        singleLine = true,
        modifier = Modifier.fillMaxWidth().height(58.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(Color(0xFFEAF8DD))
            .padding(horizontal = 12.dp, vertical = 18.dp),
        decorationBox = { innerTextField ->
            Box(contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) {
                    Text(
                        text = placeholder, color = PixelTheme.fg.copy(alpha = 0.35f),
                        fontSize = 16.sp, fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                innerTextField()
            }
        },
    )
}

@Composable
fun PixelAvatar(name: String, color: Color, size: Int) {
    Box(
        modifier = Modifier.size(size.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(color),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier.size((size / 3).dp)
                .align(Alignment.TopStart)
                .background(Color.White.copy(alpha = 0.22f)),
        )
        Text(
            text = name.take(2).uppercase(), color = Color.White,
            fontSize = (size / 3).sp, fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
fun BigContactHero(contact: ContactInfo, label: String) {
    val color = parseColor(contact.colorKey)
    Text(
        text = label, color = PixelTheme.fg, fontSize = 17.sp,
        fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(14.dp))
    PixelAvatar(name = contact.displayName, color = color, size = 96)
    Spacer(modifier = Modifier.height(14.dp))
    Text(
        text = contact.displayName, color = PixelTheme.fg, fontSize = 34.sp,
        fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
        maxLines = 1, overflow = TextOverflow.Ellipsis,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun ContactButton(contact: ContactInfo, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val color = parseColor(contact.colorKey)
    Column(
        modifier = modifier.aspectRatio(1f)
            .alpha(if (contact.enabled) 1f else 0.42f)
            .pixelSurface()
            .clickable(enabled = contact.enabled, onClick = onClick).padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PixelAvatar(name = contact.displayName, color = color, size = 54)
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = if (contact.enabled) contact.displayName else "${contact.displayName}\nPENDENTE",
            color = PixelTheme.fg,
            fontSize = if (contact.enabled) 18.sp else 14.sp,
            fontWeight = FontWeight.Black, maxLines = 2,
            overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun ContactGrid(contacts: List<ContactInfo>, onCall: (ContactInfo) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        contacts.chunked(2).forEach { rowContacts ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                rowContacts.forEach { contact ->
                    ContactButton(contact = contact, onClick = { onCall(contact) }, modifier = Modifier.weight(1f))
                }
                if (rowContacts.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
fun TelefoninhoFrame(
    status: String, statusKind: CallStatus, content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(PixelTheme.bg, Color(0xFFEAF7D8), Color(0xFFD8ECFF)),
                ),
            ).padding(18.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .shadow(0.dp)
                .border(5.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
                .background(PixelTheme.panel)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            content()
            Spacer(modifier = Modifier.height(18.dp))
            StatusBar8Bit(status = status, statusKind = statusKind)
        }
    }
}

@Composable
fun StatusBar8Bit(status: String, statusKind: CallStatus) {
    val light = when (statusKind) {
        CallStatus.Ready -> Color(0xFF2F7D32)
        CallStatus.Calling -> Color(0xFF245D8C)
        CallStatus.InCall -> Color(0xFF6A4A9C)
        CallStatus.Ringing -> Color(0xFFC93F3F)
    }
    Row(
        modifier = Modifier.fillMaxWidth().height(42.dp)
            .border(3.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(Color(0xFFEAF8DD))
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(14.dp)
                .background(light)
                .border(2.dp, PixelTheme.fg, RoundedCornerShape(0.dp)),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = status, color = PixelTheme.fg, fontSize = 18.sp,
            fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
fun Bips() {
    val transition = rememberInfiniteTransition(label = "bips")
    val alpha by transition.animateFloat(
        initialValue = 0.35f, targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(500), repeatMode = RepeatMode.Reverse),
        label = "bipAlpha",
    )
    Text(
        text = "BIP... BIP...", color = PixelTheme.fg.copy(alpha = alpha),
        fontSize = 24.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
    )
}

@Composable
fun PixelClock(seconds: Int) {
    val minutes = seconds / 60
    val rest = seconds % 60
    Text(
        text = "%02d:%02d".format(minutes, rest), color = PixelTheme.fg,
        fontSize = 38.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
    )
}

fun parseColor(key: String): Color = when (key) {
    "blue" -> Color(0xFF245D8C)
    "pink" -> Color(0xFF9C2F5D)
    "purple" -> Color(0xFF6A4A9C)
    "green" -> Color(0xFF2F7D32)
    "red" -> Color(0xFFC93F3F)
    "orange" -> Color(0xFFD47A2A)
    else -> Color(0xFF2F7D32)
}
