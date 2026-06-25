package com.telefoninho.child.voip

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.telefoninho.child.data.SipCredentials
import org.linphone.core.Account
import org.linphone.core.Address
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
    var listener: VoipListener? = null

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    fun start(credentials: SipCredentials) {
        executor.execute {
            try {
                val c = factory.createCore(null, null, context)
                configureCore(c, credentials)
                core = c
            } catch (e: Exception) {
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

    fun call(extension: String) {
        executor.execute {
            try {
                val c = core ?: return@execute
                val currentAccount = c.defaultAccount ?: return@execute
                val domain = currentAccount.params.identityAddress!!.domain
                val address = factory.createAddress("sip:$extension@$domain") ?: return@execute

                val params: CallParams = c.createCallParams(null) ?: return@execute
                params.videoDirection = MediaDirection.Inactive
                c.inviteAddressWithParams(address, params)
            } catch (e: Exception) {
                postOnMain { listener?.onCallFailed("Falha ao ligar: ${e.message}") }
            }
        }
    }

    fun acceptCall() {
        executor.execute {
            val current = core?.currentCall ?: return@execute
            val params = core?.createCallParams(current)
            if (params != null) {
                params.videoDirection = MediaDirection.Inactive
                current.acceptWithParams(params)
            } else {
                current.accept()
            }
        }
    }

    fun declineCall() {
        executor.execute {
            core?.currentCall?.decline(Reason.Declined)
        }
    }

    fun hangup() {
        executor.execute {
            core?.currentCall?.terminate()
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
                RegistrationState.Ok -> postOnMain { listener?.onRegistered() }
                RegistrationState.Cleared -> postOnMain { listener?.onUnregistered() }
                RegistrationState.Failed -> postOnMain { listener?.onRegistrationFailed(message) }
                else -> {}
            }
        }

        override fun onCallStateChanged(c: Core, call: Call, state: Call.State, message: String) {
            when (state) {
                Call.State.IncomingReceived -> {
                    val ext = call.remoteAddress?.username
                    postOnMain { listener?.onCallReceived(ext ?: "Desconhecido") }
                }
                Call.State.Connected, Call.State.StreamsRunning -> {
                    postOnMain { listener?.onCallConnected() }
                }
                Call.State.End, Call.State.Released -> {
                    postOnMain { listener?.onCallEnded() }
                }
                Call.State.Error -> {
                    postOnMain { listener?.onCallFailed(message) }
                }
                else -> {}
            }
        }
    }

    private fun postOnMain(action: () -> Unit) {
        mainHandler.post(action)
    }
}
