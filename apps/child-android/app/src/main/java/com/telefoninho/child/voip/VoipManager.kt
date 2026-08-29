package com.telefoninho.child.voip

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.telefoninho.child.data.SipCredentials
import org.linphone.core.Account
import org.linphone.core.Address
import org.linphone.core.AudioDevice
import org.linphone.core.AuthInfo
import org.linphone.core.Call
import org.linphone.core.CallParams
import org.linphone.core.Core
import org.linphone.core.CoreListenerStub
import org.linphone.core.Factory
import org.linphone.core.MediaDirection
import org.linphone.core.Reason
import org.linphone.core.RegistrationState
import org.linphone.core.TransportType
import java.util.concurrent.Executors

interface VoipListener {
    fun onRegistered()
    fun onUnregistered()
    fun onRegistrationFailed(reason: String)
    fun onCallReceived(callerExtension: String)
    fun onCallConnected()
    fun onCallEnded()
    fun onCallFailed(reason: String)
}

class VoipManager(private val context: Context) {
    private val factory = Factory.instance()
    private var core: Core? = null
    private var activeCall: Call? = null
    var listener: VoipListener? = null

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var speakerMode = true

    fun start(credentials: SipCredentials) {
        executor.execute {
            try {
                Log.i(TAG, "Starting VoIP for ${credentials.username}@${credentials.domain}:${credentials.port}/${credentials.transport}")
                val c = factory.createCore(null, null, context)
                configureCore(c, credentials)
                core = c
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start VoIP", e)
                postOnMain { listener?.onCallFailed("Falha ao iniciar VoIP: ${e.message}") }
            }
        }
    }

    fun stop() {
        executor.execute {
            core?.removeListener(coreListener)
            core?.stop()
            core = null
        }
    }

    fun setSpeakerMode(enabled: Boolean) {
        executor.execute {
            speakerMode = enabled
            val c = core ?: return@execute
            enableAudio(c, activeCall ?: c.currentCall)
        }
    }

    fun refreshAudioRoute() {
        executor.execute {
            val c = core ?: return@execute
            enableAudio(c, activeCall ?: c.currentCall)
        }
    }

    fun call(extension: String) {
        executor.execute {
            try {
                val c = core ?: return@execute failCall("SIP ainda nao iniciou")
                val currentAccount = c.defaultAccount ?: return@execute failCall("Conta SIP ausente")
                val domain = currentAccount.params.identityAddress!!.domain
                val address = factory.createAddress("sip:$extension@$domain")
                    ?: return@execute failCall("Ramal SIP invalido")

                val params: CallParams = c.createCallParams(null)
                    ?: return@execute failCall("Nao foi possivel criar parametros da chamada")
                params.audioDirection = MediaDirection.SendRecv
                params.videoDirection = MediaDirection.Inactive
                enableAudio(c, null)
                Log.i(TAG, "Calling sip:$extension@$domain")
                activeCall = c.inviteAddressWithParams(address, params)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to place call", e)
                postOnMain { listener?.onCallFailed("Falha ao ligar: ${e.message}") }
            }
        }
    }

    fun acceptCall() {
        executor.execute {
            try {
                val current = activeCall ?: core?.currentCall
                    ?: return@execute failCall("Nenhuma chamada para atender")
                val params = core?.createCallParams(current)
                Log.i(TAG, "Accepting call from ${current.remoteAddress.asStringUriOnly()}")
                if (params != null) {
                    params.audioDirection = MediaDirection.SendRecv
                    params.videoDirection = MediaDirection.Inactive
                    enableAudio(current.core, current)
                    current.acceptWithParams(params)
                } else {
                    enableAudio(current.core, current)
                    current.accept()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to accept call", e)
                postOnMain { listener?.onCallFailed("Falha ao atender: ${e.message}") }
            }
        }
    }

    fun declineCall() {
        executor.execute {
            try {
                val current = activeCall ?: core?.currentCall
                    ?: return@execute failCall("Nenhuma chamada para recusar")
                Log.i(TAG, "Declining call from ${current.remoteAddress.asStringUriOnly()}")
                current.decline(Reason.Declined)
                activeCall = null
            } catch (e: Exception) {
                Log.e(TAG, "Failed to decline call", e)
                postOnMain { listener?.onCallFailed("Falha ao recusar: ${e.message}") }
            }
        }
    }

    fun hangup() {
        executor.execute {
            try {
                val current = activeCall ?: core?.currentCall
                    ?: return@execute failCall("Nenhuma chamada para desligar")
                Log.i(TAG, "Hanging up call with ${current.remoteAddress.asStringUriOnly()}")
                current.terminate()
                activeCall = null
            } catch (e: Exception) {
                Log.e(TAG, "Failed to hang up call", e)
                postOnMain { listener?.onCallFailed("Falha ao desligar: ${e.message}") }
            }
        }
    }

    private fun configureCore(c: Core, creds: SipCredentials) {
        c.addListener(coreListener)
        c.isIpv6Enabled = false

        val transport = when (creds.transport.lowercase()) {
            "tcp" -> TransportType.Tcp
            "tls" -> TransportType.Tls
            else -> TransportType.Udp
        }

        val identityAddr: Address = factory.createAddress("sip:${creds.username}@${creds.domain}")!!
        identityAddr.port = creds.port
        identityAddr.transport = transport

        val proxyAddr = factory.createAddress("sip:${creds.domain}")!!
        proxyAddr.port = creds.port
        proxyAddr.transport = transport

        val params = c.createAccountParams()
        params.identityAddress = identityAddr
        params.serverAddress = proxyAddr
        params.isRegisterEnabled = true

        val authInfo = factory.createAuthInfo(
            creds.username, null, creds.password, null, null, creds.domain,
        )
        c.addAuthInfo(authInfo)

        val acc = c.createAccount(params)
        c.addAccount(acc)
        c.defaultAccount = acc

        c.start()
    }

    private val coreListener = object : CoreListenerStub() {
        override fun onAccountRegistrationStateChanged(
            c: Core, acc: Account, state: RegistrationState, message: String,
        ) {
            when (state) {
                RegistrationState.Ok -> {
                    Log.i(TAG, "SIP registration ok")
                    postOnMain { listener?.onRegistered() }
                }
                RegistrationState.Cleared -> {
                    Log.i(TAG, "SIP registration cleared")
                    postOnMain { listener?.onUnregistered() }
                }
                RegistrationState.Failed -> {
                    Log.w(TAG, "SIP registration failed: $message")
                    postOnMain { listener?.onRegistrationFailed(message) }
                }
                else -> {}
            }
        }

        override fun onCallStateChanged(c: Core, call: Call, state: Call.State, message: String) {
            Log.i(
                TAG,
                "Call state=$state message=$message remote=${call.remoteAddress.asStringUriOnly()}",
            )
            when (state) {
                Call.State.IncomingReceived -> {
                    activeCall = call
                    val ext = call.remoteAddress.username
                    postOnMain { listener?.onCallReceived(ext ?: "Desconhecido") }
                }
                Call.State.Connected, Call.State.StreamsRunning -> {
                    activeCall = call
                    enableAudio(c, call)
                    postOnMain { listener?.onCallConnected() }
                }
                Call.State.End, Call.State.Released -> {
                    if (activeCall == call) {
                        activeCall = null
                    }
                    postOnMain { listener?.onCallEnded() }
                }
                Call.State.Error -> {
                    if (activeCall == call) {
                        activeCall = null
                    }
                    Log.w(TAG, "Call failed: $message")
                    postOnMain { listener?.onCallFailed(message) }
                }
                else -> {}
            }
        }
    }

    private fun failCall(reason: String) {
        Log.w(TAG, reason)
        postOnMain { listener?.onCallFailed(reason) }
    }

    private fun enableAudio(c: Core, call: Call?) {
        try {
            c.activateAudioSession(true)
            c.isMicEnabled = true
            val microphone = c.audioDevices.firstOrNull { it.type == AudioDevice.Type.Microphone }
            val output = selectOutputDevice(c)
            if (microphone != null) {
                c.setInputAudioDevice(microphone)
                call?.setInputAudioDevice(microphone)
            }
            if (output != null) {
                c.setOutputAudioDevice(output)
                call?.setOutputAudioDevice(output)
            }
            call?.setMicrophoneMuted(false)
            call?.setSpeakerMuted(false)
            Log.i(
                TAG,
                "Audio enabled mic=${c.isMicEnabled} speakerMode=$speakerMode input=${microphone?.deviceName ?: "default"} output=${output?.deviceName ?: "default"} call=${call?.state}",
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to enable audio", e)
        }
    }

    private fun selectOutputDevice(c: Core): AudioDevice? {
        if (speakerMode) {
            return c.audioDevices.firstOrNull { it.type == AudioDevice.Type.Speaker }
        }
        return c.audioDevices.firstOrNull {
            it.type.name.equals("Earpiece", ignoreCase = true) ||
                it.deviceName.contains("earpiece", ignoreCase = true)
        } ?: c.audioDevices.firstOrNull {
            it.type != AudioDevice.Type.Speaker && it.type != AudioDevice.Type.Microphone
        }
    }

    private fun postOnMain(action: () -> Unit) {
        mainHandler.post(action)
    }

    private companion object {
        const val TAG = "TelefoninhoVoip"
    }
}
