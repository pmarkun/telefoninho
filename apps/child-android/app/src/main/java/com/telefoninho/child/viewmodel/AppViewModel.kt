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
import com.telefoninho.child.voip.VoipListener
import com.telefoninho.child.voip.VoipManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val configStore = ConfigStore(application)
    private val apiClient = ApiClient()
    val voipManager = VoipManager(application)

    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _screen = MutableStateFlow<Screen>(Screen.Pairing)
    val screen: StateFlow<Screen> = _screen.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _pairingLoading = MutableStateFlow(false)
    val pairingLoading: StateFlow<Boolean> = _pairingLoading.asStateFlow()

    private var sipCredentials: SipCredentials? = null

    private val voipListener = object : VoipListener {
        override fun onRegistered() {}

        override fun onUnregistered() {}

        override fun onRegistrationFailed(reason: String) {
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
            if (current is Screen.Calling) {
                _screen.value = Screen.InCall(current.contact)
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
        voipManager.listener = voipListener
        checkPaired()
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
                    voipManager.start(config.sip)
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
                val response = apiClient.claimPairing(code, deviceName, deviceId)

                val config = AppConfig(
                    profile = response.profile,
                    sip = response.sip,
                    contacts = response.contacts,
                    settings = response.settings,
                )

                configStore.saveConfig(config)
                sipCredentials = config.sip

                _uiState.value = UiState.Ready(config.profile, config.contacts)
                _screen.value = Screen.Home

                voipManager.start(config.sip)
            } catch (e: Exception) {
                _error.value = e.message ?: "Erro de conexão"
            } finally {
                _pairingLoading.value = false
            }
        }
    }

    fun callContact(contact: ContactInfo) {
        _screen.value = Screen.Calling(contact)
        voipManager.call(contact.sipExtension)
    }

    fun acceptCall() {
        voipManager.acceptCall()
    }

    fun declineCall() {
        voipManager.declineCall()
        _screen.value = Screen.Home
    }

    fun hangup() {
        voipManager.hangup()
    }

    fun clearError() {
        _error.value = null
    }

    override fun onCleared() {
        super.onCleared()
        voipManager.stop()
    }
}
