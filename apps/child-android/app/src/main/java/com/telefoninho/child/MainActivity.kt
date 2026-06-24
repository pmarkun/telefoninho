package com.telefoninho.child

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                TelefoninhoApp()
            }
        }
    }
}

private enum class CallStatus {
    Ready,
    Calling,
    InCall,
    Ringing
}

private sealed interface ChildScreen {
    data object Pairing : ChildScreen
    data object Home : ChildScreen
    data class Calling(val contact: DemoContact) : ChildScreen
    data class InCall(val contact: DemoContact) : ChildScreen
    data class Incoming(val contact: DemoContact) : ChildScreen
}

private data class DemoContact(
    val name: String,
    val avatar: String,
    val color: Color
)

private val demoContacts = listOf(
    DemoContact("PAPAI", "PA", Color(0xFF245D8C)),
    DemoContact("MAMAE", "MA", Color(0xFF9C2F5D)),
    DemoContact("VO", "VO", Color(0xFF6A4A9C)),
    DemoContact("MARIA", "MI", Color(0xFF2F7D32))
)

@Composable
private fun TelefoninhoApp() {
    var screen: ChildScreen by remember { mutableStateOf(ChildScreen.Pairing) }

    Surface(modifier = Modifier.fillMaxSize(), color = PixelTheme.bg) {
        AnimatedContent(
            targetState = screen,
            transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(120)) },
            label = "screen"
        ) { current ->
            when (current) {
                ChildScreen.Pairing -> PairingScreen(onPaired = { screen = ChildScreen.Home })
                ChildScreen.Home -> HomeScreen(
                    contacts = demoContacts,
                    onCall = { screen = ChildScreen.Calling(it) },
                    onIncomingDemo = { screen = ChildScreen.Incoming(demoContacts.first()) }
                )
                is ChildScreen.Calling -> CallingScreen(
                    contact = current.contact,
                    onConnected = { screen = ChildScreen.InCall(current.contact) },
                    onHangup = { screen = ChildScreen.Home }
                )
                is ChildScreen.InCall -> ActiveCallScreen(
                    contact = current.contact,
                    onHangup = { screen = ChildScreen.Home }
                )
                is ChildScreen.Incoming -> IncomingCallScreen(
                    contact = current.contact,
                    onAccept = { screen = ChildScreen.InCall(current.contact) },
                    onDecline = { screen = ChildScreen.Home }
                )
            }
        }
    }
}

@Composable
private fun PairingScreen(onPaired: () -> Unit) {
    var code by remember { mutableStateOf("") }

    TelefoninhoFrame(status = "conectar", statusKind = CallStatus.Ready) {
        Spacer(modifier = Modifier.height(18.dp))
        PixelTitle(text = "TELEFONINHO")
        Spacer(modifier = Modifier.height(30.dp))
        PixelCard {
            Text(
                text = "CODIGO DOS PAIS",
                color = PixelTheme.fg,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(18.dp))
            CodeInput(value = code, onValueChange = { code = it.filter(Char::isDigit).take(6) })
            Spacer(modifier = Modifier.height(18.dp))
            PixelButton(text = "LIGAR MEU TELEFONINHO", enabled = code.length == 6, onClick = onPaired)
        }
    }
}

@Composable
private fun HomeScreen(
    contacts: List<DemoContact>,
    onCall: (DemoContact) -> Unit,
    onIncomingDemo: () -> Unit
) {
    TelefoninhoFrame(status = "pronto", statusKind = CallStatus.Ready) {
        PixelTitle(text = "TELEFONINHO")
        Spacer(modifier = Modifier.height(22.dp))
        ContactGrid(contacts = contacts, onCall = onCall)
        Spacer(modifier = Modifier.height(16.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(28.dp)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onIncomingDemo
                )
        )
    }
}

@Composable
private fun CallingScreen(
    contact: DemoContact,
    onConnected: () -> Unit,
    onHangup: () -> Unit
) {
    LaunchedEffect(contact) {
        delay(1800)
        onConnected()
    }

    TelefoninhoFrame(status = "chamando", statusKind = CallStatus.Calling) {
        BigContactHero(contact = contact, label = "LIGANDO PARA")
        Spacer(modifier = Modifier.height(18.dp))
        Bips()
        Spacer(modifier = Modifier.height(28.dp))
        PixelButton(text = "DESLIGAR", danger = true, onClick = onHangup)
    }
}

@Composable
private fun IncomingCallScreen(
    contact: DemoContact,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    TelefoninhoFrame(status = "tocando", statusKind = CallStatus.Ringing) {
        BigContactHero(contact = contact, label = "ESTA LIGANDO")
        Spacer(modifier = Modifier.height(24.dp))
        PixelButton(text = "ATENDER", onClick = onAccept)
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "AGORA NAO", danger = true, onClick = onDecline)
    }
}

@Composable
private fun ActiveCallScreen(
    contact: DemoContact,
    onHangup: () -> Unit
) {
    var seconds by remember { mutableStateOf(0) }

    LaunchedEffect(contact) {
        while (true) {
            delay(1000)
            seconds += 1
        }
    }

    TelefoninhoFrame(status = "chamada", statusKind = CallStatus.InCall) {
        BigContactHero(contact = contact, label = "FALANDO COM")
        Spacer(modifier = Modifier.height(20.dp))
        PixelClock(seconds = seconds)
        Spacer(modifier = Modifier.height(26.dp))
        PixelButton(text = "DESLIGAR", danger = true, onClick = onHangup)
    }
}

@Composable
private fun TelefoninhoFrame(
    status: String,
    statusKind: CallStatus,
    content: @Composable ColumnScope.() -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(PixelTheme.bg, Color(0xFFEAF7D8), Color(0xFFD8ECFF))
                )
            )
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .shadow(0.dp)
                .border(5.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
                .background(PixelTheme.panel)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            content()
            Spacer(modifier = Modifier.height(18.dp))
            StatusBar8Bit(status = status, statusKind = statusKind)
        }
    }
}

@Composable
private fun ContactGrid(
    contacts: List<DemoContact>,
    onCall: (DemoContact) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        contacts.chunked(2).forEach { rowContacts ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                rowContacts.forEach { contact ->
                    ContactButton(
                        contact = contact,
                        onClick = { onCall(contact) },
                        modifier = Modifier.weight(1f)
                    )
                }
                if (rowContacts.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ContactButton(
    contact: DemoContact,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .aspectRatio(1f)
            .pixelSurface()
            .clickable(onClick = onClick)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        PixelAvatar(contact = contact, size = 54)
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = contact.name,
            color = PixelTheme.fg,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun BigContactHero(contact: DemoContact, label: String) {
    Text(
        text = label,
        color = PixelTheme.fg,
        fontSize = 17.sp,
        fontWeight = FontWeight.Black,
        textAlign = TextAlign.Center
    )
    Spacer(modifier = Modifier.height(14.dp))
    PixelAvatar(contact = contact, size = 96)
    Spacer(modifier = Modifier.height(14.dp))
    Text(
        text = contact.name,
        color = PixelTheme.fg,
        fontSize = 34.sp,
        fontWeight = FontWeight.Black,
        textAlign = TextAlign.Center,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun PixelAvatar(contact: DemoContact, size: Int) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(contact.color),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size((size / 3).dp)
                .align(Alignment.TopStart)
                .background(Color.White.copy(alpha = 0.22f))
        )
        Text(
            text = contact.avatar,
            color = Color.White,
            fontSize = (size / 3).sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun PixelButton(
    text: String,
    enabled: Boolean = true,
    danger: Boolean = false,
    onClick: () -> Unit
) {
    val bg = when {
        !enabled -> Color(0xFF9DAA96)
        danger -> Color(0xFFC93F3F)
        else -> PixelTheme.accent
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(bg)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun PixelCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .pixelSurface()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content
    )
}

@Composable
private fun CodeInput(value: String, onValueChange: (String) -> Unit) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        cursorBrush = SolidColor(PixelTheme.fg),
        textStyle = TextStyle(
            color = PixelTheme.fg,
            fontSize = 30.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.Center
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
            .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(Color(0xFFEAF8DD))
            .padding(top = 12.dp),
        decorationBox = { innerTextField ->
            Box(contentAlignment = Alignment.Center) {
                if (value.isEmpty()) {
                    Text(
                        text = "------",
                        color = PixelTheme.fg.copy(alpha = 0.35f),
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    )
                }
                innerTextField()
            }
        }
    )
}

@Composable
private fun PixelTitle(text: String) {
    Text(
        text = text,
        color = PixelTheme.fg,
        fontSize = 32.sp,
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.Monospace,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun StatusBar8Bit(status: String, statusKind: CallStatus) {
    val light = when (statusKind) {
        CallStatus.Ready -> Color(0xFF2F7D32)
        CallStatus.Calling -> Color(0xFF245D8C)
        CallStatus.InCall -> Color(0xFF6A4A9C)
        CallStatus.Ringing -> Color(0xFFC93F3F)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(42.dp)
            .border(3.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
            .background(Color(0xFFEAF8DD))
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(14.dp)
                .background(light)
                .border(2.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = status,
            color = PixelTheme.fg,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun Bips() {
    val transition = rememberInfiniteTransition(label = "bips")
    val alpha by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(500), repeatMode = RepeatMode.Reverse),
        label = "bipAlpha"
    )

    Text(
        text = "BIP... BIP...",
        color = PixelTheme.fg.copy(alpha = alpha),
        fontSize = 24.sp,
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.Monospace
    )
}

@Composable
private fun PixelClock(seconds: Int) {
    val minutes = seconds / 60
    val rest = seconds % 60
    Text(
        text = "%02d:%02d".format(minutes, rest),
        color = PixelTheme.fg,
        fontSize = 38.sp,
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.Monospace
    )
}

private fun Modifier.pixelSurface(): Modifier =
    this
        .border(4.dp, PixelTheme.fg, RoundedCornerShape(0.dp))
        .background(Color(0xFFEAF8DD))

private object PixelTheme {
    val bg = Color(0xFFD7F5D0)
    val fg = Color(0xFF1B3D1B)
    val panel = Color(0xFFB8E6B0)
    val accent = Color(0xFF2F7D32)
}
