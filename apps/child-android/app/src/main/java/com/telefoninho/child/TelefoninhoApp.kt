package com.telefoninho.child

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.viewinterop.AndroidView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.graphics.Bitmap
import android.graphics.Color
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.common.InputImage
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.telefoninho.child.data.CallStatus
import com.telefoninho.child.data.ContactInfo
import com.telefoninho.child.data.Screen
import com.telefoninho.child.data.ShortMessage
import com.telefoninho.child.data.UiState
import com.telefoninho.child.game.SnakeDirection
import com.telefoninho.child.game.SnakeGameState
import com.telefoninho.child.game.advanceSnake
import com.telefoninho.child.game.newSnakeGame
import com.telefoninho.child.ui.BigContactHero
import com.telefoninho.child.ui.Bips
import com.telefoninho.child.ui.CodeInput
import com.telefoninho.child.ui.ContactGrid
import com.telefoninho.child.ui.PixelButton
import com.telefoninho.child.ui.PixelCard
import com.telefoninho.child.ui.PixelClock
import com.telefoninho.child.ui.PixelIconButton
import com.telefoninho.child.ui.PixelTextInput
import com.telefoninho.child.ui.PixelTheme
import com.telefoninho.child.ui.PixelTitle
import com.telefoninho.child.ui.PixelTrashButton
import com.telefoninho.child.ui.TelefoninhoFrame
import com.telefoninho.child.ui.relativeTime
import com.telefoninho.child.viewmodel.AppViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.util.concurrent.Executors

@Composable
fun TelefoninhoApp(viewModel: AppViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val screen by viewModel.screen.collectAsState()
    val error by viewModel.error.collectAsState()
    val pairingLoading by viewModel.pairingLoading.collectAsState()
    val apiBaseUrl by viewModel.apiBaseUrl.collectAsState()
    val sipStatus by viewModel.sipStatus.collectAsState()
    val contactQrPayload by viewModel.contactQrPayload.collectAsState()
    val contactInviteLoading by viewModel.contactInviteLoading.collectAsState()
    val speakerMode by viewModel.speakerMode.collectAsState()
    val ringtone by viewModel.ringtone.collectAsState()
    val theme by viewModel.theme.collectAsState()
    val alwaysOn by viewModel.alwaysOn.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val messagesLoading by viewModel.messagesLoading.collectAsState()
    val messageSending by viewModel.messageSending.collectAsState()
    var showServerSettings by remember { mutableStateOf(false) }

    LaunchedEffect(theme) {
        PixelTheme.applyPalette(theme)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = PixelTheme.bg) {
        if (showServerSettings) {
            ServerSettingsScreen(
                currentUrl = apiBaseUrl,
                canUnpair = uiState is UiState.Ready,
                onSave = {
                    viewModel.saveApiBaseUrl(it)
                    showServerSettings = false
                },
                onReset = {
                    viewModel.resetApiBaseUrl()
                    showServerSettings = false
                },
                onUnpair = {
                    viewModel.unpairDevice()
                    showServerSettings = false
                },
                onBack = { showServerSettings = false },
            )
        } else when (uiState) {
            UiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "CARREGANDO...", color = PixelTheme.fg,
                        fontSize = 20.sp, fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }

            is UiState.Pairing -> PairingScreen(
                error = error, loading = pairingLoading,
                onClaim = { viewModel.claimPairing(it) },
                onClearError = { viewModel.clearError() },
                onOpenServerSettings = { showServerSettings = true },
            )

            is UiState.Ready -> {
                val state = uiState as UiState.Ready
                AnimatedContent(
                    targetState = screen,
                    transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(120)) },
                    label = "screen",
                ) { current ->
                    when (current) {
                        Screen.Pairing -> PairingScreen(
                            error = error, loading = pairingLoading,
                            onClaim = { viewModel.claimPairing(it) },
                            onClearError = { viewModel.clearError() },
                            onOpenServerSettings = { showServerSettings = true },
                        )

                        is Screen.Home -> HomeScreen(
                            contacts = state.contacts,
                            sipStatus = sipStatus,
                            error = error,
                            onOpenSettings = { viewModel.openSettings() },
                            onOpenContacts = { viewModel.openContacts() },
                            onOpenMessages = { viewModel.openMessages() },
                            onCall = { viewModel.callExtension(it) },
                        )

                        Screen.Settings -> SettingsScreen(
                            speakerMode = speakerMode,
                            ringtone = ringtone,
                            theme = theme,
                            alwaysOn = alwaysOn,
                            error = error,
                            onOpenServerSettings = { showServerSettings = true },
                            onToggleSpeaker = { viewModel.setSpeakerMode(it) },
                            onRingtoneChange = { viewModel.setRingtone(it) },
                            onThemeChange = { viewModel.setTheme(it) },
                            onToggleAlwaysOn = { viewModel.setAlwaysOn(it) },
                            onRequestBatteryAccess = { viewModel.requestBatteryOptimizationExemption() },
                            onBack = { viewModel.closeSettings() },
                        )

                        Screen.Contacts -> ContactsScreen(
                            contacts = state.contacts,
                            error = error,
                            onCall = { viewModel.callContact(it) },
                            onOpenMyContact = { viewModel.openMyQr() },
                            onAddContact = { viewModel.openQrScanner() },
                            onBack = { viewModel.closeSettings() },
                        )

                        Screen.Messages -> MessagesScreen(
                            currentMemberId = state.profile.memberId,
                            contacts = state.contacts,
                            messages = messages,
                            loading = messagesLoading,
                            sending = messageSending,
                            error = error,
                            onRefresh = { viewModel.refreshMessages() },
                            onAutoRefresh = { viewModel.refreshMessages(showError = false) },
                            onSend = { contact, body, onSent ->
                                viewModel.sendMessage(contact, body, onSent)
                            },
                            onDelete = { viewModel.deleteMessage(it) },
                            onBack = { viewModel.closeSettings() },
                        )

                        Screen.Snake -> SnakeScreen(onBack = { viewModel.closeSnake() })

                        Screen.MyQr -> MyQrScreen(
                            payload = contactQrPayload,
                            loading = contactInviteLoading,
                            error = error,
                            onRefresh = { viewModel.generateContactInvite() },
                            onBack = { viewModel.closeMyQr() },
                        )

                        Screen.ScanQr -> ScanQrScreen(
                            error = error,
                            onResult = { rawValue -> viewModel.claimContactInviteFromQr(rawValue) },
                            onBack = { viewModel.closeQrScanner() },
                        )

                        is Screen.Calling -> CallingScreen(
                            contact = current.contact,
                            onHangup = { viewModel.hangup() },
                        )

                        is Screen.InCall -> ActiveCallScreen(
                            contact = current.contact,
                            onHangup = { viewModel.hangup() },
                        )

                        is Screen.Incoming -> IncomingCallScreen(
                            contact = current.contact,
                            onAccept = { viewModel.acceptCall() },
                            onDecline = { viewModel.declineCall() },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PairingScreen(
    error: String?,
    loading: Boolean,
    onClaim: (String) -> Unit,
    onClearError: () -> Unit,
    onOpenServerSettings: () -> Unit,
) {
    var code by remember { mutableStateOf("") }
    TelefoninhoFrame(status = "conectar", statusKind = CallStatus.Ready) {
        Spacer(modifier = Modifier.height(18.dp))
        PixelTitle(text = "TELEFONINHO")
        Spacer(modifier = Modifier.height(30.dp))
        PixelCard {
            Text(
                text = "CÓDIGO DOS PAIS", color = PixelTheme.fg,
                fontSize = 17.sp, fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(18.dp))
            CodeInput(value = code, onValueChange = {
                code = it.filter(Char::isDigit).take(6)
                onClearError()
            })
            Spacer(modifier = Modifier.height(18.dp))
            PixelButton(
                text = if (loading) "CONECTANDO..." else "LIGAR MEU TELEFONINHO",
                enabled = code.length == 6 && !loading,
                onClick = { onClaim(code) },
            )
            if (error != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = error, color = ComposeColor(0xFFC93F3F),
                    fontSize = 14.sp, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "SERVIDOR", onClick = onOpenServerSettings)
    }
}

@Composable
private fun HomeScreen(
    contacts: List<ContactInfo>,
    sipStatus: String,
    error: String?,
    onOpenSettings: () -> Unit,
    onOpenContacts: () -> Unit,
    onOpenMessages: () -> Unit,
    onCall: (String) -> Unit,
) {
    var extension by remember { mutableStateOf("") }
    val compact = LocalConfiguration.current.screenHeightDp < 840
    val gap = if (compact) 6.dp else 12.dp
    val keypadSize = if (compact) 52.dp else 64.dp
    val actionHeight = if (compact) 56.dp else 72.dp
    val statusKind = if (sipStatus == "SIP conectado") CallStatus.Ready else CallStatus.Calling
    TelefoninhoFrame(status = sipStatus, statusKind = statusKind) {
        PixelTitle(text = "TELEFONINHO")
        Spacer(modifier = Modifier.height(if (compact) 8.dp else 18.dp))
        PixelCard(contentPadding = if (compact) 10.dp else 16.dp) {
            Text(
                text = extension.ifBlank { "----" },
                color = PixelTheme.fg,
                fontSize = 34.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            if (contacts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(if (compact) 4.dp else 8.dp))
                Text(
                    text = "${contacts.size} CONTATOS",
                    color = PixelTheme.fg,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Spacer(modifier = Modifier.height(gap))
        if (error != null) {
            Text(
                text = error, color = ComposeColor(0xFFC93F3F),
                fontSize = 14.sp, fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(12.dp))
        }
        DialpadKeys(
            extension = extension,
            keySize = keypadSize,
            gap = gap,
            onExtensionChange = { extension = it },
        )
        PixelButton(
            text = "LIGAR",
            enabled = extension.isNotBlank(),
            height = actionHeight,
            onClick = { onCall(extension) },
        )
        if (contacts.isEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "NENHUM CONTATO",
                color = PixelTheme.fg,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(modifier = Modifier.height(gap))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap)) {
            Box(modifier = Modifier.weight(1f)) {
                PixelButton(text = "AGENDA", height = actionHeight, onClick = onOpenContacts)
            }
            PixelIconButton(text = "✉", size = actionHeight, onClick = onOpenMessages)
            Box(modifier = Modifier.weight(1f)) {
                PixelButton(text = "OPÇÕES", height = actionHeight, onClick = onOpenSettings)
            }
        }
    }
}

@Composable
private fun SnakeScreen(onBack: () -> Unit) {
    var game by remember { mutableStateOf(newSnakeGame()) }
    var requestedDirection by remember { mutableStateOf(SnakeDirection.Right) }
    val compact = LocalConfiguration.current.screenHeightDp < 840
    val controlSize = if (compact) 52.dp else 64.dp

    LaunchedEffect(Unit) {
        while (isActive) {
            delay((230L - game.score * 8L).coerceAtLeast(100L))
            if (!game.gameOver) {
                game = advanceSnake(game, requestedDirection)
            }
        }
    }

    TelefoninhoFrame(status = "ramal 67", statusKind = CallStatus.Ready) {
        PixelTitle(text = "COBRINHA")
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "PONTOS: ${game.score}",
            color = PixelTheme.fg,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
        )
        Spacer(modifier = Modifier.height(10.dp))
        SnakeBoard(game, compact)
        Spacer(modifier = Modifier.height(10.dp))
        if (game.gameOver) {
            Text(
                text = "FIM DE JOGO!",
                color = ComposeColor(0xFFC93F3F),
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            Spacer(modifier = Modifier.height(8.dp))
            PixelButton(
                text = "JOGAR DE NOVO",
                onClick = {
                    game = newSnakeGame()
                    requestedDirection = SnakeDirection.Right
                },
            )
        } else {
            PixelIconButton(
                text = "^",
                size = controlSize,
                onClick = { requestedDirection = SnakeDirection.Up },
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
            ) {
                PixelIconButton(
                    text = "<",
                    size = controlSize,
                    onClick = { requestedDirection = SnakeDirection.Left },
                )
                PixelIconButton(
                    text = "v",
                    size = controlSize,
                    onClick = { requestedDirection = SnakeDirection.Down },
                )
                PixelIconButton(
                    text = ">",
                    size = controlSize,
                    onClick = { requestedDirection = SnakeDirection.Right },
                )
            }
        }
        Spacer(modifier = Modifier.height(10.dp))
        PixelButton(
            text = "SAIR DO JOGO",
            height = if (compact) 56.dp else 72.dp,
            onClick = onBack,
        )
    }
}

@Composable
private fun SnakeBoard(game: SnakeGameState, compact: Boolean) {
    val gridColor = PixelTheme.fg.copy(alpha = 0.08f)
    val snakeColor = PixelTheme.accent
    val headColor = PixelTheme.fg
    val foodColor = ComposeColor(0xFFC93F3F)
    Box(
        modifier = Modifier.fillMaxWidth(if (compact) 0.68f else 0.92f)
            .aspectRatio(1f)
            .border(4.dp, PixelTheme.fg)
            .background(PixelTheme.surface)
            .padding(5.dp),
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cellWidth = size.width / game.width
            val cellHeight = size.height / game.height
            for (y in 0 until game.height) {
                for (x in 0 until game.width) {
                    if ((x + y) % 2 == 0) {
                        drawRect(
                            color = gridColor,
                            topLeft = Offset(x * cellWidth, y * cellHeight),
                            size = Size(cellWidth, cellHeight),
                        )
                    }
                }
            }
            val inset = 1.5.dp.toPx()
            game.snake.forEachIndexed { index, point ->
                drawRect(
                    color = if (index == 0) headColor else snakeColor,
                    topLeft = Offset(point.x * cellWidth + inset, point.y * cellHeight + inset),
                    size = Size(cellWidth - inset * 2, cellHeight - inset * 2),
                )
            }
            drawRect(
                color = foodColor,
                topLeft = Offset(game.food.x * cellWidth + inset, game.food.y * cellHeight + inset),
                size = Size(cellWidth - inset * 2, cellHeight - inset * 2),
            )
            drawRect(
                color = headColor,
                topLeft = Offset(
                    game.food.x * cellWidth + cellWidth * 0.52f,
                    game.food.y * cellHeight,
                ),
                size = Size(cellWidth * 0.18f, cellHeight * 0.24f),
            )
        }
    }
}

@Composable
private fun MessagesScreen(
    currentMemberId: String,
    contacts: List<ContactInfo>,
    messages: List<ShortMessage>,
    loading: Boolean,
    sending: Boolean,
    error: String?,
    onRefresh: () -> Unit,
    onAutoRefresh: () -> Unit,
    onSend: (ContactInfo, String, () -> Unit) -> Unit,
    onDelete: (String) -> Unit,
    onBack: () -> Unit,
) {
    val enabledContacts = contacts.filter { it.enabled && it.memberId.isNotBlank() }
    var selectedIndex by remember(enabledContacts.size) { mutableIntStateOf(0) }
    var messageBody by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        while (isActive) {
            delay(15_000)
            onAutoRefresh()
        }
    }

    TelefoninhoFrame(status = "correio", statusKind = CallStatus.Ready) {
        PixelTitle(text = "CORREIO")
        Spacer(modifier = Modifier.height(18.dp))
        PixelCard {
            if (enabledContacts.isEmpty()) {
                Text(
                    text = "NENHUM CONTATO LIBERADO",
                    color = PixelTheme.fg,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            } else {
                val selected = enabledContacts[selectedIndex.coerceAtMost(enabledContacts.lastIndex)]
                PixelButton(
                    text = "PARA: ${selected.displayName.uppercase()}",
                    onClick = { selectedIndex = (selectedIndex + 1) % enabledContacts.size },
                )
                Spacer(modifier = Modifier.height(12.dp))
                PixelTextInput(
                    value = messageBody,
                    onValueChange = { messageBody = it.take(160) },
                    placeholder = "ESCREVA UMA MENSAGEM",
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "${messageBody.length}/160",
                    color = PixelTheme.fg,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.End,
                )
                Spacer(modifier = Modifier.height(8.dp))
                PixelButton(
                    text = if (sending) "ENVIANDO..." else "ENVIAR",
                    enabled = messageBody.isNotBlank() && !sending,
                    onClick = {
                        onSend(selected, messageBody) { messageBody = "" }
                    },
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = if (loading) "ATUALIZANDO..." else "ATUALIZAR", enabled = !loading, onClick = onRefresh)
        if (error != null) {
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = error,
                color = ComposeColor(0xFFC93F3F),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        if (!loading && messages.isEmpty()) {
            Text(
                text = "CAIXA VAZIA",
                color = PixelTheme.fg,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        messages.forEach { message ->
            val sentByMe = message.fromMemberId == currentMemberId
            val cardBackground = if (sentByMe) PixelTheme.panel else PixelTheme.surface
            val cardBorder = if (sentByMe) PixelTheme.fg else PixelTheme.accent
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = if (sentByMe) 28.dp else 0.dp, end = if (sentByMe) 0.dp else 28.dp)
                    .border(4.dp, cardBorder)
                    .background(cardBackground)
                    .padding(14.dp),
                horizontalAlignment = if (sentByMe) Alignment.End else Alignment.Start,
            ) {
                Text(
                    text = if (sentByMe) "ENVIADA  ›  PARA ${message.toDisplayName.uppercase()}" else "RECEBIDA  ‹  DE ${message.fromDisplayName.uppercase()}",
                    color = if (sentByMe) PixelTheme.fg else PixelTheme.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = if (sentByMe) TextAlign.End else TextAlign.Start,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = message.body,
                    color = PixelTheme.fg,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = relativeTime(message.createdAt),
                        color = PixelTheme.fg.copy(alpha = 0.65f),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                    )
                    PixelTrashButton(onClick = { onDelete(message.id) })
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

@Composable
private fun DialpadKeys(
    extension: String,
    keySize: Dp = 64.dp,
    gap: Dp = 12.dp,
    onExtensionChange: (String) -> Unit,
) {
    listOf("123", "456", "789", "<0#").forEach { row ->
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(gap, Alignment.CenterHorizontally),
        ) {
            row.forEach { digit ->
                PixelIconButton(
                    text = digit.toString(),
                    size = keySize,
                    onClick = {
                        if (digit == '<') {
                            onExtensionChange(extension.dropLast(1))
                        } else if (extension.length < 8) {
                            onExtensionChange(extension + digit)
                        }
                    },
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
    }
}

@Composable
private fun SettingsScreen(
    speakerMode: Boolean,
    ringtone: String,
    theme: String,
    alwaysOn: Boolean,
    error: String?,
    onOpenServerSettings: () -> Unit,
    onToggleSpeaker: (Boolean) -> Unit,
    onRingtoneChange: (String) -> Unit,
    onThemeChange: (String) -> Unit,
    onToggleAlwaysOn: (Boolean) -> Unit,
    onRequestBatteryAccess: () -> Unit,
    onBack: () -> Unit,
) {
    var previewingRingtone by remember { mutableStateOf(false) }
    LaunchedEffect(previewingRingtone, ringtone) {
        if (!previewingRingtone) return@LaunchedEffect
        val toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        try {
            while (isActive) {
                playRingtonePattern(toneGenerator, ringtone)
                delay(700)
            }
        } finally {
            toneGenerator.stopTone()
            toneGenerator.release()
        }
    }

    TelefoninhoFrame(status = "opções", statusKind = CallStatus.Ready) {
        PixelTitle(text = "OPÇÕES")
        Spacer(modifier = Modifier.height(18.dp))
        if (error != null) {
            Text(
                text = error,
                color = if (error.contains("atualizado", ignoreCase = true) ||
                    error.contains("adicionado", ignoreCase = true)
                ) {
                    PixelTheme.fg
                } else {
                    ComposeColor(0xFFC93F3F)
                },
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(12.dp))
        }
        PixelButton(text = "SERVIDOR", onClick = onOpenServerSettings)
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(
            text = if (alwaysOn) "SEMPRE LIGADO: SIM" else "SEMPRE LIGADO: NAO",
            onClick = { onToggleAlwaysOn(!alwaysOn) },
        )
        if (alwaysOn) {
            Spacer(modifier = Modifier.height(12.dp))
            PixelButton(text = "LIBERAR BATERIA", onClick = onRequestBatteryAccess)
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(
            text = if (speakerMode) "ÁUDIO: SPEAKER" else "ÁUDIO: FONE",
            onClick = { onToggleSpeaker(!speakerMode) },
        )
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(modifier = Modifier.weight(1f)) {
                PixelButton(
                    text = "TOQUE: ${ringtoneLabel(ringtone)}",
                    onClick = { onRingtoneChange(nextRingtone(ringtone)) },
                )
            }
            PixelIconButton(
                text = if (previewingRingtone) "II" else ">",
                onClick = { previewingRingtone = !previewingRingtone },
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(
            text = "THEME: ${themeLabel(theme)}",
            onClick = { onThemeChange(nextTheme(theme)) },
        )
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

private suspend fun playRingtonePattern(toneGenerator: ToneGenerator, option: String) {
    val pattern = when (option) {
        "COIN" -> listOf(
            RingtoneStep(ToneGenerator.TONE_DTMF_5, 70),
            RingtoneStep(null, 35),
            RingtoneStep(ToneGenerator.TONE_DTMF_8, 70),
            RingtoneStep(null, 35),
            RingtoneStep(ToneGenerator.TONE_DTMF_9, 150),
            RingtoneStep(null, 120),
            RingtoneStep(ToneGenerator.TONE_DTMF_9, 80),
            RingtoneStep(null, 35),
            RingtoneStep(ToneGenerator.TONE_DTMF_0, 180),
        )
        "LASER" -> listOf(
            RingtoneStep(ToneGenerator.TONE_DTMF_9, 90),
            RingtoneStep(null, 25),
            RingtoneStep(ToneGenerator.TONE_DTMF_6, 90),
            RingtoneStep(null, 25),
            RingtoneStep(ToneGenerator.TONE_DTMF_3, 90),
            RingtoneStep(null, 25),
            RingtoneStep(ToneGenerator.TONE_DTMF_1, 210),
            RingtoneStep(null, 180),
            RingtoneStep(ToneGenerator.TONE_PROP_NACK, 180),
        )
        else -> listOf(
            RingtoneStep(ToneGenerator.TONE_PROP_BEEP, 220),
            RingtoneStep(null, 160),
            RingtoneStep(ToneGenerator.TONE_PROP_BEEP, 220),
            RingtoneStep(null, 420),
        )
    }
    pattern.forEach { step ->
        if (step.tone != null) {
            toneGenerator.startTone(step.tone, step.durationMs)
        }
        delay(step.durationMs.toLong())
    }
}

private data class RingtoneStep(val tone: Int?, val durationMs: Int)

private fun ringtoneLabel(value: String): String = when (value) {
    "COIN" -> "COIN"
    "LASER" -> "LASER"
    else -> "BEEP"
}

private fun nextRingtone(value: String): String = when (value) {
    "BEEP" -> "COIN"
    "COIN" -> "LASER"
    else -> "BEEP"
}

private fun themeLabel(value: String): String = when (value) {
    "squirtle" -> "SQUIRTLE"
    "charmander" -> "CHARMANDER"
    else -> "BULBASSAURO"
}

private fun nextTheme(value: String): String = when (value) {
    "bulbassauro" -> "squirtle"
    "squirtle" -> "charmander"
    else -> "bulbassauro"
}

@Composable
private fun ContactsScreen(
    contacts: List<ContactInfo>,
    error: String?,
    onCall: (ContactInfo) -> Unit,
    onOpenMyContact: () -> Unit,
    onAddContact: () -> Unit,
    onBack: () -> Unit,
) {
    var page by remember(contacts) { mutableIntStateOf(0) }
    val pageSize = 4
    val pageCount = maxOf(1, (contacts.size + pageSize - 1) / pageSize)
    val visibleContacts = contacts.drop(page * pageSize).take(pageSize)

    TelefoninhoFrame(status = "contatos", statusKind = CallStatus.Ready) {
        PixelTitle(text = "AGENDA")
        Spacer(modifier = Modifier.height(18.dp))
        ContactTools(onOpenMyContact = onOpenMyContact, onAddContact = onAddContact)
        Spacer(modifier = Modifier.height(12.dp))
        if (error != null) {
            Text(
                text = error,
                color = ComposeColor(0xFFC93F3F),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(12.dp))
        }
        if (visibleContacts.isEmpty()) {
            Text(
                text = "SEM CONTATOS",
                color = PixelTheme.fg,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
            )
        } else {
            ContactGrid(contacts = visibleContacts, onCall = onCall)
        }
        if (pageCount > 1) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "${page + 1}/$pageCount",
                color = PixelTheme.fg,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(modifier = Modifier.weight(1f)) {
                    PixelButton(text = "ANT", enabled = page > 0, onClick = { page -= 1 })
                }
                Box(modifier = Modifier.weight(1f)) {
                    PixelButton(text = "PROX", enabled = page < pageCount - 1, onClick = { page += 1 })
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

@Composable
private fun ContactTools(onOpenMyContact: () -> Unit, onAddContact: () -> Unit) {
    val context = LocalContext.current
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) onAddContact()
    }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(modifier = Modifier.weight(1f)) {
            PixelButton(text = "MEU CONTATO", onClick = onOpenMyContact)
        }
        Box(modifier = Modifier.weight(1f)) {
            PixelButton(
                text = "ADD CONTATO",
                onClick = {
                    if (ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.CAMERA,
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        onAddContact()
                    } else {
                        cameraLauncher.launch(Manifest.permission.CAMERA)
                    }
                },
            )
        }
    }
}

@Composable
private fun ScanQrScreen(
    error: String?,
    onResult: (String) -> Unit,
    onBack: () -> Unit,
) {
    TelefoninhoFrame(status = "ler qr", statusKind = CallStatus.Ready) {
        PixelTitle(text = "LER QR")
        Spacer(modifier = Modifier.height(18.dp))
        PixelCard {
            QrCameraPreview(onResult = onResult)
            if (error != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = error,
                    color = ComposeColor(0xFFC93F3F),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

@Composable
private fun QrCameraPreview(onResult: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) {
        onDispose { executor.shutdown() }
    }

    AndroidView(
        factory = { viewContext ->
            val previewView = PreviewView(viewContext)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(viewContext)

            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()
                val scanner = BarcodeScanning.getClient()
                var handled = false
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also {
                        it.setAnalyzer(executor) { imageProxy ->
                            analyzeQrFrame(
                                imageProxy = imageProxy,
                                scanner = scanner,
                                alreadyHandled = handled,
                                onHandled = { handled = true },
                                onResult = {
                                    onResult(it)
                                    cameraProvider.unbindAll()
                                    scanner.close()
                                },
                            )
                        }
                    }

                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analysis,
                )
            }, ContextCompat.getMainExecutor(context))

            previewView
        },
        modifier = Modifier.fillMaxWidth().height(280.dp),
    )
}

@androidx.annotation.OptIn(
    markerClass = [androidx.camera.core.ExperimentalGetImage::class],
)
private fun analyzeQrFrame(
    imageProxy: ImageProxy,
    scanner: BarcodeScanner,
    alreadyHandled: Boolean,
    onHandled: () -> Unit,
    onResult: (String) -> Unit,
) {
    val mediaImage = imageProxy.image
    if (mediaImage == null || alreadyHandled) {
        imageProxy.close()
        return
    }

    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    scanner.process(image)
        .addOnSuccessListener { barcodes ->
            val rawValue = barcodes.firstOrNull()?.rawValue
            if (rawValue != null) {
                onHandled()
                onResult(rawValue)
            }
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}

@Composable
private fun MyQrScreen(
    payload: String?,
    loading: Boolean,
    error: String?,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
) {
    TelefoninhoFrame(status = "convite", statusKind = CallStatus.Ready) {
        PixelTitle(text = "MEU QR")
        Spacer(modifier = Modifier.height(22.dp))
        PixelCard {
            if (payload == null || loading) {
                Text(
                    text = "GERANDO QR...", color = PixelTheme.fg,
                    fontSize = 18.sp, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            } else {
                val bitmap = remember(payload) { createQrBitmap(payload) }
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "QR de convite de contato",
                    modifier = Modifier.size(248.dp),
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "MOSTRE PARA ADICIONAR",
                    color = PixelTheme.fg,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            }
            if (error != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = error,
                    color = ComposeColor(0xFFC93F3F),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "NOVO QR", enabled = !loading, onClick = onRefresh)
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

private fun createQrBitmap(payload: String): Bitmap {
    val size = 512
    val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, size, size)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
    for (x in 0 until size) {
        for (y in 0 until size) {
            bitmap.setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
        }
    }
    return bitmap
}

@Composable
private fun ServerSettingsScreen(
    currentUrl: String,
    canUnpair: Boolean,
    onSave: (String) -> Unit,
    onReset: () -> Unit,
    onUnpair: () -> Unit,
    onBack: () -> Unit,
) {
    var value by remember(currentUrl) { mutableStateOf(currentUrl) }
    val normalized = value.trim().trimEnd('/')
    val valid = normalized.startsWith("http://") || normalized.startsWith("https://")

    TelefoninhoFrame(status = "config", statusKind = CallStatus.Ready) {
        PixelTitle(text = "SERVIDOR")
        Spacer(modifier = Modifier.height(22.dp))
        PixelCard {
            Text(
                text = "ENDERECO DA API",
                color = PixelTheme.fg,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(14.dp))
            PixelTextInput(
                value = value,
                onValueChange = { value = it },
                placeholder = "http://bore.pub:12345",
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Atual: $currentUrl",
                color = PixelTheme.fg,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            if (!valid) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Use http:// ou https://",
                    color = ComposeColor(0xFFC93F3F),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "SALVAR", enabled = valid, onClick = { onSave(normalized) })
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "PADRAO", danger = true, onClick = onReset)
        if (canUnpair) {
            Spacer(modifier = Modifier.height(12.dp))
            PixelButton(text = "DESPAREAR", danger = true, onClick = onUnpair)
        }
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

@Composable
private fun CallingScreen(contact: ContactInfo, onHangup: () -> Unit) {
    TelefoninhoFrame(status = "chamando", statusKind = CallStatus.Calling) {
        BigContactHero(contact = contact, label = "LIGANDO PARA")
        Spacer(modifier = Modifier.height(18.dp))
        Bips()
        Spacer(modifier = Modifier.height(28.dp))
        PixelButton(text = "DESLIGAR", danger = true, onClick = onHangup)
    }
}

@Composable
private fun IncomingCallScreen(contact: ContactInfo, onAccept: () -> Unit, onDecline: () -> Unit) {
    TelefoninhoFrame(status = "tocando", statusKind = CallStatus.Ringing) {
        BigContactHero(contact = contact, label = "ESTA LIGANDO")
        Spacer(modifier = Modifier.height(24.dp))
        PixelButton(text = "ATENDER", onClick = onAccept)
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "AGORA NÃO", danger = true, onClick = onDecline)
    }
}

@Composable
private fun ActiveCallScreen(contact: ContactInfo, onHangup: () -> Unit) {
    var seconds by remember { mutableIntStateOf(0) }
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
