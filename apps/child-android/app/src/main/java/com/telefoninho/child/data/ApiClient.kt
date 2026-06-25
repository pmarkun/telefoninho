package com.telefoninho.child.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import com.telefoninho.child.BuildConfig

class ApiClient(private val baseUrl: String = BuildConfig.API_BASE_URL) {

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

    suspend fun generateContactInvite(memberId: String): ContactInviteResponse =
        withContext(Dispatchers.IO) {
            val conn = URL("$baseUrl/members/$memberId/contact-invite").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            try {
                conn.outputStream.use { it.write(JSONObject().toString().toByteArray(Charsets.UTF_8)) }
                val responseCode = conn.responseCode
                if (responseCode != 200) {
                    val error = conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
                    throw Exception("Invite failed ($responseCode): $error")
                }
                val json = JSONObject(conn.inputStream.bufferedReader().readText())
                ContactInviteResponse(
                    token = json.getString("token"),
                    expiresAt = json.getString("expiresAt"),
                    qrPayload = json.getJSONObject("qrPayload").toString(),
                )
            } finally {
                conn.disconnect()
            }
        }

    suspend fun getChildConfig(token: String): PairingResponse =
        withContext(Dispatchers.IO) {
            val conn = URL("$baseUrl/child/config").openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            try {
                val responseCode = conn.responseCode
                if (responseCode != 200) {
                    val error = conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
                    throw Exception("Refresh failed ($responseCode): $error")
                }
                val json = conn.inputStream.bufferedReader().readText()
                parsePairingResponse(JSONObject(json))
            } finally {
                conn.disconnect()
            }
        }

    suspend fun claimContactInvite(token: String, requesterMemberId: String): String =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply {
                put("token", token)
                put("requesterMemberId", requesterMemberId)
            }

            val conn = URL("$baseUrl/contact-invites/claim").openConnection() as HttpURLConnection
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
                    throw Exception("Contact invite failed ($responseCode): $error")
                }
                val json = JSONObject(conn.inputStream.bufferedReader().readText())
                json.optString("status", "pending")
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
            token = json.optString("token").takeIf { it.isNotBlank() },
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
