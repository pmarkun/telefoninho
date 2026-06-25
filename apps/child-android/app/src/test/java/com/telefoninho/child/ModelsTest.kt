package com.telefoninho.child

import com.telefoninho.child.data.ContactInfo
import com.telefoninho.child.data.SipCredentials
import com.telefoninho.child.data.ChildProfile
import com.telefoninho.child.data.Screen
import com.telefoninho.child.data.UiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsTest {

    @Test
    fun `child profile creation`() {
        val profile = ChildProfile(
            memberId = "abc123",
            displayName = "Tereza",
            avatarKey = "cat_pixel_01",
            colorKey = "green",
        )
        assertEquals("Tereza", profile.displayName)
        assertEquals("cat_pixel_01", profile.avatarKey)
    }

    @Test
    fun `sip credentials hold values`() {
        val creds = SipCredentials(
            domain = "127.0.0.1",
            port = 5060,
            transport = "udp",
            username = "1003",
            extension = "1003",
            password = "secret123",
        )
        assertEquals("1003", creds.extension)
        assertEquals("secret123", creds.password)
    }

    @Test
    fun `screen sealed interface variants`() {
        val home = Screen.Home
        assertTrue(home is Screen.Home)
    }

    @Test
    fun `ui state loading`() {
        val loading = UiState.Loading
        assertTrue(loading is UiState.Loading)
    }

    @Test
    fun `ui state pairing`() {
        val pairing = UiState.Pairing
        assertTrue(pairing is UiState.Pairing)
    }

    @Test
    fun `contact info enabled filter`() {
        val contacts = listOf(
            ContactInfo("1", "Papai", "dad", "blue", "1001", true),
            ContactInfo("2", "Tereza", "cat", "green", "1002", false),
        )
        val enabled = contacts.filter { it.enabled }
        assertEquals(1, enabled.size)
        assertEquals("Papai", enabled.first().displayName)
    }
}
