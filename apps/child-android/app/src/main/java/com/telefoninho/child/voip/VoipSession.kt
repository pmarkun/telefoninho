package com.telefoninho.child.voip

import android.content.Context
import com.telefoninho.child.data.SipCredentials

object VoipSession {
    private val listeners = linkedSetOf<VoipListener>()
    private var manager: VoipManager? = null
    private var credentialsKey: String? = null

    private val fanoutListener = object : VoipListener {
        override fun onRegistered() {
            snapshotListeners().forEach { it.onRegistered() }
        }

        override fun onUnregistered() {
            snapshotListeners().forEach { it.onUnregistered() }
        }

        override fun onRegistrationFailed(reason: String) {
            snapshotListeners().forEach { it.onRegistrationFailed(reason) }
        }

        override fun onCallReceived(callerExtension: String) {
            snapshotListeners().forEach { it.onCallReceived(callerExtension) }
        }

        override fun onCallConnected() {
            snapshotListeners().forEach { it.onCallConnected() }
        }

        override fun onCallEnded() {
            snapshotListeners().forEach { it.onCallEnded() }
        }

        override fun onCallFailed(reason: String) {
            snapshotListeners().forEach { it.onCallFailed(reason) }
        }
    }

    @Synchronized
    fun addListener(listener: VoipListener) {
        listeners.add(listener)
    }

    @Synchronized
    fun removeListener(listener: VoipListener) {
        listeners.remove(listener)
    }

    @Synchronized
    fun start(context: Context, credentials: SipCredentials) {
        val key = credentials.key()
        if (manager != null && credentialsKey == key) return
        manager?.stop()
        manager = VoipManager(context.applicationContext).also {
            it.listener = fanoutListener
            it.start(credentials)
        }
        credentialsKey = key
    }

    @Synchronized
    fun stop() {
        manager?.stop()
        manager = null
        credentialsKey = null
    }

    fun setSpeakerMode(enabled: Boolean) {
        manager?.setSpeakerMode(enabled)
    }

    fun refreshAudioRoute() {
        manager?.refreshAudioRoute()
    }

    fun call(extension: String) {
        manager?.call(extension)
    }

    fun acceptCall() {
        manager?.acceptCall()
    }

    fun declineCall() {
        manager?.declineCall()
    }

    fun hangup() {
        manager?.hangup()
    }

    @Synchronized
    private fun snapshotListeners(): List<VoipListener> = listeners.toList()

    private fun SipCredentials.key(): String =
        listOf(domain, port.toString(), transport, username, extension, password).joinToString("|")
}
