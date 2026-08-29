package com.telefoninho.child.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.telefoninho.child.data.ApiClient
import com.telefoninho.child.data.AppConfig
import com.telefoninho.child.data.ConfigStore
import com.telefoninho.child.data.ContactInfo
import com.telefoninho.child.data.Screen
import com.telefoninho.child.data.SipCredentials
import com.telefoninho.child.data.UiState
import com.telefoninho.child.special.JokeSpecialService
import com.telefoninho.child.special.SpecialDialService
import com.telefoninho.child.special.SpecialDialServiceRegistry
import com.telefoninho.child.special.WeatherSpecialService
import com.telefoninho.child.voip.VoipForegroundService
import com.telefoninho.child.voip.VoipListener
import com.telefoninho.child.voip.VoipSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.json.JSONTokener

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val configStore = ConfigStore(application)
    private val specialDialServices = SpecialDialServiceRegistry(
        listOf(
            WeatherSpecialService(application),
            JokeSpecialService(application),
        ),
    )

    private val _uiState = MutableStateFlow<UiState>(UiState.Pairing)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _screen = MutableStateFlow<Screen>(Screen.Pairing)
    val screen: StateFlow<Screen> = _screen.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _pairingLoading = MutableStateFlow(false)
    val pairingLoading: StateFlow<Boolean> = _pairingLoading.asStateFlow()

    private val _apiBaseUrl = MutableStateFlow("")
    val apiBaseUrl: StateFlow<String> = _apiBaseUrl.asStateFlow()

    private val _sipStatus = MutableStateFlow("SIP conectando")
    val sipStatus: StateFlow<String> = _sipStatus.asStateFlow()

    private val _contactQrPayload = MutableStateFlow<String?>(null)
    val contactQrPayload: StateFlow<String?> = _contactQrPayload.asStateFlow()

    private val _contactInviteLoading = MutableStateFlow(false)
    val contactInviteLoading: StateFlow<Boolean> = _contactInviteLoading.asStateFlow()

    private val _refreshContactsLoading = MutableStateFlow(false)
    val refreshContactsLoading: StateFlow<Boolean> = _refreshContactsLoading.asStateFlow()

    private val _speakerMode = MutableStateFlow(true)
    val speakerMode: StateFlow<Boolean> = _speakerMode.asStateFlow()

    private val _ringtone = MutableStateFlow("BEEP")
    val ringtone: StateFlow<String> = _ringtone.asStateFlow()

    private val _theme = MutableStateFlow("bulbassauro")
    val theme: StateFlow<String> = _theme.asStateFlow()

    private var sipCredentials: SipCredentials? = null
    private var activeSpecialService: SpecialDialService? = null

    private val voipListener = object : VoipListener {
        override fun onRegistered() {
            _sipStatus.value = "SIP conectado"
            _error.value = null
        }

        override fun onUnregistered() {
            _sipStatus.value = "SIP desconectado"
        }

        override fun onRegistrationFailed(reason: String) {
            _sipStatus.value = "SIP falhou"
            _error.value = "Falha ao registrar SIP: $reason"
        }

        override fun onCallReceived(callerExtension: String) {
            val contacts = (_uiState.value as? UiState.Ready)?.contacts ?: return
            val caller = contacts.find { it.sipExtension == callerExtension }
            val contact = caller ?: ContactInfo(
                memberId = "", displayName = callerExtension,
                avatarKey = "star_pixel_01", colorKey = "green",
                sipExtension = callerExtension, enabled = true,
            )
            _screen.value = Screen.Incoming(contact)
        }

        override fun onCallConnected() {
            val current = _screen.value
            _screen.value = when (current) {
                is Screen.Calling -> Screen.InCall(current.contact)
                is Screen.Incoming -> Screen.InCall(current.contact)
                else -> current
            }
        }

        override fun onCallEnded() {
            _screen.value = Screen.Home
        }

        override fun onCallFailed(reason: String) {
            _error.value = "Chamada falhou: $reason"
            _screen.value = Screen.Home
        }
    }

    init {
        VoipSession.addListener(voipListener)
        observeApiBaseUrl()
        observeSpeakerMode()
        observeRingtone()
        observeTheme()
        checkPaired()
    }

    private fun observeApiBaseUrl() {
        viewModelScope.launch {
            configStore.apiBaseUrl.collect { _apiBaseUrl.value = it }
        }
    }

    private fun observeSpeakerMode() {
        viewModelScope.launch {
            configStore.speakerMode.collect {
                _speakerMode.value = it
                VoipSession.setSpeakerMode(it)
            }
        }
    }

    private fun observeRingtone() {
        viewModelScope.launch {
            configStore.ringtone.collect { _ringtone.value = it }
        }
    }

    private fun observeTheme() {
        viewModelScope.launch {
            configStore.theme.collect { _theme.value = it }
        }
    }

    private fun checkPaired() {
        viewModelScope.launch {
            val isPaired = configStore.isPaired.first()
            if (isPaired) {
                val config = configStore.loadConfig()
                if (config != null) {
                    sipCredentials = config.sip
                    _uiState.value = UiState.Ready(config.profile, config.contacts)
                    _screen.value = Screen.Home
                    _sipStatus.value = "SIP conectando"
                    VoipSession.start(getApplication(), config.sip)
                    VoipForegroundService.start(getApplication())
                } else {
                    _uiState.value = UiState.Pairing
                }
            } else {
                _uiState.value = UiState.Pairing
            }
        }
    }

    fun claimPairing(code: String) {
        if (_pairingLoading.value) return
        _pairingLoading.value = true
        _error.value = null

        viewModelScope.launch {
            try {
                val deviceName = android.os.Build.MODEL
                val deviceId = android.os.Build.DEVICE
                val baseUrl = configStore.apiBaseUrl.first()
                val response = ApiClient(baseUrl).claimPairing(code, deviceName, deviceId)

                val config = AppConfig(
                    token = response.token,
                    profile = response.profile,
                    sip = response.sip,
                    contacts = response.contacts,
                    settings = response.settings,
                )

                configStore.saveConfig(config)
                sipCredentials = config.sip

                _uiState.value = UiState.Ready(config.profile, config.contacts)
                _screen.value = Screen.Home

                _sipStatus.value = "SIP conectando"
                VoipSession.start(getApplication(), config.sip)
                VoipForegroundService.start(getApplication())
            } catch (e: Exception) {
                _error.value = e.message ?: "Erro de conexão"
            } finally {
                _pairingLoading.value = false
            }
        }
    }

    fun openSettings() {
        _screen.value = Screen.Settings
    }

    fun closeSettings() {
        _screen.value = Screen.Home
    }

    fun openContacts() {
        _screen.value = Screen.Contacts
    }

    fun callContact(contact: ContactInfo) {
        if (!contact.enabled) {
            _error.value = "Contato ainda nao aprovado"
            return
        }
        if (contact.sipExtension.isBlank()) {
            _error.value = "Contato sem ramal SIP"
            return
        }
        _screen.value = Screen.Calling(contact)
        VoipSession.call(contact.sipExtension)
    }

    fun callExtension(extension: String) {
        val normalizedExtension = extension.trim()
        if (normalizedExtension.isBlank()) {
            _error.value = "Digite um ramal"
            return
        }
        val specialService = specialDialServices.find(normalizedExtension)
        if (specialService != null) {
            startSpecialDialService(specialService)
            return
        }
        _screen.value = Screen.Calling(
            ContactInfo(
                memberId = "",
                displayName = normalizedExtension,
                avatarKey = "dialpad",
                colorKey = "blue",
                sipExtension = normalizedExtension,
                enabled = true,
            ),
        )
        VoipSession.call(normalizedExtension)
    }

    private fun startSpecialDialService(service: SpecialDialService) {
        activeSpecialService?.stop()
        activeSpecialService = service
        _error.value = null
        _screen.value = Screen.Calling(service.contact())
        service.start(
            scope = viewModelScope,
            onFinished = {
                if (activeSpecialService === service) {
                    activeSpecialService = null
                    _screen.value = Screen.Home
                }
            },
            onError = { message ->
                if (activeSpecialService === service) {
                    activeSpecialService = null
                    _error.value = message
                    _screen.value = Screen.Home
                }
            },
        )
    }

    fun openMyQr() {
        _screen.value = Screen.MyQr
        if (_contactQrPayload.value == null) {
            generateContactInvite()
        }
    }

    fun closeMyQr() {
        _screen.value = Screen.Home
    }

    fun openQrScanner() {
        _screen.value = Screen.ScanQr
    }

    fun closeQrScanner() {
        _screen.value = Screen.Home
    }

    fun generateContactInvite() {
        val profile = (_uiState.value as? UiState.Ready)?.profile ?: return
        if (_contactInviteLoading.value) return

        _contactInviteLoading.value = true
        _error.value = null
        viewModelScope.launch {
            try {
                val baseUrl = configStore.apiBaseUrl.first()
                val authToken = configStore.loadConfig()?.token ?: error("Telefone nao pareado")
                val response = ApiClient(baseUrl).generateContactInvite(profile.memberId, authToken)
                _contactQrPayload.value = response.qrPayload
            } catch (e: Exception) {
                _error.value = e.message ?: "Erro ao gerar QR"
            } finally {
                _contactInviteLoading.value = false
            }
        }
    }

    fun claimContactInviteFromQr(rawValue: String) {
        val profile = (_uiState.value as? UiState.Ready)?.profile ?: return
        viewModelScope.launch {
            try {
                val payload = parseContactQrPayload(rawValue)
                if (
                    payload.optString("type") != "telefoninho-contact" ||
                    payload.optInt("version") != 1
                ) {
                    _error.value = "QR nao e convite do Telefoninho"
                    return@launch
                }

                val baseUrl = configStore.apiBaseUrl.first()
                val authToken = configStore.loadConfig()?.token ?: error("Telefone nao pareado")
                val status = ApiClient(baseUrl).claimContactInvite(
                    token = payload.getString("token"),
                    requesterMemberId = profile.memberId,
                    authToken = authToken,
                )
                if (status == "auto_approved") {
                    refreshContactsAfterInvite()
                } else {
                    _error.value = "Pedido enviado aos pais"
                }
                _screen.value = Screen.Home
            } catch (e: Exception) {
                _error.value = e.message ?: "Erro ao ler QR"
            }
        }
    }

    private fun parseContactQrPayload(rawValue: String): JSONObject {
        val parsedValue = JSONTokener(rawValue).nextValue()
        val parsed = when (parsedValue) {
            is JSONObject -> parsedValue
            is String -> JSONObject(parsedValue)
            else -> throw IllegalArgumentException("QR nao e convite do Telefoninho")
        }
        val stringified = parsed.optString("qrPayload").takeIf { it.isNotBlank() }
            ?: parsed.optString("payload").takeIf { it.isNotBlank() }
        return if (stringified != null) JSONObject(stringified) else parsed
    }

    fun refreshContacts() {
        if (_refreshContactsLoading.value) return
        _refreshContactsLoading.value = true
        _error.value = null
        viewModelScope.launch {
            try {
                refreshContactsFromServer()
                _error.value = "Contatos atualizados"
            } catch (e: Exception) {
                _error.value = e.message ?: "Erro ao atualizar contatos"
            } finally {
                _refreshContactsLoading.value = false
            }
        }
    }

    fun setSpeakerMode(enabled: Boolean) {
        viewModelScope.launch {
            configStore.saveSpeakerMode(enabled)
        }
    }

    fun setRingtone(value: String) {
        viewModelScope.launch {
            configStore.saveRingtone(value)
        }
    }

    fun setTheme(value: String) {
        viewModelScope.launch {
            configStore.saveTheme(value)
        }
    }

    fun acceptCall() {
        VoipSession.acceptCall()
    }

    fun declineCall() {
        VoipSession.declineCall()
        _screen.value = Screen.Home
    }

    fun hangup() {
        val specialService = activeSpecialService
        if (specialService != null) {
            activeSpecialService = null
            specialService.stop()
            _screen.value = Screen.Home
            return
        }
        _screen.value = Screen.Home
        VoipSession.hangup()
    }

    fun clearError() {
        _error.value = null
    }

    fun saveApiBaseUrl(value: String) {
        viewModelScope.launch {
            configStore.saveApiBaseUrl(value)
            _error.value = null
        }
    }

    fun resetApiBaseUrl() {
        viewModelScope.launch {
            configStore.resetApiBaseUrl()
            _error.value = null
        }
    }

    fun unpairDevice() {
        activeSpecialService?.stop()
        activeSpecialService = null
        VoipSession.stop()
        VoipForegroundService.stop(getApplication())
        sipCredentials = null
        _contactQrPayload.value = null
        _error.value = null
        _sipStatus.value = "SIP desconectado"
        _screen.value = Screen.Pairing
        _uiState.value = UiState.Pairing
        viewModelScope.launch {
            configStore.clearPairing()
        }
    }

    private suspend fun refreshContactsAfterInvite() {
        try {
            refreshContactsFromServer()
            _error.value = "Contato adicionado"
        } catch (_: Exception) {
            _error.value = "Contato adicionado. Atualize contatos."
        }
    }

    private suspend fun refreshContactsFromServer() {
        val currentConfig = configStore.loadConfig()
            ?: throw IllegalStateException("Config local ausente")
        val token = currentConfig.token
            ?: throw IllegalStateException("Repareie este aparelho para atualizar contatos")
        val baseUrl = configStore.apiBaseUrl.first()
        val response = ApiClient(baseUrl).getChildConfig(token)
        val updatedConfig = AppConfig(
            token = token,
            profile = response.profile,
            sip = response.sip,
            contacts = response.contacts,
            settings = response.settings,
        )
        configStore.saveConfig(updatedConfig)
        sipCredentials = updatedConfig.sip
        _uiState.value = UiState.Ready(updatedConfig.profile, updatedConfig.contacts)
    }

    override fun onCleared() {
        super.onCleared()
        activeSpecialService?.stop()
        activeSpecialService = null
        VoipSession.removeListener(voipListener)
    }
}
