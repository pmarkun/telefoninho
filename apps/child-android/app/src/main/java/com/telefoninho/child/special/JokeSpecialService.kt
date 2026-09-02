package com.telefoninho.child.special

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.random.Random

class JokeSpecialService(private val context: Context) : SpecialDialService {
    override val extension = "137"
    override val displayName = "DISQUE PIADA"
    override val avatarKey = "joke_pixel_01"
    override val colorKey = "orange"

    private var job: Job? = null
    private val speechPlayer = AndroidSpeechPlayer(context)

    override fun start(scope: CoroutineScope, onFinished: () -> Unit, onError: (String) -> Unit) {
        stop()
        job = scope.launch {
            try {
                val joke = JokeDatabase.jokes.random(Random(System.nanoTime()))
                speechPlayer.speak("Disque piada. $joke", "joke-137")
                onFinished()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                onError(e.message ?: "Não consegui contar a piada")
            } finally {
                job = null
                speechPlayer.stop()
            }
        }
    }

    override fun stop() {
        job?.cancel()
        job = null
        speechPlayer.stop()
    }
}
