package com.telefoninho.child.data

data class ChildProfile(
    val memberId: String,
    val displayName: String,
    val avatarKey: String,
    val colorKey: String,
)

data class SipCredentials(
    val domain: String,
    val port: Int,
    val transport: String,
    val username: String,
    val extension: String,
    val password: String,
)

data class ContactInfo(
    val memberId: String,
    val displayName: String,
    val avatarKey: String,
    val colorKey: String,
    val sipExtension: String,
    val enabled: Boolean,
)

data class AppSettings(
    val showDialpad: Boolean,
    val allowEmergencyButton: Boolean,
    val theme: String,
)

data class PairingResponse(
    val token: String?,
    val profile: ChildProfile,
    val sip: SipCredentials,
    val contacts: List<ContactInfo>,
    val settings: AppSettings,
)

data class ContactInviteResponse(
    val token: String,
    val expiresAt: String,
    val qrPayload: String,
)

data class AppConfig(
    val token: String?,
    val profile: ChildProfile,
    val sip: SipCredentials,
    val contacts: List<ContactInfo>,
    val settings: AppSettings,
)

sealed interface Screen {
    data object Pairing : Screen
    data object Home : Screen
    data object Settings : Screen
    data object Contacts : Screen
    data object Dialpad : Screen
    data object MyQr : Screen
    data object ScanQr : Screen
    data class Calling(val contact: ContactInfo) : Screen
    data class InCall(val contact: ContactInfo) : Screen
    data class Incoming(val contact: ContactInfo) : Screen
}

sealed interface UiState {
    data object Loading : UiState
    data object Pairing : UiState
    data class Ready(
        val profile: ChildProfile,
        val contacts: List<ContactInfo>,
    ) : UiState
}

enum class CallStatus { Ready, Calling, InCall, Ringing }
