package com.telefoninho.child

import com.telefoninho.child.special.JokeDatabase
import com.telefoninho.child.special.SpecialDialService
import com.telefoninho.child.special.SpecialDialServiceRegistry
import kotlinx.coroutines.CoroutineScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SpecialDialServiceRegistryTest {
    @Test
    fun `find returns service for reserved extension`() {
        val service = FakeSpecialDialService("170")
        val registry = SpecialDialServiceRegistry(listOf(service))

        assertEquals(service, registry.find("170"))
        assertEquals(service, registry.find(" 170 "))
    }

    @Test
    fun `find ignores normal sip extensions`() {
        val registry = SpecialDialServiceRegistry(listOf(FakeSpecialDialService("170")))

        assertNull(registry.find("1001"))
    }

    @Test
    fun `registry can hold multiple special services`() {
        val weather = FakeSpecialDialService("170")
        val joke = FakeSpecialDialService("137")
        val registry = SpecialDialServiceRegistry(listOf(weather, joke))

        assertEquals(weather, registry.find("170"))
        assertEquals(joke, registry.find("137"))
        assertNull(registry.find("138"))
    }

    @Test
    fun `joke database has thirty jokes`() {
        assertEquals(30, JokeDatabase.jokes.size)
        assertEquals(30, JokeDatabase.jokes.distinct().size)
    }

    private class FakeSpecialDialService(override val extension: String) : SpecialDialService {
        override val displayName = "FAKE"
        override val avatarKey = "fake"
        override val colorKey = "blue"

        override fun start(scope: CoroutineScope, onFinished: () -> Unit, onError: (String) -> Unit) {
            onFinished()
        }

        override fun stop() = Unit
    }
}
