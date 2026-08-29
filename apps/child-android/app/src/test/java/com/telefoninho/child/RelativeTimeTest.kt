package com.telefoninho.child

import com.telefoninho.child.ui.relativeTime
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class RelativeTimeTest {
    private val now = Instant.parse("2026-08-29T18:00:00Z")

    @Test
    fun `formats recent messages in Portuguese`() {
        assertEquals("agora", relativeTime("2026-08-29T17:59:40Z", now))
        assertEquals("há 5 min", relativeTime("2026-08-29T17:55:00Z", now))
        assertEquals("há 1 hora", relativeTime("2026-08-29T17:00:00Z", now))
        assertEquals("há 2 dias", relativeTime("2026-08-27T18:00:00Z", now))
    }

    @Test
    fun `falls back for invalid timestamps`() {
        assertEquals("há pouco", relativeTime("not-a-date", now))
    }
}
