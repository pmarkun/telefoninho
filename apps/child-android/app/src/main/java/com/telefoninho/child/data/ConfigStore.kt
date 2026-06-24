package com.telefoninho.child.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

private val Context.store: DataStore<Preferences> by preferencesDataStore(name = "telefoninho_config")

private const val KEY_CONFIG = "app_config"
private const val KEY_PAIRED = "is_paired"

class ConfigStore(private val context: Context) {

    val isPaired: Flow<Boolean> = context.store.data.map { prefs ->
        prefs[stringPreferencesKey(KEY_PAIRED)]?.toBoolean() ?: false
    }

    suspend fun saveConfig(config: AppConfig) {
        context.store.edit { prefs ->
            prefs[stringPreferencesKey(KEY_CONFIG)] = encodeConfig(config)
            prefs[stringPreferencesKey(KEY_PAIRED)] = "true"
        }
    }

    suspend fun loadConfig(): AppConfig? {
        val raw = context.store.data.first()[stringPreferencesKey(KEY_CONFIG)] ?: return null
        return try {
            decodeConfig(raw)
        } catch (_: Exception) {
            null
        }
    }

    suspend fun clear() {
        context.store.edit { it.clear() }
    }

    private fun encodeConfig(config: AppConfig): String {
        val contacts = JSONArray().apply {
            config.contacts.forEach { c ->
                put(
                    JSONObject().apply {
                        put("memberId", c.memberId)
                        put("displayName", c.displayName)
                        put("avatarKey", c.avatarKey)
                        put("colorKey", c.colorKey)
                        put("sipExtension", c.sipExtension)
                        put("enabled", c.enabled)
                    },
                )
            }
        }
        return JSONObject().apply {
            put("profile", JSONObject().apply {
                put("memberId", config.profile.memberId)
                put("displayName", config.profile.displayName)
                put("avatarKey", config.profile.avatarKey)
                put("colorKey", config.profile.colorKey)
            })
            put("sip", JSONObject().apply {
                put("domain", config.sip.domain)
                put("port", config.sip.port)
                put("transport", config.sip.transport)
                put("username", config.sip.username)
                put("extension", config.sip.extension)
                put("password", config.sip.password)
            })
            put("contacts", contacts)
            put("settings", JSONObject().apply {
                put("showDialpad", config.settings.showDialpad)
                put("allowEmergencyButton", config.settings.allowEmergencyButton)
                put("theme", config.settings.theme)
            })
        }.toString()
    }

    private fun decodeConfig(raw: String): AppConfig {
        val json = JSONObject(raw)
        val profile = json.getJSONObject("profile")
        val sip = json.getJSONObject("sip")
        val contactsArr = json.getJSONArray("contacts")
        val settings = json.optJSONObject("settings") ?: JSONObject()

        val contacts = mutableListOf<ContactInfo>()
        for (i in 0 until contactsArr.length()) {
            val c = contactsArr.getJSONObject(i)
            contacts.add(
                ContactInfo(
                    memberId = c.getString("memberId"),
                    displayName = c.getString("displayName"),
                    avatarKey = c.optString("avatarKey", "star_pixel_01"),
                    colorKey = c.optString("colorKey", "green"),
                    sipExtension = c.optString("sipExtension", ""),
                    enabled = c.optBoolean("enabled", true),
                ),
            )
        }

        return AppConfig(
            profile = ChildProfile(
                memberId = profile.getString("memberId"),
                displayName = profile.getString("displayName"),
                avatarKey = profile.optString("avatarKey", "star_pixel_01"),
                colorKey = profile.optString("colorKey", "green"),
            ),
            sip = SipCredentials(
                domain = sip.getString("domain"),
                port = sip.optInt("port", 5060),
                transport = sip.optString("transport", "udp"),
                username = sip.getString("username"),
                extension = sip.getString("extension"),
                password = sip.getString("password"),
            ),
            contacts = contacts,
            settings = AppSettings(
                showDialpad = settings.optBoolean("showDialpad", false),
                allowEmergencyButton = settings.optBoolean("allowEmergencyButton", false),
                theme = settings.optString("theme", "pixel"),
            ),
        )
    }
}
