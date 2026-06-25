package com.telefoninho.child.special

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class AndroidSpeechPlayer(private val context: Context) {
    private var tts: TextToSpeech? = null

    fun stop() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }

    suspend fun speak(message: String, utterancePrefix: String) {
        val engine = createTts()
        tts = engine
        val result = engine.setLanguage(Locale("pt", "BR"))
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            engine.language = Locale.getDefault()
        }
        engine.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
        )
        delay(450)
        awaitSpeech(engine, message, utterancePrefix)
    }

    private suspend fun createTts(): TextToSpeech =
        suspendCancellableCoroutine { cont ->
            var engine: TextToSpeech? = null
            engine = TextToSpeech(context.applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    val readyEngine = engine
                    if (readyEngine != null) {
                        cont.resume(readyEngine)
                    } else {
                        cont.resumeWithException(IllegalStateException("Voz indisponível"))
                    }
                } else {
                    cont.resumeWithException(IllegalStateException("Voz indisponível"))
                }
            }
            cont.invokeOnCancellation {
                engine.stop()
                engine.shutdown()
            }
        }

    private suspend fun awaitSpeech(engine: TextToSpeech, message: String, utterancePrefix: String) =
        suspendCancellableCoroutine { cont ->
            val utteranceId = "$utterancePrefix-${System.nanoTime()}"
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit

                override fun onDone(doneUtteranceId: String?) {
                    if (doneUtteranceId == utteranceId && cont.isActive) {
                        cont.resume(Unit)
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(errorUtteranceId: String?) {
                    if (errorUtteranceId == utteranceId && cont.isActive) {
                        cont.resumeWithException(IllegalStateException("Erro ao falar"))
                    }
                }
            })
            val result = engine.speak(message, TextToSpeech.QUEUE_FLUSH, Bundle(), utteranceId)
            if (result == TextToSpeech.ERROR) {
                cont.resumeWithException(IllegalStateException("Erro ao falar"))
            }
            cont.invokeOnCancellation { engine.stop() }
        }
}
