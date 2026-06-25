package com.telefoninho.child

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.SideEffect
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.telefoninho.child.data.UiState
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
import com.telefoninho.child.ui.TelefoninhoFrame
import com.telefoninho.child.viewmodel.AppViewModel
import kotlinx.coroutines.delay
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
    var showServerSettings by remember { mutableStateOf(false) }

    SideEffect {
        PixelTheme.applyPalette(theme)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = PixelTheme.bg) {
        if (showServerSettings) {
            ServerSettingsScreen(
                currentUrl = apiBaseUrl,
                onSave = {
                    viewModel.saveApiBaseUrl(it)
                    showServerSettings = false
                },
                onReset = {
                    viewModel.resetApiBaseUrl()
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
                            onCall = { viewModel.callExtension(it) },
                        )

                        Screen.Settings -> SettingsScreen(
                            speakerMode = speakerMode,
                            ringtone = ringtone,
                            theme = theme,
                            error = error,
                            onOpenServerSettings = { showServerSettings = true },
                            onToggleSpeaker = { viewModel.setSpeakerMode(it) },
                            onRingtoneChange = { viewModel.setRingtone(it) },
                            onThemeChange = { viewModel.setTheme(it) },
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
                text = "CODIGO DOS PAIS", color = PixelTheme.fg,
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
    onCall: (String) -> Unit,
) {
    var extension by remember { mutableStateOf("") }
    val statusKind = if (sipStatus == "SIP conectado") CallStatus.Ready else CallStatus.Calling
    TelefoninhoFrame(status = sipStatus, statusKind = statusKind) {
        PixelTitle(text = "TELEFONINHO")
        Spacer(modifier = Modifier.height(18.dp))
        PixelCard {
            Text(
                text = extension.ifBlank { "----" },
                color = PixelTheme.fg,
                fontSize = 34.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            if (contacts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "${contacts.size} CONTATOS",
                    color = PixelTheme.fg,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
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
            onExtensionChange = { extension = it },
        )
        PixelButton(text = "LIGAR", enabled = extension.isNotBlank(), onClick = { onCall(extension) })
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
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(modifier = Modifier.weight(1f)) {
                PixelButton(text = "AGENDA", onClick = onOpenContacts)
            }
            Box(modifier = Modifier.weight(1f)) {
                PixelButton(text = "OPCOES", onClick = onOpenSettings)
            }
        }
    }
}

@Composable
private fun DialpadKeys(extension: String, onExtensionChange: (String) -> Unit) {
    listOf("123", "456", "789", "<0#").forEach { row ->
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        ) {
            row.forEach { digit ->
                PixelIconButton(
                    text = digit.toString(),
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
    error: String?,
    onOpenServerSettings: () -> Unit,
    onToggleSpeaker: (Boolean) -> Unit,
    onRingtoneChange: (String) -> Unit,
    onThemeChange: (String) -> Unit,
    onBack: () -> Unit,
) {
    TelefoninhoFrame(status = "opcoes", statusKind = CallStatus.Ready) {
        PixelTitle(text = "OPCOES")
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
            text = if (speakerMode) "AUDIO: SPEAKER" else "AUDIO: FONE",
            onClick = { onToggleSpeaker(!speakerMode) },
        )
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(
            text = "RING: ${ringtoneLabel(ringtone)}",
            onClick = { onRingtoneChange(nextRingtone(ringtone)) },
        )
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(
            text = "THEME: ${themeLabel(theme)}",
            onClick = { onThemeChange(nextTheme(theme)) },
        )
        Spacer(modifier = Modifier.height(12.dp))
        PixelButton(text = "VOLTAR", onClick = onBack)
    }
}

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
    onSave: (String) -> Unit,
    onReset: () -> Unit,
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
        PixelButton(text = "AGORA NAO", danger = true, onClick = onDecline)
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
