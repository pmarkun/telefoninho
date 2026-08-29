package com.telefoninho.child.voip

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.telefoninho.child.MainActivity
import com.telefoninho.child.data.ConfigStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class VoipForegroundService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var configStore: ConfigStore
    private var ringtoneJob: Job? = null
    private var ringtoneAudioFocus: AudioFocusRequest? = null
    private var previousAudioMode: Int? = null
    private var previousSpeakerphoneOn: Boolean? = null

    private val listener = object : VoipListener {
        override fun onRegistered() {
            showServiceNotification("Telefoninho pronto")
        }

        override fun onUnregistered() {
            showServiceNotification("Telefoninho desconectado")
        }

        override fun onRegistrationFailed(reason: String) {
            showServiceNotification("SIP falhou")
        }

        override fun onCallReceived(callerExtension: String) {
            startRingtone()
            showIncomingCallNotification(callerExtension)
        }

        override fun onCallConnected() {
            stopRingtone()
            VoipSession.refreshAudioRoute()
            notificationManager().cancel(INCOMING_NOTIFICATION_ID)
            showServiceNotification("Chamada em andamento")
        }

        override fun onCallEnded() {
            stopRingtone()
            notificationManager().cancel(INCOMING_NOTIFICATION_ID)
            showServiceNotification("Telefoninho pronto")
        }

        override fun onCallFailed(reason: String) {
            stopRingtone()
            notificationManager().cancel(INCOMING_NOTIFICATION_ID)
            showServiceNotification("Chamada falhou")
        }
    }

    override fun onCreate() {
        super.onCreate()
        configStore = ConfigStore(this)
        createNotificationChannels()
        VoipSession.addListener(listener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification("Telefoninho conectando"))
        scope.launch {
            val config = configStore.loadConfig()
            if (config == null) {
                stopSelf()
                return@launch
            }
            VoipSession.start(this@VoipForegroundService, config.sip)
            VoipSession.setSpeakerMode(configStore.speakerMode.first())
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        VoipSession.removeListener(listener)
        stopRingtone()
        scope.cancel()
        super.onDestroy()
    }

    private fun showServiceNotification(text: String) {
        notificationManager().notify(SERVICE_NOTIFICATION_ID, buildServiceNotification(text))
    }

    private fun showIncomingCallNotification(callerExtension: String) {
        notificationManager().notify(
            INCOMING_NOTIFICATION_ID,
            buildIncomingCallNotification(callerExtension),
        )
    }

    private fun buildServiceNotification(text: String): Notification =
        NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_outgoing)
            .setContentTitle("Telefoninho")
            .setContentText(text)
            .setContentIntent(openAppIntent())
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun buildIncomingCallNotification(callerExtension: String): Notification =
        NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Telefoninho tocando")
            .setContentText("Chamada de $callerExtension")
            .setContentIntent(openAppIntent())
            .setFullScreenIntent(openAppIntent(), true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .build()

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val serviceChannel = NotificationChannel(
            SERVICE_CHANNEL_ID,
            "Telefoninho conectado",
            NotificationManager.IMPORTANCE_LOW,
        )
        val callChannel = NotificationChannel(
            CALL_CHANNEL_ID,
            "Chamadas do Telefoninho",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            setSound(ringtone, attrs)
            enableVibration(true)
        }

        notificationManager().createNotificationChannel(serviceChannel)
        notificationManager().createNotificationChannel(callChannel)
    }

    private fun notificationManager(): NotificationManager =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun startRingtone() {
        ringtoneJob?.cancel()
        routeRingtoneToSpeaker()
        ringtoneJob = scope.launch {
            val option = configStore.ringtone.first()
            val toneGenerator = ToneGenerator(AudioManager.STREAM_RING, 100)
            try {
                while (true) {
                    playRingtonePattern(toneGenerator, option)
                    delay(700)
                }
            } finally {
                toneGenerator.stopTone()
                toneGenerator.release()
            }
        }
    }

    private fun stopRingtone() {
        ringtoneJob?.cancel()
        ringtoneJob = null
        restoreAudioRoute()
    }

    private fun routeRingtoneToSpeaker() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (previousAudioMode == null) previousAudioMode = audioManager.mode
        if (previousSpeakerphoneOn == null) {
            @Suppress("DEPRECATION")
            previousSpeakerphoneOn = audioManager.isSpeakerphoneOn
        }

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        ringtoneAudioFocus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener { }
            .build()
            .also { audioManager.requestAudioFocus(it) }

        audioManager.mode = AudioManager.MODE_RINGTONE
        @Suppress("DEPRECATION")
        audioManager.isSpeakerphoneOn = true
    }

    private fun restoreAudioRoute() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        ringtoneAudioFocus?.let(audioManager::abandonAudioFocusRequest)
        ringtoneAudioFocus = null
        previousAudioMode?.let { audioManager.mode = it }
        previousAudioMode = null
        previousSpeakerphoneOn?.let {
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = it
        }
        previousSpeakerphoneOn = null
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

    companion object {
        private const val SERVICE_CHANNEL_ID = "telefoninho_voip"
        private const val CALL_CHANNEL_ID = "telefoninho_calls"
        private const val SERVICE_NOTIFICATION_ID = 1001
        private const val INCOMING_NOTIFICATION_ID = 1002

        fun start(context: Context) {
            val intent = Intent(context, VoipForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, VoipForegroundService::class.java))
        }
    }
}
