package com.telefoninho.child.special

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

class WeatherSpecialService(private val context: Context) : SpecialDialService {
    override val extension = "170"
    override val displayName = "PREVISÃO"
    override val avatarKey = "weather_pixel_01"
    override val colorKey = "blue"

    private var job: Job? = null
    private val speechPlayer = AndroidSpeechPlayer(context)

    override fun start(scope: CoroutineScope, onFinished: () -> Unit, onError: (String) -> Unit) {
        stop()
        job = scope.launch {
            try {
                val forecast = fetchTomorrowForecast()
                val message = buildForecastMessage(forecast)
                speechPlayer.speak(message, "weather-170")
                onFinished()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                onError(e.message ?: "Não consegui falar a previsão")
            } finally {
                job = null
                releaseTts()
            }
        }
    }

    override fun stop() {
        job?.cancel()
        job = null
        releaseTts()
    }

    private fun releaseTts() {
        speechPlayer.stop()
    }

    private suspend fun fetchTomorrowForecast(): WeatherForecast =
        withContext(Dispatchers.IO) {
            val url = URL(
                "https://api.open-meteo.com/v1/forecast" +
                    "?latitude=-23.5505" +
                    "&longitude=-46.6333" +
                    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum" +
                    "&timezone=America%2FSao_Paulo" +
                    "&forecast_days=2",
            )
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000
            try {
                val responseCode = conn.responseCode
                if (responseCode != 200) {
                    throw IllegalStateException("Previsão indisponível")
                }
                parseForecast(JSONObject(conn.inputStream.bufferedReader().readText()))
            } finally {
                conn.disconnect()
            }
        }

    private fun parseForecast(json: JSONObject): WeatherForecast {
        val daily = json.getJSONObject("daily")
        val dates = daily.getJSONArray("time")
        val minTemps = daily.getJSONArray("temperature_2m_min")
        val maxTemps = daily.getJSONArray("temperature_2m_max")
        val rainChances = daily.optJSONArray("precipitation_probability_max")
        val rainTotals = daily.getJSONArray("precipitation_sum")
        val tomorrow = LocalDate.now().plusDays(1).toString()
        val index = (0 until dates.length()).firstOrNull { dates.getString(it) == tomorrow }
            ?: minOf(1, dates.length() - 1)

        return WeatherForecast(
            city = "São Paulo",
            minTemp = minTemps.getDouble(index),
            maxTemp = maxTemps.getDouble(index),
            rainChance = rainChances?.optInt(index, 0) ?: 0,
            rainMm = rainTotals.optDouble(index, 0.0),
        )
    }

    private fun buildForecastMessage(forecast: WeatherForecast): String {
        val min = forecast.minTemp.toInt()
        val max = forecast.maxTemp.toInt()
        val rainText = if (forecast.rainChance >= 45 || forecast.rainMm >= 2.0) {
            "Tem chance de chuva, então leva guarda-chuva."
        } else {
            "A chance de chuva é baixa."
        }
        val clothes = when {
            max >= 29 -> "Vai de roupa leve e lembra de beber água."
            min <= 15 -> "Melhor separar uma blusa ou casaco."
            forecast.rainChance >= 45 || forecast.rainMm >= 2.0 -> "Um tênis que possa molhar também ajuda."
            else -> "Roupa confortável deve resolver."
        }
        return "Previsão de amanhã para ${forecast.city}. " +
            "A temperatura fica entre $min e $max graus. " +
            "$rainText $clothes"
    }

    private data class WeatherForecast(
        val city: String,
        val minTemp: Double,
        val maxTemp: Double,
        val rainChance: Int,
        val rainMm: Double,
    )
}
