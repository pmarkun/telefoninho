package com.telefoninho.child.ui

import java.time.Duration
import java.time.Instant

fun relativeTime(createdAt: String, now: Instant = Instant.now()): String {
    val created = runCatching { Instant.parse(createdAt) }.getOrNull() ?: return "há pouco"
    val seconds = Duration.between(created, now).seconds.coerceAtLeast(0)

    return when {
        seconds < 60 -> "agora"
        seconds < 3_600 -> unitAgo(seconds / 60, "min", "min")
        seconds < 86_400 -> unitAgo(seconds / 3_600, "hora", "horas")
        seconds < 604_800 -> unitAgo(seconds / 86_400, "dia", "dias")
        seconds < 2_592_000 -> unitAgo(seconds / 604_800, "semana", "semanas")
        seconds < 31_536_000 -> unitAgo(seconds / 2_592_000, "mês", "meses")
        else -> unitAgo(seconds / 31_536_000, "ano", "anos")
    }
}

private fun unitAgo(value: Long, singular: String, plural: String): String =
    "há $value ${if (value == 1L) singular else plural}"
