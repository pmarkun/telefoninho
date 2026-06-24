package com.telefoninho.child

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
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
import com.telefoninho.child.ui.PixelTheme
import com.telefoninho.child.ui.PixelTitle
import com.telefoninho.child.ui.TelefoninhoFrame
import com.telefoninho.child.viewmodel.AppViewModel
import kotlinx.coroutines.delay

@Composable
fun TelefoninhoApp(viewModel: AppViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val screen by viewModel.screen.collectAsState()
    val error by viewModel.error.collectAsState()
    val pairingLoading by viewModel.pairingLoading.collectAsState()

    Surface(modifier = Modifier.fillMaxSize(), color = PixelTheme.bg) {
        when (uiState) {
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
                        )

                        is Screen.Home -> HomeScreen(
                            contacts = state.contacts,
                            onCall = { viewModel.callContact(it) },
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
private fun PairingScreen(error: String?, loading: Boolean, onClaim: (String) -> Unit, onClearError: () -> Unit) {
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
                    text = error, color = Color(0xFFC93F3F),
                    fontSize = 14.sp, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun HomeScreen(contacts: List<ContactInfo>, onCall: (ContactInfo) -> Unit) {
    TelefoninhoFrame(status = "pronto", statusKind = CallStatus.Ready) {
        PixelTitle(text = "TELEFONINHO")
        Spacer(modifier = Modifier.height(22.dp))
        if (contacts.isEmpty()) {
            Text(
                text = "NENHUM CONTATO APROVADO", color = PixelTheme.fg,
                fontSize = 18.sp, fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
            )
        } else {
            ContactGrid(contacts = contacts, onCall = onCall)
        }
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
