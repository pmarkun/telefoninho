package com.telefoninho.child.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(private val baseUrl: String = "http://10.0.2.2:3001") {

    suspend fun claimPairing(code: String, deviceName: String, deviceId: String): PairingResponse =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply {
                put("code", code)
                put("deviceName", deviceName)
                put("deviceId", deviceId)
            }

            val conn = URL("$baseUrl/pairing/claim").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            try {
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val responseCode = conn.responseCode
                if (responseCode != 200) {
                    val error = conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
                    throw Exception("Claim failed ($responseCode): $error")
                }
                val json = conn.inputStream.bufferedReader().readText()
                parsePairingResponse(JSONObject(json))
            } finally {
                conn.disconnect()
            }
        }

    private fun parsePairingResponse(json: JSONObject): PairingResponse {
        val profile = json.getJSONObject("profile")
        val sip = json.getJSONObject("sip")
        val contacts = json.getJSONArray("contacts")
        val settings = json.optJSONObject("settings") ?: JSONObject()

        return PairingResponse(
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
            contacts = parseContacts(contacts),
            settings = AppSettings(
                showDialpad = settings.optBoolean("showDialpad", false),
                allowEmergencyButton = settings.optBoolean("allowEmergencyButton", false),
                theme = settings.optString("theme", "pixel"),
            ),
        )
    }

    private fun parseContacts(arr: JSONArray): List<ContactInfo> {
        val result = mutableListOf<ContactInfo>()
        for (i in 0 until arr.length()) {
            val c = arr.getJSONObject(i)
            result.add(
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
        return result
    }
}
