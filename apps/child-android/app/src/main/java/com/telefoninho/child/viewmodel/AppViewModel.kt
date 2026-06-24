package com.telefoninho.child.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.telefoninho.child.data.ApiClient
import com.telefoninho.child.data.AppConfig
import com.telefoninho.child.data.ConfigStore
import com.telefoninho.child.data.ContactInfo
import com.telefoninho.child.data.Screen
import com.telefoninho.child.data.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val configStore = ConfigStore(application)
    private val apiClient = ApiClient()

    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _screen = MutableStateFlow<Screen>(Screen.Pairing)
    val screen: StateFlow<Screen> = _screen.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _pairingLoading = MutableStateFlow(false)
    val pairingLoading: StateFlow<Boolean> = _pairingLoading.asStateFlow()

    init {
        checkPaired()
    }

    private fun checkPaired() {
        viewModelScope.launch {
            val isPaired = configStore.isPaired.first()
            if (isPaired) {
                val config = configStore.loadConfig()
                if (config != null) {
                    _uiState.value = UiState.Ready(config.profile, config.contacts)
                    _screen.value = Screen.Home
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

                _uiState.value = UiState.Ready(config.profile, config.contacts)
                _screen.value = Screen.Home
            } catch (e: Exception) {
                _error.value = e.message ?: "Erro de conexão"
            } finally {
                _pairingLoading.value = false
            }
        }
    }

    fun callContact(contact: ContactInfo) {
        _screen.value = Screen.Calling(contact)
    }

    fun onCallConnected(contact: ContactInfo) {
        _screen.value = Screen.InCall(contact)
    }

    fun hangup() {
        _screen.value = Screen.Home
    }

    fun incomingCall(contact: ContactInfo) {
        _screen.value = Screen.Incoming(contact)
    }

    fun acceptCall(contact: ContactInfo) {
        _screen.value = Screen.InCall(contact)
    }

    fun declineCall() {
        _screen.value = Screen.Home
    }

    fun clearError() {
        _error.value = null
    }
}
